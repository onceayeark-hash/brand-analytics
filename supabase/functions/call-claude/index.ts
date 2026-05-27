/**
 * Supabase Edge Function: call-claude
 *
 * Claude API プロキシ。ANTHROPIC_API_KEY はフロントエンドに渡さない。
 * ebay-token と同じ JWT 検証パターンを採用。
 *
 * POST /functions/v1/call-claude
 * Authorization: Bearer <supabase_jwt>
 * Body: { feature: string, userContent: string, context?: object }
 *
 * Response: { text: string, sources: string[] }
 *
 * プロンプト3層構造:
 *   A層: eBayコアプロンプト（ハードコード・恒久知識）
 *   B層: ebay_rules テーブルから動的取得（改定追従）
 *   C層: web_search ツールを付与（最新情報補完）
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API  = "https://api.anthropic.com/v1/messages";
const MODEL          = "claude-sonnet-4-6";
const MAX_TOKENS     = 2048;
const MAX_TOOL_TURNS = 3;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ────────────────────────────────────────────────────────────────
// A層: eBayコアプロンプト（恒久知識・変更不要）
// ────────────────────────────────────────────────────────────────
const LAYER_A = `あなたはeBayセラー（日本人）専門のビジネスアシスタントです。
以下のeBay基本知識を持っています。

【Cassini検索アルゴリズムの基本原則】
- タイトルは80文字を最大限活用し、検索キーワードを自然に含める
- Item Specificsは必須・推奨項目を全て入力するとカタログマッチングが向上する
- 無在庫・長期在庫は検索順位を下げる要因になる
- キーワードスタッフィング（無意味な羅列）はeBayのアルゴリズムによりペナルティ対象

【アカウント健全性（Seller Performance Standards）】
- Defect Rate: 2%以上でBelow Standard（0.5%未満でTop Rated）
- Late Shipment Rate: 10%以上でBelow Standard（3%未満でTop Rated）
- Cases Closed Without Resolution: 0.3%以上でBelow Standard
- Tracking Uploaded On Time: 95%以上がTop Rated条件

【eBay手数料体系（概要）】
- Final Value Fee（FVF）: カテゴリ別（標準13.25%・上限Cap $750）
- Promoted Listings: 最低2.0%〜
- Payoneer手数料: 約2.0%

【Authenticity Guarantee（真贋保証）】
- 対象カテゴリ: ハンドバッグ・スニーカー・腕時計・宝飾品
- $500以上の対象商品: 真贋審査のための国内送料（セラー負担・約¥1,500）が発生
- $500以上の国際送料・関税はバイヤー負担

【eBay規約・フィードバック方針】
- VeROプログラム: ブランドの知的財産権保護。VeRO対象品は即リスティング削除・アカウント停止リスクあり
- フィードバック: 購入者への報復フィードバック禁止
- 返品ポリシー: 誠実な対応がアカウント健全性の維持に影響する
- 出品禁止カテゴリ: 偽造品・レプリカ・食品医薬品・危険物等（eBay禁止品リスト参照）

【回答の姿勢】
- 提案は必ず根拠（理由・数値・出典）とともに示す
- 最終判断は必ずユーザーが行う。押しつけない
- 不確かな情報には「最新情報をeBay公式で確認してください」と付記する
- 回答は日本語で行う
- 簡潔・実用的に答える。長文説明よりアクション提案を優先する`;

// ────────────────────────────────────────────────────────────────
// B層: ebay_rules テーブルの内容をシステムプロンプトに変換
// ────────────────────────────────────────────────────────────────
type EbayRule = {
  item_key:    string;
  value:       string;
  description: string | null;
  category:    string;
};

function buildLayerB(rules: EbayRule[]): string {
  if (!rules || rules.length === 0) return "";

  const lines = rules.map(r =>
    `- [${r.category}] ${r.item_key}: ${r.value}${r.description ? `（${r.description}）` : ""}`
  );

  return `\n\n【最新eBayルール（DB登録値・A層のデフォルト値より優先）】\n${lines.join("\n")}`;
}

// ────────────────────────────────────────────────────────────────
// メインハンドラ
// ────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "Method Not Allowed" }, 405);
  }

  // ── JWT 検証（ebay-token と同パターン） ──────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")      ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  // ── リクエストボディ ─────────────────────────────────────────
  let body: { feature?: string; userContent?: string; context?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Invalid JSON body" }, 400);
  }

  const { feature, userContent, context } = body;
  if (!feature || !userContent) {
    return jsonRes({ error: "feature と userContent は必須です" }, 400);
  }

  // ── ANTHROPIC_API_KEY（Supabase Secrets に保管） ─────────────
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    console.error("[call-claude] ANTHROPIC_API_KEY 未設定");
    return jsonRes({ error: "Server configuration error" }, 500);
  }

  // ── B層: ebay_rules 取得（service_role で RLS バイパス） ──────
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let ebayRules: EbayRule[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from("ebay_rules")
      .select("item_key, value, description, category")
      .order("category");
    if (!error && data) ebayRules = data as EbayRule[];
  } catch (err) {
    // B層取得失敗はサイレントスキップ（A層のみで動作継続）
    console.warn("[call-claude] ebay_rules 取得失敗（B層なしで続行）:", err);
  }

  // ── A層 + B層 でシステムプロンプト構築 ──────────────────────
  const systemPrompt = LAYER_A + buildLayerB(ebayRules);

  // ── コンテキスト情報をユーザーメッセージに付加 ──────────────
  const hasContext = context && Object.keys(context).length > 0;
  const contextStr = hasContext
    ? `\n\n【現在の状況データ】\n${JSON.stringify(context, null, 2)}`
    : "";

  const userMessage = `[機能: ${feature}]\n${userContent}${contextStr}`;

  // ── C層: web_search ツール定義 ──────────────────────────────
  const tools = [
    { type: "web_search_20250305", name: "web_search" },
  ];

  // ── Anthropic API 呼び出しループ（C層フォールバック付き） ────
  type ContentBlock = {
    type:   string;
    text?:  string;
    id?:    string;
    name?:  string;
    input?: Record<string, unknown>;
  };
  type AnthropicResponse = {
    stop_reason: string;
    content:     ContentBlock[];
    error?:      { message?: string };
  };

  const messages: Array<{ role: string; content: unknown }> = [
    { role: "user", content: userMessage },
  ];

  let finalText = "";
  const sources: string[] = [];
  let useTools  = true;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const reqBody: Record<string, unknown> = {
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      messages,
    };
    if (useTools) reqBody.tools = tools;

    const reqHeaders: Record<string, string> = {
      "Content-Type":      "application/json",
      "x-api-key":         anthropicKey,
      "anthropic-version": "2023-06-01",
    };
    if (useTools) reqHeaders["anthropic-beta"] = "web-search-2025-03-05";

    let anthropicRes: Response;
    try {
      anthropicRes = await fetch(ANTHROPIC_API, {
        method:  "POST",
        headers: reqHeaders,
        body:    JSON.stringify(reqBody),
      });
    } catch (err) {
      console.error("[call-claude] Anthropic API 接続エラー:", err);
      return jsonRes({ error: "AI APIへの接続に失敗しました" }, 502);
    }

    let resData: AnthropicResponse;
    try {
      resData = await anthropicRes.json() as AnthropicResponse;
    } catch {
      return jsonRes({ error: "AI APIレスポンスのパースに失敗しました" }, 502);
    }

    if (!anthropicRes.ok) {
      // C層（web_search）が未対応の場合はツールなしで1回だけ再試行
      if (useTools && (anthropicRes.status === 400 || anthropicRes.status === 404) && turn === 0) {
        console.warn("[call-claude] web_search 非対応環境—C層なしで再試行");
        useTools = false;
        messages.length = 0;
        messages.push({ role: "user", content: userMessage });
        continue;
      }
      console.error("[call-claude] Anthropic API エラー:", resData);
      return jsonRes({ error: resData?.error?.message ?? "AI APIエラー" }, 502);
    }

    // テキストブロックを収集
    for (const block of resData.content ?? []) {
      if (block.type === "text" && block.text) {
        finalText = block.text;
      }
    }

    // end_turn: ループ終了
    if (resData.stop_reason === "end_turn") break;

    // tool_use: アシスタント応答を追加して次ターンへ
    if (resData.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resData.content });

      // web_search のツール実行はAnthropicがサーバー側で処理する
      // クライアントは tool_result を返してループを継続する
      const toolResults = (resData.content ?? [])
        .filter((b): b is ContentBlock & { id: string } => b.type === "tool_use" && !!b.id)
        .map(b => ({
          type:        "tool_result",
          tool_use_id: b.id,
          content:     "",
        }));

      if (toolResults.length > 0) {
        messages.push({ role: "user", content: toolResults });
      } else {
        break;
      }
      continue;
    }

    break;
  }

  return jsonRes({ text: finalText, sources });
});

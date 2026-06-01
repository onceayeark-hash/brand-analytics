/**
 * Supabase Edge Function: ebay-token
 *
 * eBay OAuth の認証コード→トークン交換 および リフレッシュトークン→アクセストークン更新。
 * Client Secret (EBAY_CERT_ID) はこの関数内のみで使用し、フロントエンドには渡さない。
 *
 * POST /functions/v1/ebay-token
 * Authorization: Bearer <supabase_jwt>
 * Body (認証コード交換): { type: "authorization_code", code: string, redirectUri: string }
 * Body (リフレッシュ):   { type: "refresh_token", refreshToken: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // OPTIONSは常に最優先（try-catchの外）
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // 全体をtry-catchで包む → 未捕捉例外もCORSヘッダ付きで返す
  try {
    if (req.method !== "POST") {
      return jsonRes({ error: "Method Not Allowed" }, 405);
    }

    // ── JWT 検証 ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[ebay-token] JWT検証失敗:", authError?.message);
      return jsonRes({ error: "Unauthorized" }, 401);
    }
    console.log("[ebay-token] JWT検証OK. user_id:", user.id);

    // ── eBay 認証情報（Supabase Secrets から取得） ─────────
    const clientId = Deno.env.get("EBAY_CLIENT_ID");
    const certId   = Deno.env.get("EBAY_CERT_ID");
    if (!clientId || !certId) {
      console.error("[ebay-token] EBAY_CLIENT_ID / EBAY_CERT_ID 未設定");
      return jsonRes({ error: "Server configuration error" }, 500);
    }

    // ── リクエストボディ ───────────────────────────────────
    let body: {
      type?: string;
      code?: string;
      redirectUri?: string;
      refreshToken?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: "Invalid JSON body" }, 400);
    }
    console.log("[ebay-token] type:", body.type, "redirectUri:", body.redirectUri);

    // btoa()はLatin1範囲外の文字で例外を投げるため TextEncoder 経由でエンコード
    const credBytes = new TextEncoder().encode(`${clientId}:${certId}`);
    let credBinary = '';
    for (let i = 0; i < credBytes.length; i++) {
      credBinary += String.fromCharCode(credBytes[i]);
    }
    const credentials = btoa(credBinary);
    // 非ASCII文字が混入していると後でeBayが401を返す（Secretsの入れ直しが必要）
    const hasNonAscii = [`${clientId}`, `${certId}`].some(s => /[^\x00-\x7F]/.test(s));
    if (hasNonAscii) {
      console.warn("[ebay-token] 警告: EBAY_CLIENT_ID または EBAY_CERT_ID に非ASCII文字が含まれています。Secretsを確認してください。");
    }
    let tokenBody: URLSearchParams;

    if (body.type === "authorization_code") {
      if (!body.code || !body.redirectUri) {
        return jsonRes({ error: "code と redirectUri が必要です" }, 400);
      }
      tokenBody = new URLSearchParams({
        grant_type:   "authorization_code",
        code:         body.code,
        redirect_uri: body.redirectUri,
      });
    } else if (body.type === "refresh_token") {
      if (!body.refreshToken) {
        return jsonRes({ error: "refreshToken が必要です" }, 400);
      }
      tokenBody = new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: body.refreshToken,
      });
    } else {
      return jsonRes(
        { error: "type は 'authorization_code' または 'refresh_token' を指定してください" },
        400
      );
    }

    // ── eBay トークンエンドポイントへリクエスト ────────────
    console.log("[ebay-token] eBay token endpoint へリクエスト送信:", body.type);
    let ebayRes: Response;
    try {
      ebayRes = await fetch(EBAY_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: tokenBody,
      });
    } catch (err) {
      console.error("[ebay-token] eBay API 接続エラー:", err);
      return jsonRes({ error: "eBay API への接続に失敗しました" }, 502);
    }

    console.log("[ebay-token] eBay response status:", ebayRes.status);

    let ebayData: unknown;
    try {
      ebayData = await ebayRes.json();
    } catch {
      const raw = await ebayRes.text().catch(() => "(読み取り不可)");
      console.error("[ebay-token] eBay レスポンスのJSONパース失敗. status:", ebayRes.status, "body:", raw.slice(0, 200));
      return jsonRes({ error: "eBay returned non-JSON response", status: ebayRes.status }, 502);
    }

    if (!ebayRes.ok) {
      console.error("[ebay-token] eBay トークン交換失敗. status:", ebayRes.status, "detail:", JSON.stringify(ebayData));
      return jsonRes({ error: "eBay token exchange failed", detail: ebayData }, ebayRes.status);
    }

    console.log("[ebay-token] トークン交換成功");
    return jsonRes(ebayData, 200);

  } catch (err) {
    // 未捕捉例外 → CORSヘッダ付きで返すのでブラウザのResponseタブで中身が読める
    const msg   = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    console.error("[ebay-token] 未捕捉エラー:", msg, stack);
    return jsonRes({ error: "Internal server error", detail: msg }, 500);
  }
});

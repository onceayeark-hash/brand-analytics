// @security-critical
/**
 * Supabase Edge Function: ebay-token
 *
 * eBay OAuth の認証コード→トークン交換 および リフレッシュトークン→アクセストークン更新。
 * Client Secret (EBAY_CERT_ID) はこの関数内のみで使用し、フロントエンドには渡さない。
 *
 * 【A案・2026-07-02】トークンの暗号化・保存はこの関数がサーバー側で行う。
 * ・refresh_token はフロントエンドに一切返さない（この関数と DB だけが知る）
 * ・token_data は AES-GCM 256bit で暗号化（鍵は SERVICE_ROLE_KEY から SHA-256 導出。
 *   この鍵の漏洩 = DB全権漏洩と同義のため、専用シークレット追加より運用が単純）
 * ・旧方式（フロント暗号化）の token_data は復号不能 → 行を削除して再連携を促す
 *
 * POST /functions/v1/ebay-token
 * Authorization: Bearer <supabase_jwt>
 * Body (認証コード交換): { type: "authorization_code", code: string, redirectUri: string }
 * Body (リフレッシュ):   { type: "refresh_token" }  ※refreshToken は送らない
 * Response: { access_token: string, expires_in: number }
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

// ── サーバー側トークン暗号化（AES-GCM 256bit） ────────────────
type StoredTokens = {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // エポックms
};

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getEncKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ebay-token-enc:${secret}`)
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptTokens(tokens: StoredTokens): Promise<string> {
  const key = await getEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(tokens))
  );
  return `${bufToBase64(iv)}:${bufToBase64(ct)}`;
}

async function decryptTokens(encStr: string): Promise<StoredTokens> {
  const idx = encStr.indexOf(":");
  if (idx === -1) throw new Error("invalid format");
  const iv = base64ToBuf(encStr.slice(0, idx));
  const ct = base64ToBuf(encStr.slice(idx + 1));
  const key = await getEncKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain)) as StoredTokens;
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

    // ── トークン保存用クライアント（service_role・RLSバイパス） ──
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")              ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── リクエストボディ ───────────────────────────────────
    let body: {
      type?: string;
      code?: string;
      redirectUri?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: "Invalid JSON body" }, 400);
    }
    console.log("[ebay-token] type:", body.type);

    // btoa()はLatin1範囲外の文字で例外を投げるため TextEncoder 経由でエンコード
    const credentials = bufToBase64(new TextEncoder().encode(`${clientId}:${certId}`));
    // 非ASCII文字が混入していると後でeBayが401を返す（Secretsの入れ直しが必要）
    const hasNonAscii = [`${clientId}`, `${certId}`].some(s => /[^\x00-\x7F]/.test(s));
    if (hasNonAscii) {
      console.warn("[ebay-token] 警告: EBAY_CLIENT_ID または EBAY_CERT_ID に非ASCII文字が含まれています。Secretsを確認してください。");
    }

    let tokenBody: URLSearchParams;
    let storedRefreshToken = ""; // refresh時に既存 refresh_token を引き継ぐ

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
      // refresh_token は DB の暗号化済み token_data から取り出す（フロントからは受け取らない）
      const { data: row, error: rowError } = await admin
        .from("ebay_tokens")
        .select("token_data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (rowError) {
        console.error("[ebay-token] token_data 取得失敗:", rowError.message);
        return jsonRes({ error: "Token lookup failed" }, 500);
      }
      if (!row) {
        return jsonRes({ error: "not_connected" }, 404);
      }
      try {
        const stored = await decryptTokens(row.token_data);
        storedRefreshToken = stored.refreshToken;
      } catch {
        // 旧方式（フロント暗号化）の token_data はサーバーでは復号不能 → 行を削除して再連携を促す
        console.warn("[ebay-token] token_data 復号失敗（旧形式）→ 行を削除・再連携が必要:", user.id);
        await admin.from("ebay_tokens").delete().eq("user_id", user.id);
        return jsonRes({ error: "reauth_required" }, 401);
      }
      tokenBody = new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: storedRefreshToken,
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

    let ebayData: {
      access_token?:  string;
      refresh_token?: string;
      expires_in?:    number;
    };
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

    const expiresIn = Number(ebayData.expires_in);
    if (!ebayData.access_token || !expiresIn || expiresIn <= 0) {
      console.error("[ebay-token] eBay レスポンスに access_token / expires_in がありません");
      return jsonRes({ error: "Invalid token response from eBay" }, 502);
    }

    // ── 暗号化して DB に保存（refresh_token はフロントに返さない） ──
    const refreshToken = ebayData.refresh_token || storedRefreshToken;
    if (!refreshToken) {
      console.error("[ebay-token] refresh_token が取得できません");
      return jsonRes({ error: "Missing refresh_token from eBay" }, 502);
    }

    const blob = await encryptTokens({
      accessToken:  ebayData.access_token,
      refreshToken,
      expiresAt:    Date.now() + expiresIn * 1000,
    });
    const { error: saveError } = await admin
      .from("ebay_tokens")
      .upsert(
        { user_id: user.id, token_data: blob, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (saveError) {
      console.error("[ebay-token] トークン保存失敗:", saveError.message);
      return jsonRes({ error: "Token save failed" }, 500);
    }

    console.log("[ebay-token] トークン交換・保存成功");
    return jsonRes(
      { access_token: ebayData.access_token, expires_in: expiresIn },
      200
    );

  } catch (err) {
    // 未捕捉例外 → CORSヘッダ付きで返すのでブラウザのResponseタブで中身が読める
    const msg   = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    console.error("[ebay-token] 未捕捉エラー:", msg, stack);
    return jsonRes({ error: "Internal server error", detail: msg }, 500);
  }
});

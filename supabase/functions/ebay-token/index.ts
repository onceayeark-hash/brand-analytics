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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
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
    return jsonRes({ error: "Unauthorized" }, 401);
  }

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

  const credentials = btoa(`${clientId}:${certId}`);
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

  const ebayData = await ebayRes.json();
  if (!ebayRes.ok) {
    console.error("[ebay-token] eBay トークン交換失敗:", ebayData);
    return jsonRes({ error: "eBay token exchange failed", detail: ebayData }, ebayRes.status);
  }

  return jsonRes(ebayData, 200);
});

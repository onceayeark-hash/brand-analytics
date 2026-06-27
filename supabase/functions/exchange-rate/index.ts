// @not-security-critical （外部公開APIから為替レートを取得するだけ・認証情報を扱わない・2026-06-25判断）
/**
 * Supabase Edge Function: exchange-rate
 *
 * open.er-api.com からサーバーサイドで USD/JPY レートを取得して返す。
 * ブラウザ直叩きは CORS エラーになるため Edge Function を中継する。
 *
 * GET /functions/v1/exchange-rate
 * 認証不要（為替レートは公開データ）
 *
 * Response: { rate: number, base: "USD", target: "JPY", timestamp: number }
 */

const EXCHANGE_API_URL = "https://open.er-api.com/v6/latest/USD";

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

  try {
    if (req.method !== "GET") {
      return jsonRes({ error: "Method Not Allowed" }, 405);
    }

    console.log("[exchange-rate] open.er-api.com へリクエスト送信");
    let erRes: Response;
    try {
      erRes = await fetch(EXCHANGE_API_URL);
    } catch (err) {
      console.error("[exchange-rate] open.er-api.com 接続エラー:", err);
      return jsonRes({ error: "外部為替APIへの接続に失敗しました" }, 502);
    }

    if (!erRes.ok) {
      console.error("[exchange-rate] open.er-api.com response status:", erRes.status);
      return jsonRes({ error: `外部APIエラー: ${erRes.status}` }, 502);
    }

    let data: { rates?: Record<string, number> };
    try {
      data = await erRes.json();
    } catch {
      console.error("[exchange-rate] JSONパース失敗");
      return jsonRes({ error: "外部APIレスポンスのパースに失敗しました" }, 502);
    }

    const rate = data?.rates?.JPY;
    if (!rate || typeof rate !== "number") {
      console.error("[exchange-rate] JPY レートが取得できません:", JSON.stringify(data).slice(0, 200));
      return jsonRes({ error: "JPY レートが取得できません" }, 502);
    }

    console.log("[exchange-rate] 取得成功. USD/JPY =", rate);
    return jsonRes({
      rate,
      base:      "USD",
      target:    "JPY",
      timestamp: Date.now(),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[exchange-rate] 未捕捉エラー:", msg);
    return jsonRes({ error: "Internal server error", detail: msg }, 500);
  }
});

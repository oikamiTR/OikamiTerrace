// 読み上げリーダー用の中継サーバー(Cloudflare Worker)
// アプリから受け取った文章を Google Cloud Text-to-Speech に渡し、音声データを返す。
// Googleの鍵はアプリには置かず、ここ(Cloudflareの「シークレット」)にだけ保存する。
//
// Cloudflareの「設定 → 変数とシークレット」に次の2つを「シークレット」として登録すること:
//   GOOGLE_API_KEY : Google Cloud で作成したAPIキー
//   PASSPHRASE     : 家族で決めた合言葉(アプリの設定画面で入力するもの)

const ALLOWED_ORIGINS = ["https://oikamitr.github.io"];

// must match CLOUD_VOICES in index.html
const ALLOWED_VOICES = [
  "ja-JP-Neural2-B",
  "ja-JP-Neural2-C",
  "ja-JP-Neural2-D",
  "ja-JP-Wavenet-A",
  "ja-JP-Wavenet-B",
  "ja-JP-Wavenet-C",
  "ja-JP-Wavenet-D",
];

const MAX_TEXT_BYTES = 4800; // Google accepts up to 5000 bytes per request

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Passphrase",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }
    if (!env.PASSPHRASE || request.headers.get("X-Passphrase") !== env.PASSPHRASE) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400, headers: cors });
    }
    const text = typeof body.text === "string" ? body.text : "";
    if (!text || new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
      return new Response("Bad Request", { status: 400, headers: cors });
    }
    const voice = ALLOWED_VOICES.includes(body.voice) ? body.voice : ALLOWED_VOICES[0];

    const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "ja-JP", name: voice },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });
    if (!res.ok) {
      console.log("Text-to-Speech error", res.status, await res.text());
      return new Response("TTS error", { status: 502, headers: cors });
    }

    // pass Google's JSON ({ audioContent: base64 }) straight through; the app decodes it
    return new Response(res.body, {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};

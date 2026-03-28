// ============================================================
// Edge Function: webhook-sign
//
// Two modes (selected by request path / action param):
//
//   POST /webhook-sign?action=sign
//     Body: { payload: object }
//     Returns: { signature: string, timestamp: number, signed_payload: string }
//
//   POST /webhook-sign?action=verify
//     Body: { payload: object, signature: string, timestamp: number }
//     Returns: { valid: boolean }
//
// Signatures use HMAC-SHA256 with the WEBHOOK_SECRET env var.
// The signed payload is: `${timestamp}.${JSON.stringify(payload)}`
// Replay window: 5 minutes.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// --------------- Constants ---------------

const REPLAY_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes

// --------------- CORS ---------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// --------------- Helpers ---------------

function getSupabaseUser(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function computeHmac(key: CryptoKey, data: string): Promise<string> {
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// --------------- Main handler ---------------

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: CORS_HEADERS },
    );
  }

  // ── Auth ──
  const userClient = getSupabaseUser(req);
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  // ── Webhook secret ──
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("WEBHOOK_SECRET is not set");
    return Response.json(
      { error: "Webhook signing not configured" },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  // ── Parse action ──
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action !== "sign" && action !== "verify") {
    return Response.json(
      { error: "action query param must be 'sign' or 'verify'" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const hmacKey = await getHmacKey(webhookSecret);

  // ================================================================
  // SIGN
  // ================================================================
  if (action === "sign") {
    if (!body.payload || typeof body.payload !== "object") {
      return Response.json(
        { error: "body.payload must be an object" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const timestamp = Date.now();
    const payloadJson = JSON.stringify(body.payload);
    const signedPayload = `${timestamp}.${payloadJson}`;
    const signature = await computeHmac(hmacKey, signedPayload);

    return Response.json(
      { signature, timestamp, signed_payload: signedPayload },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  // ================================================================
  // VERIFY
  // ================================================================
  // body must contain { payload, signature, timestamp }
  if (!body.payload || typeof body.payload !== "object") {
    return Response.json(
      { error: "body.payload must be an object" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (typeof body.signature !== "string") {
    return Response.json(
      { error: "body.signature must be a string" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (typeof body.timestamp !== "number") {
    return Response.json(
      { error: "body.timestamp must be a number" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Replay-window check.
  const age = Date.now() - body.timestamp;
  if (age > REPLAY_WINDOW_MS || age < 0) {
    return Response.json(
      { valid: false, reason: "Timestamp outside replay window" },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  const payloadJson = JSON.stringify(body.payload);
  const signedPayload = `${body.timestamp}.${payloadJson}`;
  const expectedSignature = await computeHmac(hmacKey, signedPayload);

  const valid = timingSafeEqual(expectedSignature, body.signature);

  return Response.json(
    { valid },
    { status: 200, headers: CORS_HEADERS },
  );
});

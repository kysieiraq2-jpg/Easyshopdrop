import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-199IA-DISPUTE-EVIDENCE-V3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify({ version: VERSION, ...body }),
    {
      status,
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function cleanText(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(
      { ok: false, error: "backend_configuration_error" },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return json(
      { ok: false, error: "authentication_required" },
      401,
    );
  }

  const db = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const token = authorization.replace(/^Bearer\s+/i, "");

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return json(
      { ok: false, error: "invalid_authentication" },
      401,
    );
  }

  let input: Record<string, unknown>;

  try {
    input = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Fix 199I-A: retire the metadata-only route. It did not bind evidence to an
  // authorised dispute or an uploaded file. The current protected page uses
  // participant-owned Storage and the existing registration RPC.
  return json(
    {
      ok: false,
      error: "protected_case_evidence_required",
      user_message: "Open My Dispute Evidence and select your existing dispute to attach a file.",
    },
    410,
  );
});

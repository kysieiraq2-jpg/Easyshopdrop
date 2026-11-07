
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-FEEDBACK-V2";

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

function adminClient() {
  return createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function cleanText(value: unknown, max = 4000) {
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

  const db = adminClient();

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

  const feedbackType =
    cleanText(
      input.feedback_type ??
      input.type ??
      input.category,
      50,
    ).toLowerCase();

  const allowedTypes = [
    "feedback",
    "complaint",
    "suggestion",
    "compliment",
    "service",
    "website",
    "transaction",
  ];

  const normalizedType =
    allowedTypes.includes(feedbackType)
      ? feedbackType
      : "feedback";

  const subject = cleanText(input.subject, 200);

  const message = cleanText(
    input.message ??
    input.details ??
    input.feedback,
    5000,
  );

  if (!message) {
    return json(
      { ok: false, error: "feedback_message_required" },
      400,
    );
  }

  /*
   * Permanent Shop&Drop references must be generated
   * by the protected backend, never by browser code.
   */

  const { data: reference, error: referenceError } =
    await db.rpc(
      "generate_shopdrop_reference",
      { prefix: "SD-FBK" },
    );

  if (
    referenceError ||
    typeof reference !== "string" ||
    !reference.startsWith("SD-FBK-")
  ) {
    console.error(
      VERSION,
      "feedback reference generation failed",
      referenceError,
    );

    return json(
      { ok: false, error: "reference_generation_failed" },
      500,
    );
  }

  /*
   * Store a normalized protected feedback event.
   * User identity comes from the authenticated token,
   * never from the browser payload.
   */

  const payload = {
    user_id: user.id,
    feedback_reference: reference,
    feedback_type: normalizedType,
    subject: subject || null,
    message,
    country_code:
      cleanText(input.country_code, 2).toUpperCase() || null,
    transaction_reference:
      cleanText(input.transaction_reference, 100) || null,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } =
    await db
      .from("integration_events")
      .insert({
        event_type: "platform_feedback",
        external_reference: reference,
        payload,
        status: "received",
      });

  if (insertError) {
    console.error(
      VERSION,
      "feedback storage failed",
      insertError,
    );

    return json(
      { ok: false, error: "feedback_storage_failed" },
      500,
    );
  }

  return json({
    ok: true,
    reference,
    status: "submitted",
  });
});



import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-DISPUTES-V2";

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

  const orderId =
    cleanText(input.order_id ?? input.orderId, 100);

  const paymentId =
    cleanText(input.payment_id ?? input.paymentId, 100);

  const transactionReference =
    cleanText(
      input.transaction_reference ??
      input.reference,
      100,
    );

  const reason =
    cleanText(input.reason ?? input.category, 100);

  const description =
    cleanText(
      input.description ??
      input.details ??
      input.message,
      5000,
    );

  if (!orderId && !paymentId && !transactionReference) {
    return json(
      { ok: false, error: "transaction_reference_required" },
      400,
    );
  }

  if (!reason || !description) {
    return json(
      { ok: false, error: "dispute_details_required" },
      400,
    );
  }

  /*
   * Shop&Drop dispute references are generated only
   * by the protected backend.
   */

  const { data: disputeReference, error: referenceError } =
    await db.rpc(
      "generate_shopdrop_reference",
      { prefix: "SD-DSP" },
    );

  if (
    referenceError ||
    typeof disputeReference !== "string" ||
    !disputeReference.startsWith("SD-DSP-")
  ) {
    console.error(
      VERSION,
      "reference generation failed",
      referenceError,
    );

    return json(
      { ok: false, error: "reference_generation_failed" },
      500,
    );
  }

  /*
   * Store only normalized fields.
   * The authenticated user ID is server-derived.
   */

  const payload = {
    user_id: user.id,
    dispute_reference: disputeReference,
    order_id: orderId || null,
    payment_id: paymentId || null,
    transaction_reference:
      transactionReference || null,
    reason,
    description,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } =
    await db
      .from("integration_events")
      .insert({
        event_type: "payment_dispute_opened",
        external_reference: disputeReference,
        payload,
        status: "received",
      });

  if (insertError) {
    console.error(
      VERSION,
      "dispute storage failed",
      insertError,
    );

    return json(
      { ok: false, error: "dispute_storage_failed" },
      500,
    );
  }

  return json({
    ok: true,
    dispute_reference: disputeReference,
    status: "submitted",
  });
});


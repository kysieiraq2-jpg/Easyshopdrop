
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-CANCELLATIONS-V2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: Record<string, unknown>, status = 200) {
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
    return reply(
      { ok: false, error: "method_not_allowed" },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return reply(
      { ok: false, error: "backend_configuration_error" },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return reply(
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
    return reply(
      { ok: false, error: "invalid_authentication" },
      401,
    );
  }

  let input: Record<string, unknown>;

  try {
    input = await req.json();
  } catch {
    return reply(
      { ok: false, error: "invalid_json" },
      400,
    );
  }

  const orderId = cleanText(
    input.order_id ?? input.orderId,
    100,
  );

  const transactionReference = cleanText(
    input.transaction_reference ??
    input.order_reference ??
    input.reference,
    100,
  );

  const reason = cleanText(
    input.reason ?? input.cancellation_reason,
    500,
  );

  const details = cleanText(
    input.details ??
    input.description ??
    input.message,
    3000,
  );

  if (!orderId && !transactionReference) {
    return reply(
      {
        ok: false,
        error: "transaction_reference_required",
      },
      400,
    );
  }

  if (!reason) {
    return reply(
      {
        ok: false,
        error: "cancellation_reason_required",
      },
      400,
    );
  }

  /*
   * Cancellation request reference is generated
   * server-side. It does not alter the original
   * SD-ORD / SD-PAY transaction references.
   */

  const cancellationReference =
    `SD-CAN-${crypto.randomUUID()}`;

  const payload = {
    user_id: user.id,

    cancellation_reference:
      cancellationReference,

    order_id:
      orderId || null,

    transaction_reference:
      transactionReference || null,

    reason,

    details:
      details || null,

    requested_at:
      new Date().toISOString(),
  };

  /*
   * This records the REQUEST only.
   *
   * It does not directly cancel a paid order,
   * issue a refund, alter inventory or release funds.
   * Those financial/state transitions remain protected
   * backend operations.
   */

  const { error: insertError } =
    await db
      .from("integration_events")
      .insert({
        event_type: "cancellation_requested",
        external_reference: cancellationReference,
        payload,
        status: "received",
      });

  if (insertError) {
    console.error(
      VERSION,
      "cancellation storage failed",
      insertError,
    );

    return reply(
      {
        ok: false,
        error: "cancellation_storage_failed",
      },
      500,
    );
  }

  return reply({
    ok: true,
    reference: cancellationReference,
    status: "submitted",
  });
});


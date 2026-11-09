
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-FIX22I-DISPATCH-CHECKOUT-V1";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(
  data: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify({ version: VERSION, ...data }),
    {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (request.method !== "POST") {
    return respond({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!url || !serviceKey) {
    return respond({ ok: false, error: "configuration_missing" }, 503);
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return respond({ ok: false, error: "authentication_required" }, 401);
  }

  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const token = authorization.replace(/^Bearer\s+/i, "");

  const { data: authData, error: authError } =
    await db.auth.getUser(token);

  if (authError || !authData.user) {
    return respond({ ok: false, error: "invalid_session" }, 401);
  }

  let input: Record<string, unknown>;

  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond({ ok: false, error: "invalid_request" }, 400);
    }

    input = body;
  } catch {
    return respond({ ok: false, error: "invalid_json" }, 400);
  }

  const bookingId = input.booking_id;

  if (!validUuid(bookingId)) {
    return respond({ ok: false, error: "invalid_booking_id" }, 400);
  }

  // Customer identity is established by Supabase Auth.
  // Never trust a customer ID or amount from the browser.

  const { data: booking, error: bookingError } =
    await db
      .from("dispatch_bookings")
      .select(
        "id, customer_id, booking_status, payment_status",
      )
      .eq("id", bookingId)
      .maybeSingle();

  if (bookingError) {
    console.error(VERSION, "booking lookup failed");
    return respond({ ok: false, error: "booking_lookup_failed" }, 500);
  }

  if (!booking) {
    return respond({ ok: false, error: "booking_not_found" }, 404);
  }

  if (booking.customer_id !== authData.user.id) {
    return respond({ ok: false, error: "not_authorized" }, 403);
  }

  if (
    booking.booking_status !== "pending_payment" ||
    booking.payment_status !== "pending"
  ) {
    return respond({ ok: false, error: "booking_not_payable" }, 409);
  }

  // Existing Fix 22G calculates and locks the amount.
  // Only the backend service role invokes this RPC.

  const { data: checkout, error: checkoutError } =
    await db.rpc("shopdrop_prepare_dispatch_checkout", {
      p_booking_id: bookingId,
    });

  if (checkoutError) {
    console.error(VERSION, "checkout preparation failed");
    return respond(
      { ok: false, error: "checkout_preparation_failed" },
      409,
    );
  }

  const record = Array.isArray(checkout)
    ? checkout[0]
    : checkout;

  if (!record?.checkout_reference) {
    return respond(
      { ok: false, error: "checkout_reference_unavailable" },
      500,
    );
  }

  // Provider payments are intentionally inactive.
  // No payment session, card charge or payout occurs.

  return respond({
    ok: true,
    booking_id: bookingId,
    checkout_reference: record.checkout_reference,
    expected_amount: record.expected_amount,
    currency: record.currency,
    checkout_status: record.checkout_status,
    payment_provider_status: "not_activated",
    payment_url: null,
  });
});

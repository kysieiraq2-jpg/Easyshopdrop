import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-FIX39-SELLER-COURIER-REFERENCE-V3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ version: VERSION, ...body }), {
    status,
    headers: HEADERS,
  });
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: HEADERS });
  }
  if (req.method !== "POST") {
    return reply({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return reply({ ok: false, error: "backend_not_configured" }, 503);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authHeader)) {
    return reply({ ok: false, error: "seller_sign_in_required" }, 401);
  }

  const sellerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await sellerClient.auth.getUser();
  if (authError || !authData.user?.id || authData.user.is_anonymous === true) {
    return reply({ ok: false, error: "seller_authentication_failed" }, 401);
  }

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return reply({ ok: false, error: "invalid_json" }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return reply({ ok: false, error: "invalid_request" }, 400);
  }
  const input = payload as Record<string, unknown>;
  const shipmentId = String(input.shipment_id ?? "").trim().toLowerCase();
  const courierReference = String(input.courier_reference ?? "").trim();
  const handoverConfirmed = input.handover_confirmed === true;

  if (!UUID.test(shipmentId) || !/^[A-Za-z0-9][A-Za-z0-9 ._:/#-]{2,126}[A-Za-z0-9]$/.test(courierReference)) {
    return reply({ ok: false, error: "invalid_shipment_or_courier_reference" }, 400);
  }
  if (!handoverConfirmed) {
    return reply({ ok: false, error: "physical_handover_confirmation_required" }, 400);
  }

  // The authenticated seller RPC records a courier-issued reference against
  // the exact booked shipment and confirmed payment legs. Seller submission
  // NEVER proves collection, marks seller eligible, or triggers payment.
  const { data: verified, error: pinError } = await sellerClient.rpc(
    "shopdrop_seller_submit_courier_collection_reference",
    { p_shipment_id: shipmentId, p_courier_reference: courierReference },
  );
  if (pinError) {
    return reply({ ok: false, error: "courier_reference_recording_unavailable" }, 409);
  }
  if (verified?.recorded !== true) {
    return reply({
      ok: false,
      recorded: false,
      error: String(verified?.reason ?? "courier_reference_not_recorded"),
      funds_moved: false,
    }, 409);
  }

  // Reconcile either arrival order: independent courier evidence may precede
  // the seller reference. The trusted backend checks BOTH again and can only
  // stage an INACTIVE provider request. No provider payment is invoked here.
  let stagingStatus = "awaiting_independent_courier_event";
  if (verified.reference_matches_booking === true) {
    const trusted = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: staging, error: stagingError } = await trusted.rpc(
      "shopdrop_try_stage_three_factor_pickup",
      { p_shipment_id: shipmentId, p_signal: "backend_retry" },
    );
    stagingStatus = stagingError
      ? "backend_retry_needed"
      : String(staging?.state ?? "backend_retry_needed");
  }
  // A submitted reference is never sufficient evidence to stage or pay.
  return reply({
    ok: true,
    recorded: true,
    reference_matches_booking: verified?.reference_matches_booking === true,
    status: verified?.status ?? "recorded_awaiting_independent_courier_event",
    staging_status: stagingStatus,
    independent_collection_verified: false,
    provider_release_request_id: null,
    provider_release_invoked: false,
    funds_moved: false,
    provider_activation_pending: true,
  });
});

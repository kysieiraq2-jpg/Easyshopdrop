
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R21B-SERVICE-ARRIVAL-PIN-V1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return reply({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return reply(
      { ok: false, error: "backend_configuration_error" },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
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
    const parsed = await req.json();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return reply({ ok: false, error: "invalid_json" }, 400);
    }

    input = parsed;
  } catch {
    return reply({ ok: false, error: "invalid_json" }, 400);
  }

  const bookingId = cleanText(
    input.booking_id ?? input.bookingId,
    100,
  );

  if (!isUuid(bookingId)) {
    return reply(
      { ok: false, error: "valid_booking_id_required" },
      400,
    );
  }

  const verificationMethod = cleanText(
    input.verification_method ??
      input.verificationMethod ??
      "arrival_code",
    50,
  ).toLowerCase();

  if (verificationMethod !== "arrival_code") {
    return reply(
      { ok: false, error: "arrival_pin_required" },
      400,
    );
  }

  const verificationCode = cleanText(
    input.verification_code ??
      input.arrival_code ??
      input.pin,
    100,
  );

  if (!/^[0-9]{6}$/.test(verificationCode)) {
    return reply(
      { ok: false, error: "six_digit_pin_required" },
      400,
    );
  }

  const { data: booking, error: bookingError } =
    await db
      .from("service_bookings")
      .select("id, provider_id, service_id, payment_status")
      .eq("id", bookingId)
      .maybeSingle();

  if (bookingError) {
    console.error(VERSION, "booking lookup failed", bookingError);

    return reply(
      { ok: false, error: "booking_lookup_failed" },
      500,
    );
  }

  if (!booking) {
    return reply(
      { ok: false, error: "booking_not_found" },
      404,
    );
  }

  // Provider identity must come from authentication,
  // never from an ID supplied by the browser.
  if (booking.provider_id !== user.id) {
    return reply(
      { ok: false, error: "provider_not_authorized" },
      403,
    );
  }

  if (booking.payment_status !== "paid") {
    return reply(
      { ok: false, error: "paid_booking_required" },
      409,
    );
  }

  const { data: verified, error: verifyError } =
    await db.rpc(
      "shopdrop_verify_service_arrival_pin",
      {
        p_booking_id: bookingId,
        p_provider_id: user.id,
        p_pin: verificationCode,
      },
    );

  if (verifyError) {
    console.error(VERSION, "PIN verification failed", verifyError);

    return reply(
      { ok: false, error: "pin_verification_failed" },
      500,
    );
  }

  if (verified !== true) {
    return reply(
      {
        ok: false,
        error: "pin_invalid_expired_or_already_used",
      },
      403,
    );
  }

  // Never store the PIN in event metadata.
  const evidenceReference = cleanText(
    input.evidence_reference ?? input.evidenceReference,
    150,
  );

  const payload = {
    booking_id: bookingId,
    service_id: booking.service_id,
    verification_method: "arrival_code",
    evidence_reference: evidenceReference || null,
    verification_code_present: true,
    actor_user_id: user.id,
    verified_at: new Date().toISOString(),
  };

  const { error: insertError } =
    await db
      .from("integration_events")
      .insert({
        event_type: "service_arrival_verified",
        entity_type: "service_booking",
        entity_id: bookingId,
        payload,
        status: "verified",
      });

  if (insertError) {
    console.error(
      VERSION,
      "arrival event storage failed",
      insertError,
    );
  }

  // Arrival verification does not itself release money.
  // Payout integration will follow separately.
  return reply({
    ok: true,
    booking_id: bookingId,
    status: "arrival_verified",
    event_recorded: !insertError,
    payout_eligible: false,
    payout_status: "awaiting_payout_integration",
  });
});


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-FIX37-CUSTOMER-COMPLETION-PIN-V1";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ version: VERSION, ...body }), {
    headers, status,
  });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return reply({ ok: false, error: "method_not_allowed" }, 405);
  if (!URL || !SERVICE_KEY)
    return reply({ ok: false, error: "backend_configuration_error" }, 503);

  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization))
    return reply({ ok: false, error: "authentication_required" }, 401);

  const admin = createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user?.id || user.is_anonymous === true)
    return reply({ ok: false, error: "authentication_failed" }, 401);

  let input: Record<string, unknown>;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply({ ok: false, error: "invalid_request" }, 400);
    input = body as Record<string, unknown>;
  } catch {
    return reply({ ok: false, error: "invalid_json" }, 400);
  }

  const bookingType = String(input.booking_type ?? "").trim().toLowerCase();
  const bookingId = String(input.booking_id ?? "").trim().toLowerCase();
  const completionPin = String(input.completion_pin ?? input.pin ?? "");
  if (!["service", "dispatch"].includes(bookingType) ||
      !UUID.test(bookingId) || !/^[0-9]{6}$/.test(completionPin)) {
    return reply({ ok: false, error: "invalid_booking_or_completion_pin" }, 400);
  }

  if (input.work_completed !== true) {
    return reply({ ok: false, error: "completed_work_confirmation_required" }, 400);
  }

  const table = bookingType === "service" ? "service_bookings" : "dispatch_bookings";
  const { data: booking, error: lookupError } = await admin
    .from(table)
    .select("id,provider_id,payment_status,booking_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (lookupError) return reply({ ok: false, error: "booking_lookup_unavailable" }, 503);
  if (!booking || booking.provider_id !== user.id)
    return reply({ ok: false, error: "booking_not_assigned_to_provider" }, 403);
  if (booking.payment_status !== "paid" ||
      ["cancelled", "canceled", "disputed", "refunded"].includes(String(booking.booking_status))) {
    return reply({ ok: false, error: "paid_active_booking_required" }, 409);
  }

  const { data: result, error: verifyError } = await admin.rpc(
    "shopdrop_confirm_provider_completion_pin",
    {
      p_booking_type: bookingType,
      p_booking_id: bookingId,
      p_provider_id: user.id,
      p_pin: completionPin,
    },
  );
  if (verifyError) {
    return reply({ ok: false, error: "completion_verification_or_hold_failed" }, 409);
  }
  if (result?.verified !== true) {
    return reply({
      ok: false, verified: false,
      error: String(result?.reason ?? "completion_pin_not_accepted"),
      funds_moved: false,
    }, 409);
  }
  return reply({
    ok: true,
    verified: true,
    booking_type: bookingType,
    booking_id: bookingId,
    already_verified: result?.already_verified === true,
    release_request_id: result?.request_id ?? null,
    release_status: result?.release_status ?? "awaiting_activation",
    payment_provider_activation_pending: true,
    funds_moved: false,
  });
});

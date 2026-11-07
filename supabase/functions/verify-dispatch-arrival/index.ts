
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R22B-DISPATCH-ARRIVAL-PIN-V3";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify({
      version: VERSION,
      ...body,
    }),
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS,
    });
  }

  if (req.method !== "POST") {
    return reply(
      {
        ok: false,
        error: "method_not_allowed",
      },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return reply(
      {
        ok: false,
        error: "backend_configuration_error",
      },
      500,
    );
  }

  const authorization =
    req.headers.get("Authorization");

  if (
    !authorization ||
    !/^Bearer\s+\S+$/i.test(authorization)
  ) {
    return reply(
      {
        ok: false,
        error: "authentication_required",
      },
      401,
    );
  }

  const db = adminClient();

  const token = authorization.replace(
    /^Bearer\s+/i,
    "",
  );

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return reply(
      {
        ok: false,
        error: "invalid_authentication",
      },
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
      return reply(
        {
          ok: false,
          error: "invalid_json",
        },
        400,
      );
    }

    input = parsed;
  } catch {
    return reply(
      {
        ok: false,
        error: "invalid_json",
      },
      400,
    );
  }

  // New dispatch booking contract.
  // Legacy dispatch_job_id is not trusted
  // as a dispatch_bookings identifier.

  const bookingId = String(
    input.booking_id ??
    input.bookingId ??
    "",
  ).trim();

  const arrivalCode = String(
    input.arrival_code ??
    input.verification_code ??
    input.pin ??
    "",
  ).trim();

  if (!isUuid(bookingId)) {
    return reply(
      {
        ok: false,
        error: "valid_dispatch_booking_id_required",
      },
      400,
    );
  }

  if (!/^[0-9]{6}$/.test(arrivalCode)) {
    return reply(
      {
        ok: false,
        error: "six_digit_arrival_pin_required",
      },
      400,
    );
  }

  // Provider identity comes from the
  // authenticated Supabase user.
  // Never trust provider_id from the browser.

  const {
    data: booking,
    error: bookingError,
  } = await db
    .from("dispatch_bookings")
    .select(
      "id, provider_id, payment_status, booking_status",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error(
      VERSION,
      "dispatch booking lookup failed",
      bookingError,
    );

    return reply(
      {
        ok: false,
        error: "dispatch_booking_lookup_failed",
      },
      500,
    );
  }

  if (!booking) {
    return reply(
      {
        ok: false,
        error: "dispatch_booking_not_found",
      },
      404,
    );
  }

  if (booking.provider_id !== user.id) {
    return reply(
      {
        ok: false,
        error: "provider_not_authorized",
      },
      403,
    );
  }

  if (
    booking.payment_status !== "paid" ||
    booking.booking_status === "cancelled" ||
    booking.booking_status === "disputed"
  ) {
    return reply(
      {
        ok: false,
        error: "paid_active_booking_required",
      },
      409,
    );
  }

  // Fix 21X performs atomic PIN verification,
  // expiry checks and attempt limits.

  const {
    data: verified,
    error: verificationError,
  } = await db.rpc(
    "shopdrop_verify_dispatch_arrival_pin",
    {
      p_booking_id: bookingId,
      p_provider_id: user.id,
      p_pin: arrivalCode,
    },
  );

  if (verificationError) {
    console.error(
      VERSION,
      "dispatch arrival verification failed",
      verificationError,
    );

    return reply(
      {
        ok: false,
        error: "dispatch_arrival_verification_failed",
      },
      500,
    );
  }

  if (verified !== true) {
    return reply(
      {
        ok: false,
        verified: false,
        error: "invalid_expired_or_used_arrival_pin",
      },
      403,
    );
  }

  // Arrival is recorded in the database.
  // The payout worker must apply all
  // financial and security safeguards.

  return reply({
    ok: true,
    verified: true,
    booking_id: bookingId,
    result: "arrival_verified",
    verified_at: new Date().toISOString(),
    payout_status: "awaiting_payout_safeguards",
  });
});


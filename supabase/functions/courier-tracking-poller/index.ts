
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-COURIER-TRACKING-POLLER-BC3";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const DELIVERY_WORKER_URL =
  `${SUPABASE_URL}/functions/v1/delivery-verification-worker`;

const db =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

type Row = Record<string, any>;

function response(
  body: Row,
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
        "content-type":
          "application/json; charset=utf-8",
        "cache-control":
          "no-store",
      },
    },
  );
}

function text(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}

function providerCode(
  value: unknown,
) {
  return text(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]/g,
      "",
    );
}

function envPart(
  value: string,
) {
  return value
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      "_",
    );
}

function normalizeStatus(
  value: unknown,
) {
  const status =
    text(value)
      .toLowerCase()
      .replace(
        /[\s.-]+/g,
        "_",
      );

  if (
    [
      "picked_up",
      "pickup_complete",
      "collected",
    ].includes(status)
  ) {
    return "collected";
  }

  if (
    [
      "in_transit",
      "transit",
      "shipped",
      "moving",
    ].includes(status)
  ) {
    return "in_transit";
  }

  if (
    [
      "out_for_delivery",
      "with_driver",
    ].includes(status)
  ) {
    return "out_for_delivery";
  }

  if (
    [
      "delivered",
      "delivery_completed",
      "completed",
    ].includes(status)
  ) {
    return "delivered";
  }

  if (
    [
      "delivery_failed",
      "failed_delivery",
      "undeliverable",
    ].includes(status)
  ) {
    return "delivery_failed";
  }

  if (
    [
      "lost",
      "parcel_lost",
    ].includes(status)
  ) {
    return "lost";
  }

  if (
    [
      "returned_to_sender",
      "return_to_sender",
    ].includes(status)
  ) {
    return "returned_to_sender";
  }

  return status;
}

/*
 * ============================================================
 * BACKEND WORKER AUTHENTICATION
 * ============================================================
 */

async function backendAuthorized(
  req: Request,
) {
  const workerToken =
    text(
      req.headers.get(
        "x-shopdrop-worker-token",
      ),
    );

  if (!workerToken) {
    return false;
  }

  const {
    data,
    error,
  } =
    await db.rpc(
      "verify_courier_tracking_worker_token",
      {
        p_token:
          workerToken,
      },
    );

  if (error) {
    console.error(
      VERSION,
      "worker token verification failed",
      error.message,
    );

    return false;
  }

  return data === true;
}

/*
 * ============================================================
 * ACTIVE SHIPMENTS
 * ============================================================
 */

async function getActiveShipments(
  limit = 50,
) {
  const {
    data,
    error,
  } =
    await db
      .from("shipments")
      .select("*")
      .not(
        "tracking_number",
        "is",
        null,
      )
      .not(
        "shipment_status",
        "in",
        '("delivered","delivery_failed","lost","returned_to_sender","cancelled")',
      )
      .order(
        "updated_at",
        {
          ascending: true,
        },
      )
      .limit(limit);

  if (error) {
    throw new Error(
      `active_shipment_lookup_failed:${error.message}`,
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

function shipmentProvider(
  shipment: Row,
) {
  return providerCode(
    shipment.courier_code ??
    shipment.provider_code ??
    shipment.courier ??
    shipment.provider,
  );
}

function adapterConfig(
  provider: string,
) {
  if (!provider) {
    return {
      url: "",
      secret: "",
    };
  }

  const suffix =
    envPart(provider);

  return {
    url:
      (
        Deno.env.get(
          `COURIER_ADAPTER_URL_${suffix}`,
        ) ?? ""
      ).trim(),

    secret:
      (
        Deno.env.get(
          `COURIER_ADAPTER_SECRET_${suffix}`,
        ) ?? ""
      ).trim(),
  };
}

/*
 * ============================================================
 * BUYER FOR SHIPMENT
 * ============================================================
 */

async function getBuyerId(
  shipment: Row,
) {
  if (shipment.buyer_id) {
    return shipment.buyer_id;
  }

  const {
    data,
    error,
  } =
    await db
      .from("orders")
      .select("buyer_id")
      .eq(
        "id",
        shipment.order_id,
      )
      .maybeSingle();

  if (
    error ||
    !data?.buyer_id
  ) {
    throw new Error(
      "shipment_buyer_not_found",
    );
  }

  return data.buyer_id;
}

// END BLOCK 1
/*
 * ============================================================
 * METHOD B — QUERY EXISTING COURIER ADAPTER
 * ============================================================
 */

async function pollProvider(
  shipment: Row,
  provider: string,
) {
  const config =
    adapterConfig(
      provider,
    );

  if (
    !config.url ||
    !config.secret
  ) {
    return {
      ok: false,
      fallback_required:
        true,
      error:
        "courier_tracking_adapter_not_available",
    };
  }

  let res: Response;

  try {
    res =
      await fetch(
        config.url,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            "authorization":
              `Bearer ${config.secret}`,

            "x-shopdrop-action":
              "track",
          },

          body:
            JSON.stringify({
              action:
                "track",

              provider,

              shipment_id:
                shipment.id,

              tracking_number:
                shipment.tracking_number,

              order_id:
                shipment.order_id,

              seller_id:
                shipment.seller_id,
            }),
        },
      );
  } catch (e) {
    return {
      ok: false,

      retryable:
        true,

      fallback_required:
        false,

      error:
        `courier_adapter_network_error:${
          e instanceof Error
            ? e.message
            : String(e)
        }`,
    };
  }

  const raw =
    await res.text();

  let data: Row = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    data = {
      raw_response:
        raw.slice(
          0,
          4000,
        ),
    };
  }

  if (!res.ok) {
    const unsupported =
      res.status === 404 ||
      res.status === 405 ||
      res.status === 501;

    return {
      ok: false,

      retryable:
        !unsupported,

      fallback_required:
        unsupported,

      error:
        `courier_adapter_http_${res.status}`,
    };
  }

  const status =
    normalizeStatus(
      data.status ??
      data.tracking_status,
    );

  if (!status) {
    return {
      ok: false,

      retryable:
        false,

      fallback_required:
        true,

      error:
        "courier_tracking_status_unavailable",
    };
  }

  return {
    ok: true,

    provider,

    status,

    evidence_reference:
      text(
        data.provider_event_id ??
        data.event_id ??
        data.delivery_reference ??
        data.tracking_event_id ??
        shipment.tracking_number,
      ),

    location:
      data.location ??
      null,

    description:
      data.description ??
      null,
  };
}

/*
 * ============================================================
 * RECORD METHOD B TRACKING
 * ============================================================
 */

async function recordTracking(
  shipment: Row,
  result: Row,
) {
  const {
    error,
  } =
    await db
      .from("shipment_events")
      .insert({
        shipment_id:
          shipment.id,

        event_type:
          result.status,

        event_time:
          new Date()
            .toISOString(),

        event_data: {
          provider:
            result.provider,

          provider_event_id:
            result
              .evidence_reference,

          tracking_number:
            shipment
              .tracking_number,

          location:
            result.location,

          description:
            result.description,

          source:
            "automatic_courier_tracking_poller",
        },

        created_at:
          new Date()
            .toISOString(),
      });

  if (error) {
    throw new Error(
      `tracking_event_insert_failed:${error.message}`,
    );
  }
}

/*
 * ============================================================
 * METHOD B — DELIVERED -> COMMON GATEWAY
 * ============================================================
 */

async function confirmApiDelivery(
  shipment: Row,
  result: Row,
) {
  let res: Response;

  try {
    res =
      await fetch(
        DELIVERY_WORKER_URL,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            "authorization":
              `Bearer ${SERVICE_ROLE_KEY}`,
          },

          body:
            JSON.stringify({
              method:
                "courier_api",

              shipment_id:
                shipment.id,

              provider:
                result.provider,

              status:
                "delivered",

              provider_event_id:
                result
                  .evidence_reference,

              tracking_number:
                shipment
                  .tracking_number,
            }),
        },
      );
  } catch (e) {
    throw new Error(
      `delivery_worker_network_error:${
        e instanceof Error
          ? e.message
          : String(e)
      }`,
    );
  }

  const raw =
    await res.text();

  let data: Row = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      `delivery_worker_rejected:${
        data.error ??
        res.status
      }`,
    );
  }

  return data;
}

/*
 * ============================================================
 * METHOD C — CHECK WHETHER OTP ALREADY EXISTS
 * ============================================================
 */

async function existingOtp(
  shipmentId: string,
) {
  const {
    data,
    error,
  } =
    await db
      .from(
        "delivery_verification_otps",
      )
      .select(
        "id,expires_at,used_at",
      )
      .eq(
        "shipment_id",
        shipmentId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `otp_lookup_failed:${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  if (data.used_at) {
    return {
      active: false,
      used: true,
    };
  }

  const expiry =
    new Date(
      data.expires_at,
    ).getTime();

  if (
    Number.isFinite(expiry) &&
    expiry > Date.now()
  ) {
    return {
      active: true,
      used: false,
    };
  }

  return {
    active: false,
    used: false,
  };
}

/*
 * ============================================================
 * METHOD C — GENERATE + QUEUE BUYER OTP
 * ============================================================
 */

async function activateOtpFallback(
  shipment: Row,
) {
  const buyerId =
    await getBuyerId(
      shipment,
    );

  const existing =
    await existingOtp(
      shipment.id,
    );

  if (
    existing?.active
  ) {
    return {
      ok: true,

      already_active:
        true,

      buyer_id:
        buyerId,

      method:
        "buyer_otp",
    };
  }

  if (
    existing?.used
  ) {
    return {
      ok: true,

      already_verified:
        true,

      buyer_id:
        buyerId,

      method:
        "buyer_otp",
    };
  }

  const {
    data: otp,
    error:
      otpError,
  } =
    await db.rpc(
      "generate_delivery_verification_otp",
      {
        p_shipment_id:
          shipment.id,

        p_buyer_id:
          buyerId,
      },
    );

  if (
    otpError ||
    !otp
  ) {
    throw new Error(
      `delivery_otp_generation_failed:${
        otpError?.message ??
        "missing"
      }`,
    );
  }

  const eventKey =
    `delivery-otp:${shipment.id}`;

  const subject =
    "Shop&Drop delivery verification code";

  const message =
    `Your Shop&Drop delivery verification code is ${otp}. ` +
    `Give this code only when you physically receive your parcel. ` +
    `The code expires in 24 hours and can be used only once.`;

  const {
    error:
      queueError,
  } =
    await db.rpc(
      "enqueue_message",
      {
        p_event_key:
          eventKey,

        p_user_id:
          buyerId,

        p_channel:
          "email",

        p_notification_type:
          "order_update",

        p_subject:
          subject,

        p_message_body:
          message,
      },
    );

  if (queueError) {
    throw new Error(
      `delivery_otp_notification_queue_failed:${queueError.message}`,
    );
  }

  return {
    ok: true,

    activated:
      true,

    buyer_id:
      buyerId,

    method:
      "buyer_otp",

    notification:
      "queued_email",
  };
}

// END BLOCK 2
/*
 * ============================================================
 * NON-DELIVERED METHOD B STATUS
 * ============================================================
 */

async function updateShipmentStatus(
  shipment: Row,
  status: string,
) {
  if (status === "delivered") return;

  const { error } = await db
    .from("shipments")
    .update({
      shipment_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shipment.id);

  if (error) {
    throw new Error(
      `shipment_status_update_failed:${error.message}`,
    );
  }
}

/*
 * ============================================================
 * PROCESS ONE SHIPMENT
 * METHOD B -> METHOD C FALLBACK
 * ============================================================
 */

async function processShipment(
  shipment: Row,
) {
  const provider =
    shipmentProvider(shipment);

  /*
   * No electronically trackable courier:
   * use Method C automatically.
   */

  if (!provider) {
    const otp =
      await activateOtpFallback(
        shipment,
      );

    return {
      shipment_id: shipment.id,
      ok: true,
      selected_method: "buyer_otp",
      reason:
        "courier_provider_not_electronically_trackable",
      otp,
    };
  }

  /*
   * Try Method B.
   */

  const tracking =
    await pollProvider(
      shipment,
      provider,
    );

  /*
   * Courier cannot provide electronic tracking:
   * automatically use Method C.
   */

  if (
    !tracking.ok &&
    tracking.fallback_required
  ) {
    const otp =
      await activateOtpFallback(
        shipment,
      );

    return {
      shipment_id: shipment.id,
      ok: true,
      provider,
      selected_method: "buyer_otp",
      reason: tracking.error,
      otp,
    };
  }

  /*
   * Temporary courier/API failure.
   * Keep payout locked and retry later.
   */

  if (!tracking.ok) {
    return {
      shipment_id: shipment.id,
      ok: false,
      provider,
      selected_method: "courier_api",
      retryable:
        tracking.retryable === true,
      delivery_verified: false,
      seller_payout_released: false,
      error: tracking.error,
    };
  }

  /*
   * Record Method B tracking event.
   */

  await recordTracking(
    shipment,
    tracking,
  );

  /*
   * Courier confirms delivery.
   */

  if (
    tracking.status ===
    "delivered"
  ) {
    const delivery =
      await confirmApiDelivery(
        shipment,
        tracking,
      );

    return {
      shipment_id: shipment.id,
      ok: true,
      provider,
      selected_method: "courier_api",
      status: "delivered",
      delivery_verified: true,
      direct_seller_payout: false,
      payout_eligibility:
        "handled_by_delivery_verification_worker",
      delivery_worker: delivery,
    };
  }

  /*
   * Shipment still moving.
   */

  await updateShipmentStatus(
    shipment,
    tracking.status,
  );

  return {
    shipment_id: shipment.id,
    ok: true,
    provider,
    selected_method: "courier_api",
    status: tracking.status,
    delivery_verified: false,
    seller_payout_released: false,
  };
}

/*
 * ============================================================
 * AUTOMATIC B + C COORDINATOR
 * ============================================================
 */

Deno.serve(async (req) => {
  /*
   * POST only.
   */

  if (req.method !== "POST") {
    return response(
      {
        ok: false,
        error: "method_not_allowed",
      },
      405,
    );
  }

  /*
   * Required Supabase backend configuration.
   */

  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY
  ) {
    return response(
      {
        ok: false,
        error:
          "backend_configuration_error",
      },
      500,
    );
  }

  /*
   * Validate hidden Vault worker token.
   */

  let authorized = false;

  try {
    authorized =
      await backendAuthorized(req);
  } catch (e) {
    console.error(
      VERSION,
      "worker authorization error",
      e instanceof Error
        ? e.message
        : String(e),
    );

    return response(
      {
        ok: false,
        error:
          "worker_authorization_error",
      },
      500,
    );
  }

  if (!authorized) {
    return response(
      {
        ok: false,
        error:
          "backend_authorization_required",
      },
      401,
    );
  }

  /*
   * Find active shipments.
   */

  let shipments: Row[];

  try {
    shipments =
      await getActiveShipments(50);
  } catch (e) {
    return response(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : String(e),
      },
      500,
    );
  }

  /*
   * Nothing currently requires processing.
   */

  if (shipments.length === 0) {
    return response({
      ok: true,
      authorized: true,
      checked: 0,
      method_b: 0,
      method_c: 0,
      delivered: 0,
      failures: 0,
      message:
        "No active courier shipments require processing.",
    });
  }

  /*
   * Process each shipment independently.
   */

  const results: Row[] = [];

  for (const shipment of shipments) {
    try {
      results.push(
        await processShipment(
          shipment,
        ),
      );
    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      console.error(
        VERSION,
        "shipment processing failed",
        shipment.id,
        reason,
      );

      results.push({
        shipment_id: shipment.id,
        ok: false,
        delivery_verified: false,
        seller_payout_released: false,
        error: reason,
      });
    }
  }

  /*
   * Summarise this automatic run.
   */

  const methodB =
    results.filter(
      (r) =>
        r.selected_method ===
        "courier_api",
    ).length;

  const methodC =
    results.filter(
      (r) =>
        r.selected_method ===
        "buyer_otp",
    ).length;

  const delivered =
    results.filter(
      (r) =>
        r.delivery_verified === true,
    ).length;

  const failures =
    results.filter(
      (r) =>
        r.ok !== true,
    ).length;

  /*
   * Successful automatic worker execution.
   */

  return response({
    ok: true,
    authorized: true,
    checked: shipments.length,
    method_b: methodB,
    method_c: methodC,
    delivered,
    failures,
    results,

    automatic_chain: {
      administrator_required: false,
      authentication:
        "vault_worker_token",
      method_b:
        "automatic_courier_api_tracking",
      method_c:
        "automatic_buyer_otp_fallback",
      delivery_gateway:
        "delivery-verification-worker",
      direct_seller_payout: false,
      seller_payout_requires_verified_delivery:
        true,
    },
  });
});


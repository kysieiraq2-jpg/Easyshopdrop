import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-COURIER-TRACKING-WEBHOOK-A2";

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
  return String(value ?? "").trim();
}

function normalize(
  value: unknown,
) {
  return text(value)
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");
}

function providerCode(
  value: unknown,
) {
  return normalize(value)
    .replace(
      /[^a-z0-9_-]/g,
      "",
    );
}

function normalizeStatus(
  value: unknown,
) {
  const status =
    normalize(value);

  if (
    [
      "picked_up",
      "pickup_complete",
      "collected",
      "collection_complete",
    ].includes(status)
  ) {
    return "collected";
  }

  if (
    [
      "in_transit",
      "transit",
      "moving",
      "shipped",
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

function secretName(
  provider: string,
) {
  return `COURIER_WEBHOOK_SECRET_${provider
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      "_",
    )}`;
}

function safeEqual(
  a: string,
  b: string,
) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}

async function sha256(
  value: string,
) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder()
        .encode(value),
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map(
      (b) =>
        b
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}

/*
 * ============================================================
 * VERIFY ORIGINAL RAW COURIER REQUEST
 *
 * IMPORTANT:
 *
 * Signature is checked against rawBody BEFORE Shop&Drop
 * modifies or forwards anything.
 *
 * Until a real courier provider is activated/configured,
 * the request fails closed.
 * ============================================================
 */

async function verifyCourierRequest(
  provider: string,
  rawBody: string,
  signature: string,
) {
  const secret =
    Deno.env.get(
      secretName(provider),
    )?.trim() ?? "";

  if (!secret) {
    return {
      ok: false,
      activation_required:
        true,
      error:
        "courier_provider_not_activated",
    };
  }

  if (!signature) {
    return {
      ok: false,
      activation_required:
        false,
      error:
        "missing_courier_signature",
    };
  }

  const expected =
    await sha256(
      `${secret}:${rawBody}`,
    );

  if (
    !safeEqual(
      expected,
      signature,
    )
  ) {
    return {
      ok: false,
      activation_required:
        false,
      error:
        "invalid_courier_signature",
    };
  }

  return {
    ok: true,
    activation_required:
      false,
    error: "",
  };
}

/*
 * ============================================================
 * FIND EXACT SHIPMENT
 * ============================================================
 */

async function findShipment(
  provider: string,
  trackingNumber: string,
) {
  const {
    data,
    error,
  } =
    await db
      .from("shipments")
      .select("*")
      .eq(
        "tracking_number",
        trackingNumber,
      )
      .limit(2);

  if (error) {
    throw new Error(
      `shipment_lookup_failed:${error.message}`,
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "shipment_not_found",
    );
  }

  if (data.length > 1) {
    throw new Error(
      "tracking_number_not_unique",
    );
  }

  const shipment =
    data[0];

  const storedProvider =
    providerCode(
      shipment.courier_code ??
      shipment.provider_code ??
      shipment.courier ??
      shipment.provider,
    );

  if (
    storedProvider &&
    storedProvider !== provider
  ) {
    throw new Error(
      "courier_provider_shipment_mismatch",
    );
  }

  return shipment;
}

/*
 * ============================================================
 * DUPLICATE TRACKING EVENT CHECK
 * ============================================================
 */

async function eventExists(
  shipmentId: string,
  provider: string,
  eventId: string,
) {
  if (!eventId) {
    return false;
  }

  const {
    data,
    error,
  } =
    await db
      .from("shipment_events")
      .select("id")
      .eq(
        "shipment_id",
        shipmentId,
      )
      .contains(
        "event_data",
        {
          provider,
          provider_event_id:
            eventId,
        },
      )
      .limit(1);

  if (error) {
    throw new Error(
      `tracking_idempotency_lookup_failed:${error.message}`,
    );
  }

  return (
    Array.isArray(data) &&
    data.length > 0
  );
}

// END BLOCK 1
/*
 * ============================================================
 * RECORD TRACKING EVENT
 * ============================================================
 */

async function recordTrackingEvent(
  shipment: Row,
  provider: string,
  eventId: string,
  status: string,
  body: Row,
) {
  const eventTime =
    text(
      body.event_time ??
      body.occurred_at,
    ) ||
    new Date().toISOString();

  const {
    error,
  } =
    await db
      .from("shipment_events")
      .insert({
        shipment_id:
          shipment.id,

        event_type:
          status,

        event_time:
          eventTime,

        event_data: {
          provider,

          provider_event_id:
            eventId || null,

          tracking_number:
            shipment.tracking_number,

          location:
            body.location ?? null,

          description:
            body.description ?? null,

          source:
            "authenticated_courier_webhook",
        },

        created_at:
          new Date().toISOString(),
      });

  if (error) {
    throw new Error(
      `tracking_event_record_failed:${error.message}`,
    );
  }
}

/*
 * ============================================================
 * UPDATE NON-DELIVERED TRACKING STATE
 *
 * Delivered is NOT written here.
 *
 * The delivery-verification-worker owns authoritative
 * delivery confirmation.
 * ============================================================
 */

async function updateTrackingState(
  shipment: Row,
  status: string,
) {
  if (status === "delivered") {
    return;
  }

  const {
    error,
  } =
    await db
      .from("shipments")
      .update({
        status,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        shipment.id,
      );

  if (error) {
    throw new Error(
      `shipment_tracking_update_failed:${error.message}`,
    );
  }
}

/*
 * ============================================================
 * TRUSTED INTERNAL DELIVERY CALL
 *
 * Courier request has ALREADY been authenticated against its
 * original raw request body.
 *
 * The internal Shop&Drop call uses the protected backend
 * courier_api route in delivery-verification-worker.
 *
 * This avoids trying to verify a courier signature against a
 * modified JSON body.
 * ============================================================
 */

async function sendDeliveredToGateway(
  shipment: Row,
  provider: string,
  body: Row,
) {
  const eventReference =
    text(
      body.provider_event_id ??
      body.event_id ??
      body.delivery_reference ??
      body.tracking_number,
    );

  if (!eventReference) {
    throw new Error(
      "delivery_evidence_reference_required",
    );
  }

  const payload = {
    method:
      "courier_api",

    shipment_id:
      shipment.id,

    provider,

    status:
      "delivered",

    provider_event_id:
      eventReference,

    tracking_number:
      shipment.tracking_number,
  };

  let result:
    Response;

  try {
    result =
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
            JSON.stringify(payload),
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
    await result.text();

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

  if (!result.ok) {
    throw new Error(
      `delivery_worker_rejected:${
        data.error ??
        result.status
      }`,
    );
  }

  return data;
}

/*
 * ============================================================
 * TERMINAL NON-DELIVERY
 *
 * Only definitive failure states enter Shop&Drop's existing
 * exact seller-product refund foundation.
 *
 * Delay / in-transit does NOT refund.
 * ============================================================
 */

async function handleNonDelivery(
  shipment: Row,
  status: string,
  body: Row,
) {
  if (
    ![
      "delivery_failed",
      "lost",
      "returned_to_sender",
    ].includes(status)
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await db
      .from("fulfilment_groups")
      .select("*")
      .eq(
        "order_id",
        shipment.order_id,
      )
      .eq(
        "seller_id",
        shipment.seller_id,
      )
      .limit(2);

  if (error) {
    throw new Error(
      `fulfilment_group_lookup_failed:${error.message}`,
    );
  }

  if (
    !Array.isArray(data) ||
    data.length !== 1
  ) {
    throw new Error(
      "exact_fulfilment_group_required",
    );
  }

  const evidenceReference =
    text(
      body.provider_event_id ??
      body.event_id ??
      body.tracking_number,
    );

  const {
    data: refund,
    error: refundError,
  } =
    await db.rpc(
      "create_non_delivery_refund",
      {
        p_fulfilment_group_id:
          data[0].id,

        p_terminal_delivery_status:
          status,

        p_evidence_reference:
          evidenceReference ||
          null,
      },
    );

  if (refundError) {
    throw new Error(
      `non_delivery_refund_creation_failed:${refundError.message}`,
    );
  }

  return refund;
}

// END BLOCK 2
/*
 * ============================================================
 * METHOD A — AUTHENTICATED COURIER TRACKING WEBHOOK
 *
 * This function NEVER directly makes seller money eligible.
 *
 * delivered:
 * authenticated courier
 * -> trusted internal delivery gateway
 * -> exact shipment confirmation
 * -> exact seller payout eligibility
 *
 * terminal non-delivery:
 * -> exact seller product refund foundation
 * ============================================================
 */

Deno.serve(
  async (req) => {
    if (
      req.method !== "POST"
    ) {
      return response(
        {
          ok: false,
          error:
            "method_not_allowed",
        },
        405,
      );
    }

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

    const rawBody =
      await req.text();

    if (!rawBody) {
      return response(
        {
          ok: false,
          error:
            "empty_request_body",
        },
        400,
      );
    }

    let body: Row;

    try {
      body =
        JSON.parse(rawBody);
    } catch {
      return response(
        {
          ok: false,
          error:
            "invalid_json",
        },
        400,
      );
    }

    const provider =
      providerCode(
        body.provider ??
        body.courier,
      );

    const trackingNumber =
      text(
        body.tracking_number,
      );

    const status =
      normalizeStatus(
        body.status,
      );

    const eventId =
      text(
        body.provider_event_id ??
        body.event_id,
      );

    if (!provider) {
      return response(
        {
          ok: false,
          error:
            "courier_provider_required",
        },
        400,
      );
    }

    if (!trackingNumber) {
      return response(
        {
          ok: false,
          error:
            "tracking_number_required",
        },
        400,
      );
    }

    if (!status) {
      return response(
        {
          ok: false,
          error:
            "tracking_status_required",
        },
        400,
      );
    }

    /*
     * ========================================================
     * AUTHENTICATE ORIGINAL RAW COURIER REQUEST
     *
     * Authentication happens BEFORE:
     *
     * tracking is recorded
     * shipment state changes
     * delivery confirmation
     * refund creation
     * seller payout eligibility
     * ========================================================
     */

    const signature =
      text(
        req.headers.get(
          "x-shopdrop-courier-signature",
        ),
      );

    const verification =
      await verifyCourierRequest(
        provider,
        rawBody,
        signature,
      );

    if (!verification.ok) {
      return response(
        {
          ok: false,

          activation_required:
            verification
              .activation_required,

          provider,

          error:
            verification.error,

          seller_payout_released:
            false,
        },
        verification
          .activation_required
          ? 503
          : 401,
      );
    }

    /*
     * ========================================================
     * EXACT SHIPMENT
     * ========================================================
     */

    let shipment: Row;

    try {
      shipment =
        await findShipment(
          provider,
          trackingNumber,
        );
    } catch (e) {
      return response(
        {
          ok: false,

          error:
            e instanceof Error
              ? e.message
              : String(e),
        },
        404,
      );
    }

    /*
     * ========================================================
     * IDEMPOTENCY
     * ========================================================
     */

    if (eventId) {
      try {
        const duplicate =
          await eventExists(
            shipment.id,
            provider,
            eventId,
          );

        if (duplicate) {
          return response({
            ok: true,

            duplicate:
              true,

            authenticated:
              true,

            shipment_id:
              shipment.id,

            tracking_number:
              trackingNumber,

            status,

            seller_payout_released:
              false,
          });
        }
      } catch (e) {
        return response(
          {
            ok: false,

            authenticated:
              true,

            error:
              e instanceof Error
                ? e.message
                : String(e),
          },
          500,
        );
      }
    }

    /*
     * ========================================================
     * RECORD AUTHENTICATED TRACKING EVENT
     * ========================================================
     */

    try {
      await recordTrackingEvent(
        shipment,
        provider,
        eventId,
        status,
        body,
      );
    } catch (e) {
      return response(
        {
          ok: false,

          authenticated:
            true,

          error:
            e instanceof Error
              ? e.message
              : String(e),
        },
        500,
      );
    }

    /*
     * ========================================================
     * DELIVERED
     *
     * courier-tracking-webhook itself NEVER makes seller
     * payout eligible.
     *
     * It calls the protected common delivery gateway.
     * ========================================================
     */

    if (
      status === "delivered"
    ) {
      try {
        const delivery =
          await sendDeliveredToGateway(
            shipment,
            provider,
            body,
          );

        return response({
          ok: true,

          authenticated:
            true,

          tracking_recorded:
            true,

          delivery_verified:
            true,

          shipment_id:
            shipment.id,

          order_id:
            shipment.order_id,

          seller_id:
            shipment.seller_id,

          tracking_number:
            trackingNumber,

          status,

          direct_payout_from_tracking_webhook:
            false,

          seller_payout_eligibility:
            "handled_by_delivery_verification_worker",

          delivery_worker:
            delivery,
        });

      } catch (e) {
        const reason =
          e instanceof Error
            ? e.message
            : String(e);

        /*
         * Tracking evidence has been recorded, but the common
         * delivery gateway did not complete.
         *
         * NEVER pretend delivery was financially verified.
         * Seller money remains protected.
         */

        return response(
          {
            ok: false,

            authenticated:
              true,

            tracking_recorded:
              true,

            delivery_verified:
              false,

            seller_payout_released:
              false,

            shipment_id:
              shipment.id,

            order_id:
              shipment.order_id,

            seller_id:
              shipment.seller_id,

            tracking_number:
              trackingNumber,

            status,

            reconciliation_required:
              true,

            error:
              reason,
          },
          500,
        );
      }
    }

    /*
     * ========================================================
     * NON-DELIVERED TRACKING STATE
     * ========================================================
     */

    try {
      await updateTrackingState(
        shipment,
        status,
      );
    } catch (e) {
      return response(
        {
          ok: false,

          authenticated:
            true,

          tracking_recorded:
            true,

          seller_payout_released:
            false,

          error:
            e instanceof Error
              ? e.message
              : String(e),
        },
        500,
      );
    }

    /*
     * ========================================================
     * TERMINAL NON-DELIVERY
     *
     * Only terminal courier states enter the existing
     * seller-specific non-delivery refund foundation.
     *
     * Ordinary delays and in-transit events do nothing
     * financially.
     * ========================================================
     */

    let refundResult:
      Row | null = null;

    try {
      refundResult =
        await handleNonDelivery(
          shipment,
          status,
          body,
        );

    } catch (e) {
      return response(
        {
          ok: false,

          authenticated:
            true,

          tracking_recorded:
            true,

          shipment_updated:
            true,

          seller_payout_released:
            false,

          shipment_id:
            shipment.id,

          tracking_number:
            trackingNumber,

          status,

          error:
            e instanceof Error
              ? e.message
              : String(e),
        },
        500,
      );
    }

    /*
     * ========================================================
     * SUCCESS — NON-DELIVERED TRACKING EVENT
     * ========================================================
     */

    return response({
      ok: true,

      authenticated:
        true,

      tracking_recorded:
        true,

      shipment_updated:
        true,

      shipment_id:
        shipment.id,

      order_id:
        shipment.order_id,

      seller_id:
        shipment.seller_id,

      tracking_number:
        trackingNumber,

      status,

      delivery_verified:
        false,

      seller_payout_released:
        false,

      non_delivery_refund:
        refundResult,

      automatic_chain: {
        administrator_required:
          false,

        courier_authenticated:
          true,

        tracking_recorded:
          true,

        direct_seller_payout:
          false,

        delivered_requires_secure_gateway:
          true,

        terminal_non_delivery_uses_refund_foundation:
          true,
      },
    });
  },
);
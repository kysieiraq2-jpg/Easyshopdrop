import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-DELIVERY-VERIFICATION-WORKER-V1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

type Row = Record<string, any>;

function response(body: Row, status = 200) {
  return new Response(
    JSON.stringify({
      version: VERSION,
      ...body,
    }),
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMethod(value: unknown) {
  const method = text(value)
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");

  if (
    [
      "courier",
      "courier_webhook",
      "provider_webhook",
    ].includes(method)
  ) {
    return "courier_webhook";
  }

  if (
    [
      "courier_api",
      "tracking_api",
      "api_poll",
      "polling",
    ].includes(method)
  ) {
    return "courier_api";
  }

  if (
    [
      "otp",
      "buyer_otp",
      "delivery_otp",
    ].includes(method)
  ) {
    return "buyer_otp";
  }

  return method;
}

function providerCode(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function secretName(provider: string) {
  return `COURIER_WEBHOOK_SECRET_${provider
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")}`;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}

async function sha256(value: string) {
  const bytes =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes,
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

async function verifyCourierSignature(
  provider: string,
  rawBody: string,
  suppliedSignature: string,
) {
  const secret =
    Deno.env.get(
      secretName(provider),
    )?.trim() ?? "";

  if (!secret) {
    return {
      ok: false,
      activation_required: true,
      error: "courier_provider_not_activated",
    };
  }

  if (!suppliedSignature) {
    return {
      ok: false,
      activation_required: false,
      error: "missing_courier_signature",
    };
  }

  const expected =
    await sha256(
      `${secret}:${rawBody}`,
    );

  if (
    !safeEqual(
      expected,
      suppliedSignature,
    )
  ) {
    return {
      ok: false,
      activation_required: false,
      error: "invalid_courier_signature",
    };
  }

  return {
    ok: true,
    activation_required: false,
    error: "",
  };
}

async function getShipment(
  shipmentId: string,
) {
  const { data, error } =
    await db
      .from("shipments")
      .select("*")
      .eq("id", shipmentId)
      .maybeSingle();

  if (error || !data) {
    throw new Error(
      `shipment_not_found:${
        error?.message ?? "missing"
      }`,
    );
  }

  return data;
}

async function getFulfilmentGroup(
  shipment: Row,
) {
  if (!shipment.order_id) {
    throw new Error(
      "shipment_order_id_missing",
    );
  }

  if (!shipment.seller_id) {
    throw new Error(
      "shipment_seller_id_missing",
    );
  }

  const { data, error } =
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
    data.length === 0
  ) {
    throw new Error(
      "fulfilment_group_not_found",
    );
  }

  if (data.length > 1) {
    throw new Error(
      "fulfilment_group_not_unique",
    );
  }

  return data[0];
}

async function getBuyerId(
  shipment: Row,
) {
  if (shipment.buyer_id) {
    return shipment.buyer_id;
  }

  const { data, error } =
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
async function verifyBuyerOtp(
  shipment: Row,
  otp: string,
) {
  const buyerId =
    await getBuyerId(shipment);

  if (!otp) {
    throw new Error(
      "delivery_otp_required",
    );
  }

  const { data, error } =
    await db.rpc(
      "verify_delivery_verification_otp",
      {
        p_shipment_id:
          shipment.id,
        p_buyer_id:
          buyerId,
        p_otp:
          otp,
      },
    );

  if (error) {
    throw new Error(
      `delivery_otp_verification_failed:${error.message}`,
    );
  }

  if (data !== true) {
    throw new Error(
      "invalid_or_expired_delivery_otp",
    );
  }

  return {
    verified: true,
    method: "buyer_otp",
    buyer_id: buyerId,
    evidence_reference:
      `OTP:${shipment.id}`,
  };
}

async function verifyCourierWebhook(
  body: Row,
  rawBody: string,
  signature: string,
) {
  const provider =
    providerCode(
      body.provider ??
      body.courier,
    );

  if (!provider) {
    throw new Error(
      "courier_provider_required",
    );
  }

  const verification =
    await verifyCourierSignature(
      provider,
      rawBody,
      signature,
    );

  if (!verification.ok) {
    const error =
      new Error(
        verification.error,
      ) as Error & {
        activation_required?: boolean;
      };

    error.activation_required =
      verification.activation_required;

    throw error;
  }

  const status =
    text(body.status)
      .toLowerCase()
      .replace(
        /[\s.-]+/g,
        "_",
      );

  if (
    ![
      "delivered",
      "delivery_completed",
      "completed",
    ].includes(status)
  ) {
    throw new Error(
      "courier_has_not_confirmed_delivery",
    );
  }

  const eventId =
    text(
      body.provider_event_id ??
      body.event_id ??
      body.delivery_reference ??
      body.tracking_number,
    );

  if (!eventId) {
    throw new Error(
      "courier_delivery_evidence_reference_required",
    );
  }

  return {
    verified: true,
    method: "courier_webhook",
    provider,
    evidence_reference:
      `COURIER:${provider}:${eventId}`,
  };
}

async function verifyCourierApi(
  req: Request,
  body: Row,
) {
  const authorization =
    text(
      req.headers.get(
        "authorization",
      ),
    );

  const expected =
    `Bearer ${SERVICE_ROLE_KEY}`;

  if (
    !SERVICE_ROLE_KEY ||
    !safeEqual(
      authorization,
      expected,
    )
  ) {
    throw new Error(
      "backend_authorization_required",
    );
  }

  const provider =
    providerCode(
      body.provider ??
      body.courier,
    );

  if (!provider) {
    throw new Error(
      "courier_provider_required",
    );
  }

  const status =
    text(body.status)
      .toLowerCase()
      .replace(
        /[\s.-]+/g,
        "_",
      );

  if (
    ![
      "delivered",
      "delivery_completed",
      "completed",
    ].includes(status)
  ) {
    throw new Error(
      "courier_api_has_not_confirmed_delivery",
    );
  }

  const reference =
    text(
      body.provider_event_id ??
      body.delivery_reference ??
      body.tracking_number,
    );

  if (!reference) {
    throw new Error(
      "courier_api_evidence_reference_required",
    );
  }

  return {
    verified: true,
    method: "courier_api",
    provider,
    evidence_reference:
      `API:${provider}:${reference}`,
  };
}

async function completeVerifiedDelivery(
  shipment: Row,
  group: Row,
  verification: Row,
) {
  const now =
    new Date().toISOString();

  const {
    data: deliveryResult,
    error: deliveryError,
  } =
    await db.rpc(
      "confirm_shipment_delivery",
      {
        p_shipment_id:
          shipment.id,
        p_delivery_evidence_reference:
          verification
            .evidence_reference,
      },
    );

  if (deliveryError) {
    throw new Error(
      `shipment_delivery_confirmation_failed:${deliveryError.message}`,
    );
  }

  const buyerId =
    await getBuyerId(shipment);

  const {
    data: existingConfirmation,
    error: lookupError,
  } =
    await db
      .from(
        "delivery_confirmations",
      )
      .select("id")
      .eq(
        "shipment_id",
        shipment.id,
      )
      .limit(1);

  if (lookupError) {
    throw new Error(
      `delivery_confirmation_lookup_failed:${lookupError.message}`,
    );
  }

  if (
    Array.isArray(
      existingConfirmation,
    ) &&
    existingConfirmation.length > 0
  ) {
    const { error } =
      await db
        .from(
          "delivery_confirmations",
        )
        .update({
          delivery_status:
            "delivered",
          delivered_at:
            now,
          confirmed_at:
            now,
          confirmation_method:
            verification.method,
          notes:
            `Verified delivery: ${verification.evidence_reference}`,
        })
        .eq(
          "id",
          existingConfirmation[0].id,
        );

    if (error) {
      throw new Error(
        `delivery_confirmation_update_failed:${error.message}`,
      );
    }
  } else {
    const { error } =
      await db
        .from(
          "delivery_confirmations",
        )
        .insert({
          order_id:
            shipment.order_id,
          shipment_id:
            shipment.id,
          buyer_id:
            buyerId,
          delivery_status:
            "delivered",
          delivered_at:
            now,
          confirmed_at:
            now,
          confirmation_method:
            verification.method,
          notes:
            `Verified delivery: ${verification.evidence_reference}`,
          created_at:
            now,
        });

    if (error) {
      throw new Error(
        `delivery_confirmation_insert_failed:${error.message}`,
      );
    }
  }

  const {
    data: payoutResult,
    error: payoutError,
  } =
    await db.rpc(
      "mark_seller_allocation_payout_eligible",
      {
        p_order_id:
          shipment.order_id,
        p_seller_id:
          shipment.seller_id,
        p_fulfilment_group_id:
          group.id,
      },
    );

  if (payoutError) {
    throw new Error(
      `seller_payout_eligibility_failed:${payoutError.message}`,
    );
  }

  const {
    error: groupError,
  } =
    await db
      .from(
        "fulfilment_groups",
      )
      .update({
        status:
          "delivered",
      })
      .eq(
        "id",
        group.id,
      );

  if (groupError) {
    throw new Error(
      `fulfilment_group_delivery_update_failed:${groupError.message}`,
    );
  }

  // Fix 27: Queue notifications only after
  // authoritative delivery completion.
  // Duplicate events use stable event keys.
  // Notification failures never reverse delivery.
  const recipients = [
    {
      userId: buyerId,
      type: "delivery_verified",
      role: "buyer",
      subject: "Shop&Drop delivery confirmed",
      message:
        `Your order ${shipment.order_id} has been delivered and verified.`,
    },
    {
      userId: shipment.seller_id,
      type: "delivery_verified",
      role: "seller",
      subject: "Shop&Drop delivery verified",
      message:
        `Delivery for order ${shipment.order_id} has been verified. Your seller payout is now eligible for automatic processing, subject to provider and safety checks. Payment completion will be confirmed separately.`,
    },
  ];

  for (const recipient of recipients) {
    if (!recipient.userId) continue;

    for (const channel of ["in_app", "email"]) {
      const { error: noticeError } =
        await db.rpc("enqueue_message", {
          p_user_id: recipient.userId,
          p_event_key:
            `delivery:${shipment.id}:verified:${recipient.role}`,
          p_channel: channel,
          p_notification_type: recipient.type,
          p_subject: recipient.subject,
          p_message_body: recipient.message,
        });

      if (noticeError) {
        console.error(
          VERSION,
          "delivery_notification_enqueue_failed",
          recipient.role,
          channel,
          noticeError.code,
        );
      }
    }
  }

  return {
    delivery:
      deliveryResult,
    payout_eligibility:
      payoutResult,
  };
}

// END BLOCK 2
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

    const method =
      normalizeMethod(
        body.method,
      );

    if (
      ![
        "courier_webhook",
        "courier_api",
        "buyer_otp",
      ].includes(method)
    ) {
      return response(
        {
          ok: false,
          error:
            "unsupported_delivery_verification_method",
        },
        400,
      );
    }

    const shipmentId =
      text(
        body.shipment_id,
      );

    if (!shipmentId) {
      return response(
        {
          ok: false,
          error:
            "shipment_id_required",
        },
        400,
      );
    }

    let shipment: Row;
    let group: Row;

    try {
      shipment =
        await getShipment(
          shipmentId,
        );

      group =
        await getFulfilmentGroup(
          shipment,
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

    let verification: Row;

    try {
      if (
        method ===
        "buyer_otp"
      ) {
        verification =
          await verifyBuyerOtp(
            shipment,
            text(body.otp),
          );
      } else if (
        method ===
        "courier_webhook"
      ) {
        verification =
          await verifyCourierWebhook(
            body,
            rawBody,
            text(
              req.headers.get(
                "x-shopdrop-courier-signature",
              ),
            ),
          );
      } else {
        verification =
          await verifyCourierApi(
            req,
            body,
          );
      }
    } catch (e) {
      const error =
        e instanceof Error
          ? e
          : new Error(
              String(e),
            );

      const activationRequired =
        (
          error as Error & {
            activation_required?: boolean;
          }
        ).activation_required ===
          true;

      return response(
        {
          ok: false,
          activation_required:
            activationRequired,
          method,
          error:
            error.message,
        },
        activationRequired
          ? 503
          : 401,
      );
    }

    if (
      verification?.verified !==
      true
    ) {
      return response(
        {
          ok: false,
          method,
          error:
            "delivery_not_verified",
        },
        403,
      );
    }

    let completion: Row;

    try {
      completion =
        await completeVerifiedDelivery(
          shipment,
          group,
          verification,
        );
    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      console.error(
        VERSION,
        "verified delivery completion failed",
        shipment.id,
        reason,
      );

      return response(
        {
          ok: false,
          verified: true,
          method,
          shipment_id:
            shipment.id,
          order_id:
            shipment.order_id,
          seller_id:
            shipment.seller_id,
          fulfilment_group_id:
            group.id,
          reconciliation_required:
            true,
          error:
            reason,
        },
        500,
      );
    }

    return response({
      ok: true,
      verified: true,
      method,

      shipment_id:
        shipment.id,

      order_id:
        shipment.order_id,

      seller_id:
        shipment.seller_id,

      fulfilment_group_id:
        group.id,

      evidence_reference:
        verification
          .evidence_reference,

      delivery:
        completion.delivery,

      payout_eligibility:
        completion
          .payout_eligibility,

      automatic_chain: {
        administrator_required:
          false,

        delivery_confirmed:
          true,

        exact_seller_only:
          true,

        payout_eligibility_processed:
          true,

        seller_payout_execution:
          "automatic_existing_create_payout_worker",
      },
    });
  },
);
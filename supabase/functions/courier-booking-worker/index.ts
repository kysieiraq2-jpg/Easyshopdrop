import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R12G-E-COURIER-WORKER-V3";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(URL, KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function providerCode(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function secretPart(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_");
}

function courierSecret(
  code: string,
  name: string,
) {
  return Deno.env.get(
    `SHOPDROP_COURIER_${secretPart(code)}_${name}`,
  ) ?? "";
}

function retryMinutes(attempt: number) {
  if (attempt <= 1) return 5;
  if (attempt === 2) return 15;
  if (attempt === 3) return 60;
  if (attempt === 4) return 240;
  return 720;
}

async function retryBooking(
  booking: Row,
  reason: string,
  providerResponse: Row = {},
) {
  const attempt =
    Number(booking.attempt_count ?? 0);

  const maximum =
    Number(booking.max_attempts ?? 5);

  const exhausted =
    attempt >= maximum;

  const next =
    exhausted
      ? null
      : new Date(
          Date.now() +
          retryMinutes(attempt) * 60000,
        ).toISOString();

  const status =
    exhausted
      ? "exception"
      : "retry_pending";

  await db
    .from("courier_bookings")
    .update({
      status,
      next_attempt_at: next,
      last_error: reason,
      provider_response: providerResponse,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (exhausted) {
    await db
      .from("fulfilment_groups")
      .update({
        status: "exception",
        last_error: reason,
        updated_at: new Date().toISOString(),
      })
      .eq(
        "id",
        booking.fulfilment_group_id,
      );
  }

  return {
    status,
    next_attempt_at: next,
  };
}

async function notify(
  key: string,
  userId: string,
  subject: string,
  body: string,
) {
  if (!userId) return;

  const { error } =
    await db.rpc(
      "enqueue_message",
      {
        p_event_key: key,
        p_user_id: userId,
        p_channel: "email",
        p_notification_type:
          "courier_update",
        p_subject: subject,
        p_message_body: body,
      },
    );

  if (error) {
    console.error(
      VERSION,
      "notification failed",
      error,
    );
  }
}

/*
 * ============================================================
 * PROTECTED PICKUP / DROP-OFF
 *
 * Installed yesterday:
 *
 * get_protected_courier_handoff(uuid)
 *
 * SERVICE ROLE ONLY.
 *
 * Returns exact seller pickup + buyer delivery information
 * for this fulfilment group.
 *
 * This data NEVER goes to public browser code.
 * ============================================================
 */

async function getProtectedHandoff(
  fulfilmentGroupId: string,
) {
  const {
    data,
    error,
  } =
    await db.rpc(
      "get_protected_courier_handoff",
      {
        p_fulfilment_group_id:
          fulfilmentGroupId,
      },
    );

  if (error || !data) {
    throw new Error(
      `protected_courier_handoff_failed:${
        error?.message ??
        "missing_data"
      }`,
    );
  }

  if (
    !data.pickup ||
    !data.dropoff
  ) {
    throw new Error(
      "protected_courier_handoff_incomplete",
    );
  }

  return data;
}

/*
 * ============================================================
 * COURIER FINANCE
 *
 * Courier payment remains independent from seller payout.
 * ============================================================
 */

async function activateCourierFinance(
  booking: Row,
  group: Row,
) {
  const {
    data,
    error,
  } =
    await db.rpc(
      "activate_courier_booking_finance",
      {
        p_order_id:
          booking.order_id,

        p_fulfilment_group_id:
          group.id,

        p_courier_booking_id:
          booking.id,
      },
    );

  if (error) {
    throw new Error(
      `courier_finance_activation_failed:${error.message}`,
    );
  }

  return data;
}

async function confirmCourierFinance(
  bookingId: string,
  settlementReference:
    string | null,
) {
  const {
    data,
    error,
  } =
    await db.rpc(
      "confirm_courier_booking_finance",
      {
        p_courier_booking_id:
          bookingId,

        p_provider_settlement_reference:
          settlementReference,
      },
    );

  if (error) {
    throw new Error(
      `courier_finance_confirmation_failed:${error.message}`,
    );
  }

  return data;
}

/*
 * ============================================================
 * BOOKING CONTEXT
 * ============================================================
 */

async function getContext(
  booking: Row,
) {
  const {
    data: group,
    error: groupError,
  } =
    await db
      .from("fulfilment_groups")
      .select("*")
      .eq(
        "id",
        booking.fulfilment_group_id,
      )
      .maybeSingle();

  if (
    groupError ||
    !group
  ) {
    throw new Error(
      "fulfilment_group_not_found",
    );
  }

  const {
    data: order,
    error: orderError,
  } =
    await db
      .from("orders")
      .select("*")
      .eq(
        "id",
        booking.order_id,
      )
      .maybeSingle();

  if (
    orderError ||
    !order
  ) {
    throw new Error(
      "order_not_found",
    );
  }

  let quote:
    Row | null = null;

  if (booking.quote_id) {
    const {
      data,
      error,
    } =
      await db
        .from("courier_quotes")
        .select("*")
        .eq(
          "id",
          booking.quote_id,
        )
        .maybeSingle();

    if (
      error ||
      !data
    ) {
      throw new Error(
        "courier_quote_not_found",
      );
    }

    quote = data;
  }

  let provider:
    Row | null = null;

  if (booking.provider_id) {
    const { data } =
      await db
        .from("courier_providers")
        .select("*")
        .eq(
          "id",
          booking.provider_id,
        )
        .maybeSingle();

    provider =
      data ?? null;
  }

  if (
    !provider &&
    quote
  ) {
    const code =
      providerCode(
        quote.provider_code ??
        quote.courier_code ??
        quote.provider ??
        "",
      );

    if (code) {
      const { data } =
        await db
          .from("courier_providers")
          .select("*")
          .eq(
            "provider_code",
            code,
          )
          .maybeSingle();

      if (data) {
        provider = data;

        await db
          .from("courier_bookings")
          .update({
            provider_id:
              data.id,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            booking.id,
          );
      }
    }
  }

  const handoff =
    await getProtectedHandoff(
      group.id,
    );

  return {
    group,
    order,
    quote,
    provider,
    handoff,
  };
}

/*
 * ============================================================
 * REAL COURIER PROVIDER
 * ============================================================
 */

/*
 * Item-specific courier collection manifest (Fix 13).
 * Service-role-only RPC; never returned to a buyer or seller.
 */
async function getCourierItemManifest(fulfilmentGroupId: string): Promise<Row[]> {
  const { data, error } = await db.rpc(
    "shopdrop_get_courier_item_addresses",
    { p_fulfilment_group_id: fulfilmentGroupId },
  );
  if (error || !data || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("courier_item_manifest_unavailable");
  }
  if (data.items.some((item: Row) =>
    !item.item_reference || !item.pickup || !item.delivery
  )) {
    throw new Error("courier_item_manifest_incomplete");
  }
  return data.items;
}

async function bookWithProvider(
  booking: Row,
  group: Row,
  order: Row,
  quote: Row | null,
  provider: Row,
  handoff: Row,
) {
  const code =
    providerCode(
      provider.provider_code ??
      provider.code,
    );

  if (!code) {
    return {
      ok: false,
      retryable: false,
      error:
        "provider_code_missing",
    };
  }

  const bookingUrl =
    courierSecret(
      code,
      "BOOKING_URL",
    );

  const apiKey =
    courierSecret(
      code,
      "API_KEY",
    );

  const authHeader =
    courierSecret(
      code,
      "AUTH_HEADER",
    ) ||
    "Authorization";

  /*
   * No real courier account activated yet.
   *
   * NEVER fabricate booking/tracking information.
   */

  if (
    !bookingUrl ||
    !apiKey
  ) {
    return {
      ok: false,
      activation_required:
        true,
      provider_code:
        code,
      error:
        "courier_provider_activation_required",
    };
  }

  /*
   * PROTECTED PROVIDER PAYLOAD
   *
   * Pickup = seller.
   * Drop-off = buyer.
   *
   * Full international address structure.
   */

  const courierItems = await getCourierItemManifest(String(group.id));

  const payload = {
    shopdrop_booking_id:
      booking.id,

    fulfilment_group_id:
      group.id,

    order_id:
      order.id,

    order_reference:
      handoff.order_reference ??
      order.order_reference ??
      null,

    seller_id:
      group.seller_id,

    idempotency_key:
      booking.idempotency_key,

    quote_id:
      booking.quote_id,

    service_code:
      booking.provider_service_code ??
      quote?.service_code ??
      null,

    service_name:
      booking.provider_service_name ??
      quote?.service_name ??
      null,

    pickup: {
      name:
        handoff.pickup.name,

      mobile_number:
        handoff.pickup.mobile_number,

      address_line_1:
        handoff.pickup.address_line_1,

      address_line_2:
        handoff.pickup.address_line_2,

      city:
        handoff.pickup.city,

      state_province:
        handoff.pickup.state_province,

      postal_code:
        handoff.pickup.postal_code,

      country_code:
        handoff.pickup.country_code,
    },

    dropoff: {
      name:
        handoff.dropoff.name,

      mobile_number:
        handoff.dropoff.mobile_number,

      address_line_1:
        handoff.dropoff.address_line_1,

      address_line_2:
        handoff.dropoff.address_line_2,

      city:
        handoff.dropoff.city,

      state_province:
        handoff.dropoff.state_province,

      postal_code:
        handoff.dropoff.postal_code,

      country_code:
        handoff.dropoff.country_code,
    },

    items: courierItems,

    booking_payload:
      booking.booking_payload ??
      {},

    privacy: {
      public: false,
      authorized_courier_only:
        true,
      minimum_necessary_data:
        true,
    },
  };

  let res: Response;

  try {
    res =
      await fetch(
        bookingUrl,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json",

            [authHeader]:
              apiKey,

            "x-shopdrop-idempotency-key":
              booking.idempotency_key,
          },

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

  } catch (e) {
    return {
      ok: false,
      retryable: true,

      error:
        `courier_network_error:${
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
    return {
      ok: false,

      retryable:
        res.status === 408 ||
        res.status === 409 ||
        res.status === 425 ||
        res.status === 429 ||
        res.status >= 500,

      error:
        `courier_http_${res.status}`,

      provider_response:
        data,
    };
  }

  const externalBooking =
    text(
      data.provider_booking_reference ??
      data.booking_reference ??
      data.booking_id ??
      data.id,
    );

  const tracking =
    text(
      data.tracking_number ??
      data.trackingNumber ??
      data.waybill_number,
    );

  if (
    !externalBooking ||
    !tracking
  ) {
    return {
      ok: false,
      retryable: false,
      error:
        "provider_response_incomplete",
      provider_response:
        data,
    };
  }

  const paymentStatus =
    text(
      data.payment_status ??
      data.settlement_status ??
      data.authorization_status,
    ).toLowerCase();

  const settlementReference =
    text(
      data.provider_settlement_reference ??
      data.settlement_reference ??
      data.payment_reference ??
      data.authorization_reference,
    ) || null;

  const courierPaymentConfirmed =
    [
      "paid",
      "settled",
      "authorized",
      "authorised",
    ].includes(
      paymentStatus,
    ) ||
    Boolean(
      settlementReference,
    );

  return {
    ok: true,

    provider_code:
      code,

    provider_booking_reference:
      externalBooking,

    tracking_number:
      tracking,

    waybill_reference:
      text(
        data.waybill_reference ??
        data.waybill ??
        data.waybill_number,
      ) || null,

    label_reference:
      text(
        data.label_reference ??
        data.label_url ??
        data.label,
      ) || null,

    courier_payment_confirmed:
      courierPaymentConfirmed,

    settlement_reference:
      settlementReference,

    payment_status:
      paymentStatus || null,

    provider_response:
      data,
  };
}
/*
 * ============================================================
 * CREATE SHIPMENT
 *
 * This section deliberately stays close to the previously
 * deployed working courier worker.
 * ============================================================
 */

async function makeShipment(
  booking: Row,
  group: Row,
  result: Row,
) {
  if (booking.shipment_id) {
    const { data } =
      await db
        .from("shipments")
        .select("*")
        .eq(
          "id",
          booking.shipment_id,
        )
        .maybeSingle();

    if (data) {
      return data;
    }
  }

  const {
    data: reference,
    error: referenceError,
  } =
    await db.rpc(
      "generate_shopdrop_reference",
      {
        p_prefix: "SHP",
      },
    );

  if (referenceError) {
    throw new Error(
      `shipment_reference_failed:${referenceError.message}`,
    );
  }

  const shipmentReference =
    text(
      Array.isArray(reference)
        ? reference[0]
        : reference,
    );

  if (!shipmentReference) {
    throw new Error(
      "shipment_reference_empty",
    );
  }

  const {
    data: shipment,
    error: shipmentError,
  } =
    await db
      .from("shipments")
      .insert({
        order_id:
          booking.order_id,

        seller_id:
          booking.seller_id,

        shipment_reference:
          shipmentReference,

        tracking_number:
          result.tracking_number,
      })
      .select("*")
      .single();

  if (
    shipmentError ||
    !shipment
  ) {
    throw new Error(
      `shipment_create_failed:${
        shipmentError?.message ??
        "unknown"
      }`,
    );
  }

  const now =
    new Date()
      .toISOString();

  const {
    error:
      bookingUpdateError,
  } =
    await db
      .from("courier_bookings")
      .update({
        shipment_id:
          shipment.id,

        booking_reference:
          shipmentReference,

        provider_booking_reference:
          result.provider_booking_reference,

        tracking_number:
          result.tracking_number,

        waybill_reference:
          result.waybill_reference,

        label_reference:
          result.label_reference,

        provider_response:
          result.provider_response ??
          {},

        status:
          "booked",

        booked_at:
          now,

        next_attempt_at:
          null,

        last_error:
          null,

        updated_at:
          now,
      })
      .eq(
        "id",
        booking.id,
      );

  if (bookingUpdateError) {
    throw new Error(
      `booking_update_failed:${bookingUpdateError.message}`,
    );
  }

  const {
    error:
      groupUpdateError,
  } =
    await db
      .from("fulfilment_groups")
      .update({
        shipment_id:
          shipment
       .id,

        status:
          "courier_booked",

        updated_at:
          now,
      })
      .eq(
        "id",
        group.id,
      );

  if (groupUpdateError) {
    throw new Error(
      `fulfilment_group_update_failed:${groupUpdateError.message}`,
    );
  }

  return shipment;
}


/*
 * ============================================================
 * PROCESS ONE BOOKING
 * ============================================================
 */

async function processBooking(
  booking: Row,
) {
  let context: Row;

  try {
    context =
      await getContext(
        booking,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    const retry =
      await retryBooking(
        booking,
        reason,
      );

    return {
      booking_id:
        booking.id,

      ok: false,

      ...retry,

      error:
        reason,
    };
  }


  const {
    group,
    order,
    quote,
    provider,
    handoff,
  } =
    context;


  /*
   * Protected pickup + drop-off must exist.
   */

  if (
    !handoff?.pickup ||
    !handoff?.dropoff
  ) {
    const retry =
      await retryBooking(
        booking,
        "protected_courier_handoff_incomplete",
      );

    return {
      booking_id:
        booking.id,

      ok: false,

      ...retry,

      error:
        "protected_courier_handoff_incomplete",
    };
  }


  /*
   * No real courier provider configured yet.
   *
   * Do not invent a booking or tracking number.
   */

  if (!provider) {
    await db
      .from("courier_bookings")
      .update({
        status:
          "activation_required",

        last_error:
          "courier_provider_not_configured",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        booking.id,
      );

    return {
      booking_id:
        booking.id,

      ok: false,

      activation_required:
        true,

      error:
        "courier_provider_not_configured",
    };
  }


  /*
   * ========================================================
   * COURIER FINANCE
   *
   * available_for_courier
   * ->
   * courier_settlement_pending
   * ========================================================
   */

  let financeActivation:
    Row | null = null;

  try {
    financeActivation =
      await activateCourierFinance(
        booking,
        group,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    const retry =
      await retryBooking(
        booking,
        reason,
      );

    return {
      booking_id:
        booking.id,

      ok: false,

      ...retry,

      error:
        reason,
    };
  }


  /*
   * ========================================================
   * SEND PROTECTED BOOKING TO AUTHORIZED COURIER
   * ========================================================
   */

  const result =
    await bookWithProvider(
      booking,
      group,
      order,
      quote,
      provider,
      handoff,
    );


  if (!result.ok) {

    if (
      result.activation_required
    ) {
      await db
        .from("courier_bookings")
        .update({
          status:
            "activation_required",

          last_error:
            result.error,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          booking.id,
        );

      return {
        booking_id:
          booking.id,

        ok: false,

        activation_required:
          true,

        provider_code:
          result.provider_code ??
          null,

        error:
          result.error,

        finance:
          financeActivation,
      };
    }


    if (result.retryable) {
      const retry =
        await retryBooking(
          booking,
          result.error,
          result.provider_response ??
          {},
        );

      return {
        booking_id:
          booking.id,

        ok: false,

        ...retry,

        error:
          result.error,

        finance:
          financeActivation,
      };
    }


    await db
      .from("courier_bookings")
      .update({
        status:
          "exception",

        last_error:
          result.error,

        provider_response:
          result.provider_response ??
          {},

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        booking.id,
      );


    await db
      .from("fulfilment_groups")
      .update({
        status:
          "exception",

        last_error:
          result.error,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        group.id,
      );


    return {
      booking_id:
        booking.id,

      ok: false,

      status:
        "exception",

      error:
        result.error,

      finance:
        financeActivation,
    };
  }


  /*
   * ========================================================
   * CREATE/LINK SHOP&DROP SHIPMENT
   * ========================================================
   */

  let shipment: Row;

  try {
    shipment =
      await makeShipment(
        booking,
        group,
        result,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    await db
      .from("courier_bookings")
      .update({
        status:
          "exception",

        last_error:
          reason,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        booking.id,
      );

    return {
      booking_id:
        booking.id,

      ok: false,

      provider_booking_created:
        true,

      error:
        reason,
    };
  }


  /*
   * ========================================================
   * CONFIRM COURIER PAYMENT/AUTHORIZATION
   *
   * Only when provider explicitly confirms it.
   * ========================================================
   */

  let financeConfirmation:
    Row | null = null;


  if (
    result.courier_payment_confirmed
  ) {
    try {
      financeConfirmation =
        await confirmCourierFinance(
          booking.id,

          result.settlement_reference ??
          null,
        );

    } catch (e) {
      console.error(
        VERSION,
        "courier finance confirmation failed",
        e,
      );

      await db
        .from("courier_bookings")
        .update({
          last_error:
            "courier_finance_confirmation_failed",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          booking.id,
        );
    }
  }


  /*
   * ========================================================
   * NOTIFICATIONS
   *
   * Never include the other party's private address/contact.
   * ========================================================
   */

  const courierName =
    text(
      provider.display_name ??
      provider.provider_name ??
      provider.provider_code ??
      result.provider_code,
    );


  await notify(
    `courier:${booking.id}:booked:seller`,

    text(group.seller_id),

    "Shop&Drop courier booked",

    `Courier booking confirmed. Courier: ${
      courierName ||
      "selected courier"
    }. Tracking reference: ${
      result.tracking_number
    }. Please prepare the parcel for collection.`,
  );


  await notify(
    `courier:${booking.id}:booked:buyer`,

    text(order.buyer_id),

    "Shop&Drop courier booked",

    `Your courier booking is confirmed. Courier: ${
      courierName ||
      "selected courier"
    }. Tracking reference: ${
      result.tracking_number
    }.`,
  );


  return {
    booking_id:
      booking.id,

    ok: true,

    status:
      "booked",

    fulfilment_group_id:
      group.id,

    shipment_id:
      shipment.id,

    provider_code:
      result.provider_code,

    provider_booking_reference:
      result.provider_booking_reference,

    tracking_number:
      result.tracking_number,

    courier_finance: {
      activation:
        financeActivation,

      provider_payment_confirmed:
        result.courier_payment_confirmed,

      confirmation:
        financeConfirmation,

      seller_payout_affected:
        false,
    },

    privacy: {
      pickup_sent_to_authorized_courier:
        true,

      dropoff_sent_to_authorized_courier:
        true,

      public_address_exposure:
        false,

      minimum_necessary_data_only:
        true,
    },
  };
}


/*
 * ============================================================
 * WORKER
 *
 * Fully automatic:
 *
 * claim pending courier bookings
 * -> process independently
 * -> safe retry/exception handling
 *
 * No employee performs ordinary courier bookings.
 * ============================================================
 */

Deno.serve(
  async (req) => {

    if (
      req.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers: {
            "access-control-allow-origin":
              "*",

            "access-control-allow-headers":
              "authorization, x-client-info, apikey, content-type",
          },
        },
      );
    }


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
      !URL ||
      !KEY
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


    const {
      data: claimed,
      error: claimError,
    } =
      await db.rpc(
        "claim_courier_bookings",
        {
          p_limit: 10,
        },
      );


    if (claimError) {
      console.error(
        VERSION,
        "claim courier bookings failed",
        claimError,
      );

      return response(
        {
          ok: false,

          error:
            "courier_booking_claim_failed",
        },
        500,
      );
    }


    const bookings =
      Array.isArray(claimed)
        ? claimed
        : [];


    if (
      bookings.length === 0
    ) {
      return response({
        ok: true,

        claimed: 0,

        processed: 0,

        message:
          "No courier bookings ready for processing.",
      });
    }


    const results:
      Row[] = [];


    for (
      const booking
      of bookings
    ) {
      try {
        const result =
          await processBooking(
            booking,
          );

        results.push(
          result,
        );

      } catch (e) {
        const reason =
          e instanceof Error
            ? e.message
            : String(e);

        console.error(
          VERSION,
          "booking processing failed",
          booking.id,
          reason,
        );

        const retry =
          await retryBooking(
            booking,
            reason,
          );

        results.push({
          booking_id:
            booking.id,

          ok: false,

          ...retry,

          error:
            reason,
        });
      }
    }


    const successful =
      results.filter(
        (item) =>
          item.ok === true,
      ).length;


    const activationRequired =
      results.filter(
        (item) =>
          item.activation_required ===
          true,
      ).length;


    return response({
      ok: true,

      claimed:
        bookings.length,

      processed:
        results.length,

      successful,

      activation_required:
        activationRequired,

      results,
    });

  },
);   
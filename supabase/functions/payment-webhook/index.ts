import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-R12F-A2-PAYMENT-WEBHOOK-V2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

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
        "content-type":
          "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function clean(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}

function cleanProvider(
  value: unknown,
): string {
  return clean(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]/g,
      "",
    );
}

function normalizeStatus(
  value: unknown,
): string {
  const status =
    clean(value)
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_",
      );

  if (
    [
      "paid",
      "success",
      "succeeded",
      "completed",
      "payment_confirmed",
    ].includes(status)
  ) {
    return "paid";
  }

  if (
    [
      "failed",
      "failure",
      "declined",
      "payment_failed",
    ].includes(status)
  ) {
    return "failed";
  }

  if (
    [
      "cancelled",
      "canceled",
      "payment_cancelled",
    ].includes(status)
  ) {
    return "cancelled";
  }

  if (
    [
      "expired",
      "payment_expired",
    ].includes(status)
  ) {
    return "expired";
  }

  if (
    [
      "pending",
      "processing",
      "authorized",
      "authorised",
    ].includes(status)
  ) {
    return "pending";
  }

  return status;
}

function money(
  value: unknown,
): number | null {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return Math.round(
    number * 100,
  ) / 100;
}

function providerSecretName(
  provider: string,
): string {
  return `PAYMENT_WEBHOOK_SECRET_${provider
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      "_",
    )}`;
}

function safeEqual(
  a: string,
  b: string,
): boolean {
  if (
    a.length !== b.length
  ) {
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
): Promise<string> {
  const encoded =
    new TextEncoder()
      .encode(value);

  const digest =
    await crypto.subtle
      .digest(
        "SHA-256",
        encoded,
      );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}

async function verifySignature(
  provider: string,
  rawBody: string,
  suppliedSignature: string,
) {
  const secret =
    Deno.env.get(
      providerSecretName(
        provider,
      ),
    )?.trim() ?? "";

  if (!secret) {
    return {
      ok: false,
      activationRequired: true,
      error:
        "payment_provider_not_activated",
    };
  }

  if (!suppliedSignature) {
    return {
      ok: false,
      activationRequired: false,
      error:
        "missing_webhook_signature",
    };
  }

  /*
   * Provider-neutral verification contract.
   *
   * When a real provider is selected, its adapter can
   * normalize its native signature into this protected
   * Shop&Drop verification boundary.
   */

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
      activationRequired: false,
      error:
        "invalid_webhook_signature",
    };
  }

  return {
    ok: true,
    activationRequired: false,
    error: "",
  };
}

async function enqueue(
  userId: string | null,
  eventKey: string,
  type: string,
  subject: string,
  message: string,
) {
  if (!userId) {
    return;
  }

  const {
    error,
  } =
    await supabase.rpc(
      "enqueue_message",
      {
        p_user_id:
          userId,

        p_event_key:
          eventKey,

        p_channel:
          "in_app",

        p_notification_type:
          type,

        p_subject:
          subject,

        p_message_body:
          message,
      },
    );

  if (error) {
    console.error(
      VERSION,
      "notification enqueue failed",
      error,
    );
  }
}

type WebhookPayload = {
  provider?: unknown;
  event_id?: unknown;
  payment_id?: unknown;
  payment_reference?: unknown;
  provider_payment_reference?: unknown;
  order_id?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
};

Deno.serve(
  async (req) => {

    if (
      req.method !== "POST"
    ) {
      return reply(
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
      return reply(
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
      return reply(
        {
          ok: false,
          error:
            "empty_request_body",
        },
        400,
      );
    }


    let body:
      WebhookPayload;


    try {
      body =
        JSON.parse(rawBody);
    } catch {
      return reply(
        {
          ok: false,
          error:
            "invalid_json",
        },
        400,
      );
    }


    const provider =
      cleanProvider(
        body.provider,
      );


    if (!provider) {
      return reply(
        {
          ok: false,
          error:
            "provider_required",
        },
        400,
      );
    }


    const signature =
      clean(
        req.headers.get(
          "x-shopdrop-payment-signature",
        ),
      );


    const verification =
      await verifySignature(
        provider,
        rawBody,
        signature,
      );


    if (!verification.ok) {

      if (
        verification
          .activationRequired
      ) {
        return reply(
          {
            ok: false,
            activation_required:
              true,
            provider,
            error:
              verification.error,
          },
          503,
        );
      }


      return reply(
        {
          ok: false,
          provider,
          error:
            verification.error,
        },
        401,
      );
    }


    const eventId =
      clean(
        body.event_id,
      );


    if (!eventId) {
      return reply(
        {
          ok: false,
          error:
            "provider_event_id_required",
        },
        400,
      );
    }


    const status =
      normalizeStatus(
        body.status,
      );


    if (
      ![
        "paid",
        "failed",
        "cancelled",
        "expired",
        "pending",
      ].includes(status)
    ) {
      return reply(
        {
          ok: false,
          error:
            "unsupported_payment_status",
          status,
        },
        400,
      );
    }


    /*
     * ========================================================
     * IDEMPOTENT PROVIDER EVENT INTAKE
     * ========================================================
     */


    const {
      data: existingEvent,
      error:
        existingEventError,
    } =
      await supabase
        .from(
          "payment_events",
        )
        .select(
          "id,status",
        )
        .eq(
          "provider",
          provider,
        )
        .eq(
          "provider_event_id",
          eventId,
        )
        .maybeSingle();


    if (existingEventError) {
      console.error(
        VERSION,
        existingEventError,
      );

      return reply(
        {
          ok: false,
          error:
            "payment_event_lookup_failed",
        },
        500,
      );
    }


    if (existingEvent) {
      return reply({
        ok: true,
        duplicate: true,
        provider,
        event_id:
          eventId,
        status:
          existingEvent.status,
      });
    }


    /*
     * ========================================================
     * FIND SHOP&DROP PAYMENT
     * ========================================================
     */


    const paymentId =
      clean(
        body.payment_id,
      );


    const paymentReference =
      clean(
        body.payment_reference,
      );


    const providerPaymentReference =
      clean(
        body.provider_payment_reference,
      );


    const orderIdFromEvent =
      clean(
        body.order_id,
      );


    let paymentQuery =
      supabase
        .from("payments")
        .select("*")
        .limit(1);


    if (paymentId) {

      paymentQuery =
        paymentQuery.eq(
          "id",
          paymentId,
        );

    } else if (paymentReference) {

      paymentQuery =
        paymentQuery.eq(
          "payment_reference",
          paymentReference,
        );

    } else if (
      orderIdFromEvent
    ) {

      paymentQuery =
        paymentQuery
          .eq(
            "order_id",
            orderIdFromEvent,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

    } else {

      return reply(
        {
          ok: false,
          error:
            "payment_identifier_required",
        },
        400,
      );
    }


    const {
      data: paymentRows,
      error: paymentError,
    } =
      await paymentQuery;


    if (paymentError) {
      console.error(
        VERSION,
        "payment lookup failed",
        paymentError,
      );

      return reply(
        {
          ok: false,
          error:
            "payment_lookup_failed",
        },
        500,
      );
    }


    const payment =
      Array.isArray(
        paymentRows,
      )
        ? paymentRows[0]
        : null;


    if (!payment) {
      return reply(
        {
          ok: false,
          error:
            "payment_not_found",
        },
        404,
      );
    }


    const orderId =
      clean(
        payment.order_id,
      );


    if (!orderId) {
      return reply(
        {
          ok: false,
          error:
            "payment_order_missing",
        },
        500,
      );
    }


    /*
     * ========================================================
     * AUTHORITATIVE FINANCIAL VERIFICATION
     * ========================================================
     *
     * Never trust webhook/browser amounts as Shop&Drop
     * financial authority.
     *
     * A2.1 recalculates product + item-level commission.
     * Courier allocations are read separately.
     */


    const {
      data: financialData,
      error: financialError,
    } =
      await supabase.rpc(
        "get_order_financial_totals",
        {
          p_order_id:
            orderId,
        },
      );


    if (
      financialError ||
      !financialData
    ) {
      console.error(
        VERSION,
        "financial verification failed",
        financialError,
      );

      return reply(
        {
          ok: false,
          error:
            "financial_verification_failed",
        },
        500,
      );
    }


    const productTotal =
      money(
        financialData
          .product_total,
      );


    const commissionTotal =
      money(
        financialData
          .commission_total,
      );


    if (
      productTotal === null ||
      commissionTotal === null
    ) {
      return reply(
        {
          ok: false,
          error:
            "invalid_financial_totals",
        },
        500,
      );
    }


    const {
      data: courierRows,
      error: courierError,
    } =
      await supabase
        .from(
          "payment_allocations",
        )
        .select("amount")
        .eq(
          "order_id",
          orderId,
        )
        .eq(
          "allocation_type",
          "courier",
        );


    if (courierError) {
      console.error(
        VERSION,
        courierError,
      );

      return reply(
        {
          ok: false,
          error:
            "courier_financial_verification_failed",
        },
        500,
      );
    }


    const courierTotal =
      Math.round(
        (
          courierRows ?? []
        ).reduce(
          (
            total: number,
            row:
              Record<
                string,
                unknown
              >,
          ) =>
            total +
            (
              Number.isFinite(
                Number(
                  row.amount,
                ),
              )
                ? Number(
                    row.amount,
                  )
                : 0
            ),
          0,
        )
        *
        100,
      ) / 100;


    const expectedTotal =
      Math.round(
        (
          productTotal +
          commissionTotal +
          courierTotal
        )
        *
        100,
      ) / 100;


    const eventAmount =
      money(
        body.amount,
      );


    const eventCurrency =
      clean(
        body.currency,
      )
        .toUpperCase();


    const paymentCurrency =
      clean(
        payment.currency,
      )
        .toUpperCase();


    if (
      status === "paid" &&
      eventAmount !== null &&
      eventAmount !==
        expectedTotal
    ) {
      return reply(
        {
          ok: false,
          error:
            "payment_amount_mismatch",

          expected_amount:
            expectedTotal,

          received_amount:
            eventAmount,
        },
        409,
      );
    }


    if (
      status === "paid" &&
      eventCurrency &&
      paymentCurrency &&
      eventCurrency !==
        paymentCurrency
    ) {
      return reply(
        {
          ok: false,
          error:
            "payment_currency_mismatch",
        },
        409,
      );
    }


    /*
     * ========================================================
     * RECORD VERIFIED PROVIDER EVENT
     * ========================================================
     */


    const {
      data: paymentEvent,
      error:
        paymentEventError,
    } =
      await supabase
        .from(
          "payment_events",
        )
        .insert(
          {
            payment_id:
              payment.id,

            order_id:
              orderId,

            provider,

            provider_event_id:
              eventId,

            status,

            amount:
              eventAmount,

            currency:
              eventCurrency ||
              paymentCurrency,

            raw_event:
              body,
          },
        )
        .select("*")
        .single();


    if (paymentEventError) {
      console.error(
        VERSION,
        "payment event insert failed",
        paymentEventError,
      );

      return reply(
        {
          ok: false,
          error:
            "payment_event_record_failed",
        },
        500,
      );
    }


    /*
     * ========================================================
     * PENDING EVENT
     * ========================================================
     */


    if (status === "pending") {

      await supabase
        .from("payments")
        .update(
          {
            payment_status:
              "pending",
          },
        )
        .eq(
          "id",
          payment.id,
        );


      return reply({
        ok: true,
        provider,
        event_id:
          eventId,
        payment_id:
          payment.id,
        order_id:
          orderId,
        status:
          "pending",
      });
    }


    /*
     * ========================================================
     * FAILED / CANCELLED / EXPIRED
     * ========================================================
     */


    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "expired"
    ) {

      const {
        error: releaseError,
      } =
        await supabase.rpc(
          "release_order_inventory",
          {
            p_order_id:
              orderId,

            p_reason:
              `payment_${status}`,
          },
        );


      if (releaseError) {
        console.error(
          VERSION,
          "inventory release failed",
          releaseError,
        );
      }


      await supabase
        .from("payments")
        .update(
          {
            payment_status: status,
          },
        )
        .eq(
          "id",
          payment.id,
        );


      await supabase
        .from(
          "payment_allocations",
        )
        .update(
          {
            status:
              status ===
                "cancelled"
                ? "cancelled"
                : "failed",

            failed_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          },
        )
        .eq(
          "order_id",
          orderId,
        )
        .in(
          "status",
          [
            "pending",
            "payment_confirmed",
          ],
        );


      await enqueue(
        payment.buyer_id ??
          null,

        `payment:${payment.id}:${status}:buyer`,

        `payment_${status}`,

        "Shop&Drop payment update",

        `Your payment is ${status}.`,
      );


      return reply({
        ok: true,
        provider,
        event_id:
          eventId,
        payment_id:
          payment.id,
        order_id:
          orderId,
        status,
      });
    }


    /*
     * ========================================================
     * PAID
     * ========================================================
     *
     * Continue in Block 2.
     */
     /*
     * ========================================================
     * VERIFIED PAID EVENT
     *
     * Sequence:
     *
     * 1. Mark payment paid.
     * 2. Commit reserved inventory.
     * 3. Confirm A2/A2.1 financial allocations.
     * 4. Seller allocations -> seller_held.
     * 5. Shop&Drop commission -> platform_earned.
     * 6. Courier allocations -> available_for_courier.
     * 7. Create seller fulfilment groups.
     * 8. Link seller allocations to fulfilment groups.
     * 9. Notify buyer/sellers.
     *
     * NO seller payout occurs here.
     * ========================================================
     */


    const paidAt =
      new Date()
        .toISOString();


    /*
     * ========================================================
     * MARK PAYMENT PAID
     * ========================================================
     */


    const {
      error:
        paymentUpdateError,
    } =
      await supabase
        .from("payments")
        .update(
          {
            payment_status:
              "paid",

            paid_at:
              paidAt,
          },
        )
        .eq(
          "id",
          payment.id,
        );


    if (paymentUpdateError) {
      console.error(
        VERSION,
        "payment update failed",
        paymentUpdateError,
      );

      return reply(
        {
          ok: false,
          error:
            "payment_update_failed",
        },
        500,
      );
    }


    /*
     * ========================================================
     * COMMIT INVENTORY
     *
     * Inventory was reserved by create-payment-session.
     * Only a VERIFIED paid webhook may commit it.
     * ========================================================
     */


    const {
      data:
        inventoryCommit,
      error:
        inventoryCommitError,
    } =
      await supabase.rpc(
        "commit_paid_order_inventory",
        {
          p_order_id:
            orderId,
        },
      );


    if (inventoryCommitError) {
      console.error(
        VERSION,
        "inventory commit failed",
        inventoryCommitError,
      );

      /*
       * Payment has genuinely succeeded.
       *
       * We MUST NOT pretend payment failed or release stock
       * here.
       *
       * Mark the financial allocations as exception so the
       * automated exception/admin path can reconcile safely.
       */

      await supabase
        .from(
          "payment_allocations",
        )
        .update(
          {
            status:
              "exception",

            last_error:
              "inventory_commit_failed_after_verified_payment",

            updated_at:
              paidAt,
          },
        )
        .eq(
          "order_id",
          orderId,
        )
        .in(
          "status",
          [
            "pending",
            "payment_confirmed",
          ],
        );


      return reply(
        {
          ok: false,
          payment_verified:
            true,
          error:
            "inventory_commit_failed_after_verified_payment",
          payment_id:
            payment.id,
          order_id:
            orderId,
        },
        500,
      );
    }


    /*
     * ========================================================
     * CONFIRM THREE-WAY FINANCIAL ALLOCATIONS
     *
     * seller:
     *   seller_held
     *
     * Shop&Drop:
     *   platform_earned
     *
     * courier:
     *   available_for_courier
     *
     * This function does NOT release seller payout.
     * ========================================================
     */


    const {
      data:
        allocationCount,
      error:
        allocationConfirmError,
    } =
      await supabase.rpc(
        "confirm_order_payment_allocations",
        {
          p_order_id:
            orderId,

          p_payment_id:
            payment.id,

          p_provider_code:
            provider,
        },
      );


    if (allocationConfirmError) {
      console.error(
        VERSION,
        "allocation confirmation failed",
        allocationConfirmError,
      );


      await supabase
        .from(
          "payment_allocations",
        )
        .update(
          {
            status:
              "exception",

            last_error:
              "allocation_confirmation_failed_after_verified_payment",

            updated_at:
              paidAt,
          },
        )
        .eq(
          "order_id",
          orderId,
        )
        .in(
          "status",
          [
            "pending",
            "payment_confirmed",
          ],
        );


      return reply(
        {
          ok: false,
          payment_verified:
            true,
          inventory_committed:
            true,
          error:
            "allocation_confirmation_failed_after_verified_payment",
          payment_id:
            payment.id,
          order_id:
            orderId,
        },
        500,
      );
    }


    /*
     * ========================================================
     * CREATE SELLER FULFILMENT GROUPS
     *
     * One checkout can contain many sellers.
     *
     * Same-seller items may share the seller fulfilment group.
     * Different sellers remain separate.
     * ========================================================
     */


    const {
      data:
        fulfilmentResult,
      error:
        fulfilmentError,
    } =
      await supabase.rpc(
        "create_order_fulfilment_groups",
        {
          p_order_id:
            orderId,
        },
      );


    if (fulfilmentError) {
      console.error(
        VERSION,
        "fulfilment group creation failed",
        fulfilmentError,
      );


      /*
       * Payment/inventory are already authoritative.
       *
       * Do not reverse payment.
       *
       * Leave seller money held and record an exception.
       */

      await supabase
        .from(
          "payment_allocations",
        )
        .update(
          {
            last_error:
              "fulfilment_group_creation_failed",

            updated_at:
              paidAt,
          },
        )
        .eq(
          "order_id",
          orderId,
        )
        .eq(
          "allocation_type",
          "seller",
        );


      return reply(
        {
          ok: false,
          payment_verified:
            true,
          inventory_committed:
            true,
          allocations_confirmed:
            true,
          error:
            "fulfilment_group_creation_failed",
          payment_id:
            payment.id,
          order_id:
            orderId,
        },
        500,
      );
    }


    /*
     * ========================================================
     * LINK SELLER FINANCIAL ALLOCATIONS TO THEIR FULFILMENT
     * GROUPS
     *
     * This makes seller payout independent.
     *
     * Seller A delivered -> Seller A eligible.
     * Seller B still travelling -> Seller B remains held.
     * ========================================================
     */


    const {
      data:
        linkedAllocationCount,
      error:
        allocationLinkError,
    } =
      await supabase.rpc(
        "link_payment_allocations_to_fulfilment",
        {
          p_order_id:
            orderId,
        },
      );


    if (allocationLinkError) {
      console.error(
        VERSION,
        "fulfilment allocation link failed",
        allocationLinkError,
      );


      await supabase
        .from(
          "payment_allocations",
        )
        .update(
          {
            last_error:
              "fulfilment_allocation_link_failed",

            updated_at:
              paidAt,
          },
        )
        .eq(
          "order_id",
          orderId,
        )
        .eq(
          "allocation_type",
          "seller",
        );


      return reply(
        {
          ok: false,
          payment_verified:
            true,
          inventory_committed:
            true,
          allocations_confirmed:
            true,
          fulfilment_created:
            true,
          error:
            "fulfilment_allocation_link_failed",
          payment_id:
            payment.id,
          order_id:
            orderId,
        },
        500,
      );
    }


    /*
     * ========================================================
     * UPDATE ORDER PAYMENT STATE
     *
     * This is PAYMENT confirmation only.
     *
     * It does NOT mean delivered.
     * It does NOT mean seller paid.
     * ========================================================
     */


    const {
      error:
        orderUpdateError,
    } =
      await supabase
        .from("orders")
        .update(
          {
            payment_status:
              "paid",
          },
        )
        .eq(
          "id",
          orderId,
        );


    if (orderUpdateError) {
      console.error(
        VERSION,
        "order payment status update failed",
        orderUpdateError,
      );
    }


    /*
     * ========================================================
     * BUYER NOTIFICATION
     * ========================================================
     */


    const buyerId =
      clean(
        payment.buyer_id,
      ) || null;


    await enqueue(
      buyerId,

      `payment:${payment.id}:paid:buyer`,

      "payment_confirmed",

      "Shop&Drop payment confirmed",

      "Your payment has been confirmed. Your order is now moving to fulfilment.",
    );


    /*
     * ========================================================
     * SELLER NOTIFICATIONS
     *
     * Notify every seller represented in this order.
     *
     * Do not expose other sellers' information.
     * ========================================================
     */


    const {
      data: sellerRows,
      error: sellerError,
    } =
      await supabase
        .from("order_items")
        .select(
          "seller_id",
        )
        .eq(
          "order_id",
          orderId,
        );


    if (sellerError) {

      console.error(
        VERSION,
        "seller notification lookup failed",
        sellerError,
      );

    } else {

      const sellerIds =
        Array.from(
          new Set(
            (
              sellerRows ??
              []
            )
              .map(
                (
                  row:
                    Record<
                      string,
                      unknown
                    >,
                ) =>
                  clean(
                    row.seller_id,
                  ),
              )
              .filter(
                (
                  value:
                    string,
                ) =>
                  Boolean(value),
              ),
          ),
        );


      for (
        const sellerId
        of sellerIds
      ) {

        await enqueue(
          sellerId,

          `payment:${payment.id}:paid:seller:${sellerId}`,

          "payment_confirmed",

          "Shop&Drop order payment confirmed",

          "Payment has been confirmed for an order containing your item(s). Prepare the applicable parcel for fulfilment.",
        );
      }
    }


    /*
     * ========================================================
     * COURIER ALLOCATION STATUS
     *
     * Integrated courier allocations were changed by
     * confirm_order_payment_allocations() to:
     *
     * available_for_courier
     *
     * They are therefore independent from seller payout.
     *
     * The courier-booking worker/provider adapter will later:
     *
     * identify the actual shipment
     * receive protected collection/delivery context
     * book the buyer-selected courier
     * settle/authorize the courier allocation
     * receive tracking reference
     *
     * Buyer/seller addresses remain protected until supplied
     * automatically to the authorized courier for that
     * shipment.
     * ========================================================
     */


    const {
      data:
        courierAllocationRows,
      error:
        courierAllocationError,
    } =
      await supabase
        .from(
          "payment_allocations",
        )
        .select(
          "id,seller_id,fulfilment_group_id,courier_booking_id,amount,status",
        )
        .eq(
          "order_id",
          orderId,
        )
        .eq(
          "allocation_type",
          "courier",
        );


    if (courierAllocationError) {
      console.error(
        VERSION,
        "courier allocation status read failed",
        courierAllocationError,
      );
    }


    /*
     * ========================================================
     * IMPORTANT PAYOUT PROTECTION
     *
     * PAYMENT CONFIRMATION STOPS HERE.
     *
     * Seller allocation remains:
     *
     * seller_held
     *
     * R12G-D will later perform:
     *
     * verified delivery
     * -> identify seller/fulfilment group
     * -> mark ONLY that seller allocation payout eligible.
     *
     * NO standard inspection window.
     * ========================================================
     */


    return reply(
      {
        ok: true,

        provider,

        event_id:
          eventId,

        payment_event_id:
          paymentEvent.id,

        payment_id:
          payment.id,

        payment_reference:
          payment.payment_reference ??
          payment.reference ??
          null,

        order_id:
          orderId,

        status:
          "paid",

        financials: {
          product:
            productTotal,

          shopdrop_commission:
            commissionTotal,

          courier:
            courierTotal,

          total:
            expectedTotal,

          commission_calculation:
            "per_order_item",
        },

        inventory: {
          committed:
            true,

          result:
            inventoryCommit,
        },

        allocations: {
          confirmed:
            true,

          updated_count:
            allocationCount ?? 0,

          seller_state:
            "seller_held",

          shopdrop_state:
            "platform_earned",

          courier_state:
            "available_for_courier",
        },

        fulfilment: {
          created:
            true,

          result:
            fulfilmentResult,

          allocations_linked:
            true,

          linked_count:
            linkedAllocationCount ??
            0,
        },

        courier: {
          allocation_count:
            (
              courierAllocationRows ??
              []
            ).length,

          payment_independent_from_seller:
            true,

          protected_address_handoff:
            true,
        },

        seller_payout: {
          released:
            false,

          eligibility_trigger:
            "verified_delivery",

          inspection_window:
            false,
        },
      },
      200,
    );

  },
);   
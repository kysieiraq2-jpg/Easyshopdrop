
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-PAYMENT-DISPUTE-WEBHOOK-V3";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

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
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

function text(
  value: unknown,
): string {
  return String(value ?? "").trim();
}

function providerCode(
  value: unknown,
): string {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function normalizeEvent(
  value: unknown,
): string {
  const event = text(value)
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");

  if (
    [
      "chargeback",
      "chargeback_created",
      "chargeback_opened",
      "payment_chargeback",
    ].includes(event)
  ) {
    return "chargeback_opened";
  }

  if (
    [
      "dispute",
      "dispute_created",
      "dispute_opened",
      "payment_dispute",
    ].includes(event)
  ) {
    return "dispute_opened";
  }

  if (
    [
      "reversal",
      "reversed",
      "payment_reversal",
      "payment_reversed",
    ].includes(event)
  ) {
    return "payment_reversed";
  }

  if (
    [
      "chargeback_won",
      "dispute_won",
    ].includes(event)
  ) {
    return "dispute_won";
  }

  if (
    [
      "chargeback_lost",
      "dispute_lost",
      "chargeback_confirmed",
    ].includes(event)
  ) {
    return "dispute_lost";
  }

  if (
    [
      "chargeback_closed",
      "dispute_closed",
      "dispute_resolved",
    ].includes(event)
  ) {
    return "dispute_closed";
  }

  return event;
}

async function sha256(
  value: string,
): Promise<string> {
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
        b.toString(16).padStart(2, "0"),
    )
    .join("");
}

function constantEqual(
  a: string,
  b: string,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return difference === 0;
}

async function verifyWebhook(
  provider: string,
  rawBody: string,
  suppliedSignature: string,
) {
  const envName =
    `PAYMENT_WEBHOOK_SECRET_${provider
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")}`;

  const secret =
    Deno.env.get(envName)?.trim() ?? "";

  if (!secret) {
    return {
      ok: false,
      activation_required: true,
      error: "payment_provider_not_activated",
    };
  }

  if (!suppliedSignature) {
    return {
      ok: false,
      activation_required: false,
      error: "missing_webhook_signature",
    };
  }

  const expected =
    await sha256(
      `${secret}:${rawBody}`,
    );

  if (
    !constantEqual(
      expected,
      suppliedSignature,
    )
  ) {
    return {
      ok: false,
      activation_required: false,
      error: "invalid_webhook_signature",
    };
  }

  return {
    ok: true,
    activation_required: false,
    error: "",
  };
}

async function findPayment(
  body: Row,
): Promise<Row> {
  const paymentId =
    text(body.payment_id);

  const providerReference =
    text(
      body.provider_payment_reference ??
      body.payment_reference,
    );

  const orderId =
    text(body.order_id);

  if (paymentId) {
    const { data, error } =
      await db
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

    if (error || !data) {
      throw new Error(
        `payment_not_found:${error?.message ?? "missing"
        }`,
      );
    }

    return data;
  }

  if (providerReference) {
    const { data, error } =
      await db
        .from("payments")
        .select("*")
        .eq(
          "provider_payment_reference",
          providerReference,
        )
        .maybeSingle();

    if (error || !data) {
      throw new Error(
        `payment_not_found:${error?.message ?? "missing"
        }`,
      );
    }

    return data;
  }

  if (orderId) {
    const { data, error } =
      await db
        .from("payments")
        .select("*")
        .eq("order_id", orderId)
        .order(
          "created_at",
          { ascending: false },
        )
        .limit(1);

    if (error) {
      throw new Error(
        `payment_lookup_failed:${error.message}`,
      );
    }

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      throw new Error("payment_not_found");
    }

    return data[0];
  }

  throw new Error(
    "payment_identifier_required",
  );
}

async function findBuyerId(
  payment: Row,
) {
  if (payment.buyer_id) {
    return payment.buyer_id;
  }

  const { data } =
    await db
      .from("orders")
      .select("buyer_id")
      .eq("id", payment.order_id)
      .maybeSingle();

  return data?.buyer_id ?? null;
}

// END BLOCK 1
async function getOrCreateDispute(
  payment: Row,
  body: Row,
  eventType: string,
): Promise<Row> {
  const sellerId =
    text(body.seller_id) || null;

  const buyerId =
    await findBuyerId(payment);

  let query =
    db
      .from("disputes")
      .select("*")
      .eq(
        "order_id",
        payment.order_id,
      )
      .in(
        "dispute_status",
        [
          "open",
          "provider_dispute",
          "under_review",
        ],
      )
      .order(
        "created_at",
        { ascending: false },
      )
      .limit(1);

  if (sellerId) {
    query =
      query.eq(
        "seller_id",
        sellerId,
      );
  }

  const { data: existing } =
    await query;

  if (
    Array.isArray(existing) &&
    existing.length > 0
  ) {
    return existing[0];
  }

  const now =
    new Date().toISOString();

  const { data, error } =
    await db
      .from("disputes")
      .insert({
        order_id:
          payment.order_id,

        buyer_id:
          buyerId,

        seller_id:
          sellerId,

        dispute_reason:
          eventType,

        dispute_details:
          `External payment provider event: ${eventType}`,

        dispute_status:
          "provider_dispute",

        resolution_notes:
          null,

        opened_at:
          now,

        created_at:
          now,

        updated_at:
          now,
      })
      .select("*")
      .single();

  if (error || !data) {
    throw new Error(
      `dispute_creation_failed:${error?.message ?? "unknown"
      }`,
    );
  }

  return data;
}

async function getSellerAllocations(
  payment: Row,
  sellerId: string,
): Promise<Row[]> {
  let query =
    db
      .from("payment_allocations")
      .select("*")
      .eq(
        "order_id",
        payment.order_id,
      )
      .eq(
        "allocation_type",
        "seller",
      );

  if (sellerId) {
    query =
      query.eq(
        "seller_id",
        sellerId,
      );
  }

  const { data, error } =
    await query;

  if (error) {
    throw new Error(
      `allocation_lookup_failed:${error.message}`,
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function freezeSellerMoney(
  payment: Row,
  body: Row,
  dispute: Row,
  eventType: string,
) {
  const sellerId =
    text(body.seller_id);

  const allocations =
    await getSellerAllocations(
      payment,
      sellerId,
    );

  const now =
    new Date().toISOString();

  const results: Row[] = [];

  for (const allocation of allocations) {
    const alreadySettled =
      Boolean(allocation.settled_at) ||
      [
        "seller_payout_settled",
        "paid",
        "settled",
      ].includes(
        text(allocation.status),
      );

    if (alreadySettled) {
      await db
        .from("payment_allocations")
        .update({
          status:
            "reconciliation_required",

          last_error:
            "external_dispute_after_seller_settlement",

          metadata: {
            ...(allocation.metadata ?? {}),

            dispute_id:
              dispute.id,

            external_event:
              eventType,

            seller_already_settled:
              true,
          },

          updated_at:
            now,
        })
        .eq(
          "id",
          allocation.id,
        );

      results.push({
        allocation_id:
          allocation.id,

        status:
          "reconciliation_required",
      });

      continue;
    }

    await db
      .from("payment_allocations")
      .update({
        status:
          "provider_dispute_hold",

        last_error:
          null,

        metadata: {
          ...(allocation.metadata ?? {}),

          dispute_id:
            dispute.id,

          external_event:
            eventType,

          provider_dispute_hold:
            true,

          provider_dispute_hold_at:
            now,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        allocation.id,
      );

    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "provider_dispute_hold",

        updated_at:
          now,
      })
      .eq(
        "order_id",
        allocation.order_id,
      )
      .eq(
        "seller_id",
        allocation.seller_id,
      )
      .not(
        "payout_status",
        "in",
        '("paid","settled")',
      );

    results.push({
      allocation_id:
        allocation.id,

      status:
        "provider_dispute_hold",
    });
  }

  return results;
}

async function resolveWon(
  payment: Row,
  body: Row,
  dispute: Row,
) {
  const sellerId =
    text(body.seller_id);

  const allocations =
    await getSellerAllocations(
      payment,
      sellerId,
    );

  const now =
    new Date().toISOString();

  let released = 0;

  for (const allocation of allocations) {
    if (
      allocation.status !==
      "provider_dispute_hold"
    ) {
      continue;
    }

    /*
     * Restore to held state.
     *
     * We deliberately do NOT mark it paid.
     * Existing delivery/payout automation remains authoritative.
     */

    await db
      .from("payment_allocations")
      .update({
        status:
          "seller_held",

        last_error:
          null,

        metadata: {
          ...(allocation.metadata ?? {}),

          provider_dispute_hold:
            false,

          provider_dispute_won:
            true,

          provider_dispute_resolved_at:
            now,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        allocation.id,
      );

    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "eligible",

        updated_at:
          now,
      })
      .eq(
        "order_id",
        allocation.order_id,
      )
      .eq(
        "seller_id",
        allocation.seller_id,
      )
      .eq(
        "payout_status",
        "provider_dispute_hold",
      );

    released++;
  }

  await db
    .from("disputes")
    .update({
      dispute_status:
        "resolved",

      resolution_notes:
        "External payment dispute resolved in favour of the payment.",

      resolved_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      dispute.id,
    );

  return {
    released,
  };
}

async function resolveLost(
  payment: Row,
  body: Row,
  dispute: Row,
  eventType: string,
) {
  const sellerId =
    text(body.seller_id);

  const allocations =
    await getSellerAllocations(
      payment,
      sellerId,
    );

  const now =
    new Date().toISOString();

  const results: Row[] = [];

  for (const allocation of allocations) {
    const alreadySettled =
      Boolean(allocation.settled_at) ||
      [
        "seller_payout_settled",
        "paid",
        "settled",
        "reconciliation_required",
      ].includes(
        text(allocation.status),
      );

    if (alreadySettled) {
      await db
        .from("payment_allocations")
        .update({
          status:
            "reconciliation_required",

          last_error:
            "external_dispute_lost_after_seller_settlement",

          metadata: {
            ...(allocation.metadata ?? {}),

            dispute_id:
              dispute.id,

            external_event:
              eventType,

            provider_dispute_lost:
              true,

            seller_already_settled:
              true,
          },

          updated_at:
            now,
        })
        .eq(
          "id",
          allocation.id,
        );

      results.push({
        allocation_id:
          allocation.id,

        status:
          "reconciliation_required",
      });

      continue;
    }

    await db
      .from("payment_allocations")
      .update({
        status:
          "provider_dispute_lost",

        last_error:
          null,

        metadata: {
          ...(allocation.metadata ?? {}),

          dispute_id:
            dispute.id,

          external_event:
            eventType,

          provider_dispute_hold:
            false,

          provider_dispute_lost:
            true,

          provider_dispute_resolved_at:
            now,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        allocation.id,
      );

    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "provider_dispute_lost",

        updated_at:
          now,
      })
      .eq(
        "order_id",
        allocation.order_id,
      )
      .eq(
        "seller_id",
        allocation.seller_id,
      )
      .not(
        "payout_status",
        "in",
        '("paid","settled")',
      );

    results.push({
      allocation_id:
        allocation.id,

      status:
        "provider_dispute_lost",
    });
  }

  await db
    .from("disputes")
    .update({
      dispute_status:
        "resolved",

      resolution_notes:
        "External payment dispute resolved against the payment.",

      resolved_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      dispute.id,
    );

  return {
    affected:
      results.length,

    results,
  };
}

// END BLOCK 2
async function duplicateEvent(
  provider: string,
  eventId: string,
): Promise<boolean> {
  const { data, error } =
    await db
      .from("dispute_events")
      .select("id")
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
      `duplicate_check_failed:${error.message}`,
    );
  }

  return (
    Array.isArray(data) &&
    data.length > 0
  );
}

async function recordEvent(
  dispute: Row,
  provider: string,
  eventId: string,
  eventType: string,
  body: Row,
) {
  const { error } =
    await db
      .from("dispute_events")
      .insert({
        dispute_id:
          dispute.id,

        user_id:
          null,

        event_type:
          eventType,

        status:
          eventType,

        notes:
          `External payment provider event: ${eventType}`,

        event_data: {
          provider,

          provider_event_id:
            eventId,

          amount:
            body.amount ?? null,

          currency:
            text(
              body.currency,
            ).toUpperCase() || null,

          source:
            "payment_provider",
        },
        created_at:
          new Date().toISOString(),
      });

  if (error) {
    throw new Error(
      `dispute_event_record_failed:${error.message}`,
    );
  }
}


/*
 * ============================================================
 * PAYMENT-DISPUTE-WEBHOOK ENTRY POINT
 *
 * Separate from:
 *
 * payment-webhook
 * refund-worker
 *
 * Handles only external bank/card/payment-provider disputes,
 * chargebacks and reversals.
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
        body.provider,
      );

    if (!provider) {
      return response(
        {
          ok: false,
          error:
            "provider_required",
        },
        400,
      );
    }

    /*
     * ========================================================
     * VERIFY PAYMENT-PROVIDER WEBHOOK
     * ========================================================
     */

    const signature =
      text(
        req.headers.get(
          "x-shopdrop-payment-signature",
        ),
      );

    const verification =
      await verifyWebhook(
        provider,
        rawBody,
        signature,
      );

    if (!verification.ok) {
      if (
        verification
          .activation_required
      ) {
        return response(
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

      return response(
        {
          ok: false,
          provider,
          error:
            verification.error,
        },
        401,
      );
    }

    /*
     * ========================================================
     * PROVIDER EVENT
     * ========================================================
     */

    const eventId =
      text(
        body.event_id ??
        body.provider_event_id ??
        body.dispute_event_id,
      );

    if (!eventId) {
      return response(
        {
          ok: false,
          error:
            "provider_event_id_required",
        },
        400,
      );
    }

    const eventType =
      normalizeEvent(
        body.event_type ??
        body.type ??
        body.status,
      );

    const supportedEvents = [
      "chargeback_opened",
      "dispute_opened",
      "payment_reversed",
      "dispute_won",
      "dispute_lost",
      "dispute_closed",
    ];

    if (
      !supportedEvents.includes(
        eventType,
      )
    ) {
      return response(
        {
          ok: false,
          error:
            "unsupported_payment_dispute_event",
          event_type:
            eventType,
        },
        400,
      );
    }

    /*
     * ========================================================
     * IDEMPOTENCY
     *
     * Same provider event must never be processed twice.
     * ========================================================
     */

    try {
      const duplicate =
        await duplicateEvent(
          provider,
          eventId,
        );

      if (duplicate) {
        return response({
          ok: true,
          duplicate: true,
          provider,
          provider_event_id:
            eventId,
          event_type:
            eventType,
        });
      }
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
     * ========================================================
     * FIND ORIGINAL PAYMENT
     * ========================================================
     */

    let payment: Row;

    try {
      payment =
        await findPayment(body);
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
     * CREATE/FIND EXTERNAL DISPUTE
     * ========================================================
     */

    let dispute: Row;

    try {
      dispute =
        await getOrCreateDispute(
          payment,
          body,
          eventType,
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
        500,
      );
    }

    /*
     * ========================================================
     * APPLY PROVIDER EVENT
     * ========================================================
     */

    let result: Row = {};

    try {
      if (
        eventType ===
          "chargeback_opened" ||
        eventType ===
          "dispute_opened"
      ) {
        result = {
          action:
            "seller_money_frozen",

          allocations:
            await freezeSellerMoney(
              payment,
              body,
              dispute,
              eventType,
            ),
        };
      } else if (
        eventType ===
          "payment_reversed" ||
        eventType ===
          "dispute_lost"
      ) {
        result = {
          action:
            "external_dispute_lost",

          ...(
            await resolveLost(
              payment,
              body,
              dispute,
              eventType,
            )
          ),
        };
      } else if (
        eventType ===
          "dispute_won"
      ) {
        result = {
          action:
            "external_dispute_won",

          ...(
            await resolveWon(
              payment,
              body,
              dispute,
            )
          ),
        };
      } else {
        /*
         * Closed without a clear won/lost result.
         *
         * Do not guess what happened financially.
         */

        const now =
          new Date().toISOString();

        await db
          .from("disputes")
          .update({
            dispute_status:
              "closed",

            resolution_notes:
              "External payment dispute closed without explicit won/lost outcome.",

            resolved_at:
              now,

            updated_at:
              now,
          })
          .eq(
            "id",
            dispute.id,
          );

        result = {
          action:
            "dispute_closed_recorded",

          financial_state_changed:
            false,
        };
      }
    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      console.error(
        VERSION,
        "payment dispute processing failed",
        reason,
      );

      return response(
        {
          ok: false,
          provider,
          provider_event_id:
            eventId,
          event_type:
            eventType,
          dispute_id:
            dispute.id,
          error:
            reason,
        },
        500,
      );
    }

    /*
     * ========================================================
     * AUDIT EVENT
     * ========================================================
     */

    try {
      await recordEvent(
        dispute,
        provider,
        eventId,
        eventType,
        body,
      );
    } catch (e) {
      /*
       * Financial state may already have changed.
       *
       * Never replay the financial action blindly merely
       * because audit-event recording failed.
       */

      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      console.error(
        VERSION,
        "financial action completed but dispute event recording failed",
        reason,
      );

      return response(
        {
          ok: false,
          reconciliation_required:
            true,
          provider,
          provider_event_id:
            eventId,
          event_type:
            eventType,
          dispute_id:
            dispute.id,
          result,
          error:
            reason,
        },
        500,
      );
    }

    /*
     * ========================================================
     * SUCCESS
     *
     * This does NOT change Shop&Drop's normal refund policy.
     *
     * Shop&Drop commission is not automatically refunded.
     * Courier money is not refunded by Shop&Drop.
     *
     * This function only protects/reconciles external
     * bank/card/payment-provider actions.
     * ========================================================
     */

    return response({
      ok: true,

      provider,

      provider_event_id:
        eventId,

      event_type:
        eventType,

      payment_id:
        payment.id,

      order_id:
        payment.order_id,

      dispute_id:
        dispute.id,

      result,

      policy: {
        normal_shopdrop_refund:
          false,

        external_provider_action:
          true,

        shopdrop_commission_automatically_refunded:
          false,

        courier_refunded_by_shopdrop:
          false,

        seller_payout_protected:
          true,

        admin_reconciliation_if_already_paid:
          true,
      },
    });
  },
);


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-R12I-REFUND-WORKER-V1";

const URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db =
  createClient(
    URL,
    SERVICE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

type Row =
  Record<string, any>;

function reply(
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

function clean(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}

function amount(
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

function providerCode(
  value: unknown,
) {
  return clean(value)
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

function refundEnv(
  provider: string,
  name: string,
) {
  return Deno.env.get(
    `SHOPDROP_PAYMENT_${envPart(provider)}_${name}`,
  ) ?? "";
}


/*
 * ============================================================
 * SHOP&DROP AUTOMATIC NON-DELIVERY REFUND WORKER
 *
 * NORMAL POLICY:
 *
 * Shop&Drop is marketplace/intermediary.
 *
 * Terminal courier-confirmed non-delivery:
 *
 * exact seller product allocation
 * ->
 * buyer refund.
 *
 * Shop&Drop commission:
 * RETAINED.
 *
 * Courier money:
 * OUTSIDE this refund.
 *
 * Temporary delay:
 * NO REFUND.
 *
 * Seller already paid:
 * NO AUTOMATIC REFUND through this path.
 *
 * Admin discretionary exception:
 * separate process.
 *
 * ============================================================
 */


/*
 * ============================================================
 * FIND REFUNDS READY FOR PROVIDER
 * ============================================================
 */

async function getReadyRefunds(
  limit = 10,
) {
  const {
    data,
    error,
  } =
    await db
      .from("refunds")
      .select("*")
      .eq(
        "refund_type",
        "non_delivery",
      )
      .in(
        "refund_status",
        [
          "ready_for_provider",
          "retry_pending",
        ],
      )
      .order(
        "requested_at",
        {
          ascending: true,
        },
      )
      .limit(limit);


  if (error) {
    throw new Error(
      `refund_lookup_failed:${error.message}`,
    );
  }


  return Array.isArray(data)
    ? data
    : [];
}


/*
 * ============================================================
 * CLAIM REFUND
 *
 * Prevent two workers from processing the same refund.
 * ============================================================
 */

async function claimRefund(
  refund: Row,
) {
  const {
    data,
    error,
  } =
    await db
      .from("refunds")
      .update({
        refund_status:
          "processing",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        refund.id,
      )
      .in(
        "refund_status",
        [
          "ready_for_provider",
          "retry_pending",
        ],
      )
      .select("*")
      .maybeSingle();


  if (error) {
    throw new Error(
      `refund_claim_failed:${error.message}`,
    );
  }


  return data ?? null;
}


/*
 * ============================================================
 * LOAD EXACT PRODUCT ALLOCATION
 *
 * This is the authoritative refund amount.
 *
 * NEVER commission allocation.
 * NEVER courier allocation.
 * ============================================================
 */

async function getAllocation(
  refund: Row,
) {
  if (
    !refund.payment_allocation_id
  ) {
    throw new Error(
      "refund_payment_allocation_missing",
    );
  }


  const {
    data,
    error,
  } =
    await db
      .from(
        "payment_allocations",
      )
      .select("*")
      .eq(
        "id",
        refund.payment_allocation_id,
      )
      .eq(
        "allocation_type",
        "seller",
      )
      .maybeSingle();


  if (
    error ||
    !data
  ) {
    throw new Error(
      `seller_product_allocation_not_found:${
        error?.message ??
        "missing"
      }`,
    );
  }


  return data;
}


/*
 * ============================================================
 * LOAD ORIGINAL PAYMENT
 *
 * Refund MUST return through the provider associated with the
 * original buyer payment.
 * ============================================================
 */

async function getPayment(
  refund: Row,
) {
  if (!refund.payment_id) {
    throw new Error(
      "refund_payment_missing",
    );
  }


  const {
    data,
    error,
  } =
    await db
      .from("payments")
      .select("*")
      .eq(
        "id",
        refund.payment_id,
      )
      .maybeSingle();


  if (
    error ||
    !data
  ) {
    throw new Error(
      `original_payment_not_found:${
        error?.message ??
        "missing"
      }`,
    );
  }


  return data;
}


/*
 * ============================================================
 * FINANCIAL SAFETY CHECKS
 * ============================================================
 */

function validateRefund(
  refund: Row,
  allocation: Row,
  payment: Row,
) {
  if (
    clean(
      allocation.id,
    ) !==
    clean(
      refund.payment_allocation_id,
    )
  ) {
    throw new Error(
      "refund_allocation_mismatch",
    );
  }


  if (
    clean(
      allocation.order_id,
    ) !==
    clean(
      refund.order_id,
    )
  ) {
    throw new Error(
      "refund_order_mismatch",
    );
  }


  if (
    clean(
      allocation.seller_id,
    ) !==
    clean(
      refund.seller_id,
    )
  ) {
    throw new Error(
      "refund_seller_mismatch",
    );
  }


  if (
    clean(
      allocation.fulfilment_group_id,
    ) !==
    clean(
      refund.fulfilment_group_id,
    )
  ) {
    throw new Error(
      "refund_fulfilment_group_mismatch",
    );
  }


  if (
    clean(
      allocation.payment_id,
    ) !==
    clean(
      payment.id,
    )
  ) {
    throw new Error(
      "refund_payment_relationship_mismatch",
    );
  }


  if (
    allocation.allocation_type !==
    "seller"
  ) {
    throw new Error(
      "refund_must_use_seller_product_allocation",
    );
  }


  /*
   * The SQL foundation moved this exact allocation into
   * seller_refund_pending.
   */

  if (
    allocation.status !==
    "seller_refund_pending"
  ) {
    throw new Error(
      "seller_allocation_not_refund_pending",
    );
  }


  if (
    allocation.settled_at
  ) {
    throw new Error(
      "seller_allocation_already_settled",
    );
  }


  const authoritative =
    amount(
      allocation.amount,
    );


  const requested =
    amount(
      refund.refund_amount,
    );


  if (
    authoritative === null ||
    requested === null ||
    authoritative < 0 ||
    requested < 0
  ) {
    throw new Error(
      "invalid_refund_amount",
    );
  }


  if (
    authoritative !==
    requested
  ) {
    throw new Error(
      "refund_amount_mismatch",
    );
  }


  /*
   * This worker NEVER includes commission or courier money.
   */

  if (
    refund.refund_type !==
    "non_delivery"
  ) {
    throw new Error(
      "unsupported_automatic_refund_type",
    );
  }


  return {
    amount:
      authoritative,

    currency:
      clean(
        allocation.currency,
      ).toUpperCase(),
  };
}


/*
 * ============================================================
 * PAYMENT PROVIDER REFUND
 *
 * Provider-neutral.
 *
 * Uses original payment provider.
 * ============================================================
 */

async function submitRefund(
  refund: Row,
  allocation: Row,
  payment: Row,
  financial: Row,
) {
  const code =
    providerCode(
      payment.provider_code ??
      payment.payment_provider ??
      payment.provider,
    );


  if (!code) {
    return {
      ok: false,
      retryable: false,
      error:
        "original_payment_provider_missing",
    };
  }


  const refundUrl =
    refundEnv(
      code,
      "REFUND_URL",
    );


  const apiKey =
    refundEnv(
      code,
      "API_KEY",
    );


  const authHeader =
    refundEnv(
      code,
      "AUTH_HEADER",
    ) ||
    "Authorization";


  /*
   * Provider not activated yet.
   *
   * Never pretend buyer was refunded.
   */

  if (
    !refundUrl ||
    !apiKey
  ) {
    return {
      ok: false,

      activation_required:
        true,

      provider_code:
        code,

      error:
        "refund_provider_activation_required",
    };
  }


  const providerPaymentReference =
    clean(
      payment.provider_payment_reference ??
      payment.payment_reference ??
      payment.provider_reference,
    );


  if (
    !providerPaymentReference
  ) {
    return {
      ok: false,
      retryable: false,
      error:
        "provider_payment_reference_missing",
    };
  }


  if (
    !/^[A-Z]{3}$/.test(
      financial.currency,
    )
  ) {
    return {
      ok: false,
      retryable: false,
      error:
        "invalid_refund_currency",
    };
  }


  const payload = {
    shopdrop_refund_id:
      refund.id,

    shopdrop_order_id:
      refund.order_id,

    payment_allocation_id:
      allocation.id,

    seller_id:
      allocation.seller_id,

    fulfilment_group_id:
      allocation.fulfilment_group_id,

    provider_payment_reference:
      providerPaymentReference,

    amount:
      financial.amount,

    currency:
      financial.currency,

    reason:
      "confirmed_non_delivery",

    idempotency_key:
      `shopdrop-refund-${refund.id}`,

    metadata: {
      seller_product_only:
        true,

      shopdrop_commission_refunded:
        false,

      courier_refunded_by_shopdrop:
        false,

      automatic:
        true,
    },
  };


  let res: Response;


  try {
    res =
      await fetch(
        refundUrl,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            [authHeader]:
              apiKey,

            "x-shopdrop-idempotency-key":
              `shopdrop-refund-${refund.id}`,

            "x-shopdrop-refund-id":
              refund.id,
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
        `refund_provider_network_error:${
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
        `refund_provider_http_${res.status}`,

      provider_response:
        data,
    };
  }


  const providerRefundReference =
    clean(
      data.provider_refund_reference ??
      data.refund_reference ??
      data.refund_id ??
      data.id,
    );


  if (
    !providerRefundReference
  ) {
    return {
      ok: false,
      retryable: false,

      error:
        "provider_refund_reference_missing",

      provider_response:
        data,
    };
  }


  const providerStatus =
    clean(
      data.status ??
      data.refund_status,
    )
      .toLowerCase();


  const completed =
    [
      "refunded",
      "completed",
      "succeeded",
      "settled",
    ].includes(
      providerStatus,
    );


  return {
    ok: true,

    provider_code:
      code,

    provider_refund_reference:
      providerRefundReference,

    provider_status:
      providerStatus ||
      "submitted",

    completed,

    provider_response:
      data,
  };
}

// END BLOCK 1 — ATTACH BLOCK 2 DIRECTLY BELOW
/*
 * ============================================================
 * REFUND FAILURE / RETRY
 *
 * A failed provider call must NEVER be recorded as refunded.
 * ============================================================
 */

async function refundFailure(
  refund: Row,
  allocation: Row | null,
  reason: string,
  retryable: boolean,
  providerResponse: Row = {},
) {
  const status =
    retryable
      ? "retry_pending"
      : "exception";

  const now =
    new Date().toISOString();

  await db
    .from("refunds")
    .update({
      refund_status: status,

      metadata: {
        ...(refund.metadata ?? {}),

        last_error: reason,

        provider_response:
          providerResponse,

        last_failure_at:
          now,
      },

      updated_at: now,
    })
    .eq(
      "id",
      refund.id,
    );


  /*
   * Keep seller money blocked from payout.
   *
   * Even if the provider refund temporarily fails, the seller
   * must NOT suddenly become payout eligible.
   */

  if (allocation) {
    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          "seller_refund_pending",

        last_error:
          reason,

        metadata: {
          ...(allocation.metadata ?? {}),

          refund_id:
            refund.id,

          refund_error:
            reason,

          refund_provider_response:
            providerResponse,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        allocation.id,
      );
  }


  return {
    refund_id:
      refund.id,

    ok: false,

    status,

    retryable,

    error:
      reason,
  };
}


/*
 * ============================================================
 * REFUND EVENT
 * ============================================================
 */

async function addRefundEvent(
  refund: Row,
  allocation: Row,
  eventType: string,
  status: string,
  providerResult: Row = {},
) {
  const {
    error,
  } =
    await db
      .from("refund_events")
      .insert({
        order_id:
          refund.order_id,

        user_id:
          refund.buyer_id,

        event_type:
          eventType,

        amount:
          refund.refund_amount,

        currency:
          allocation.currency,

        status,

        refund_reference:
          providerResult
            .provider_refund_reference ??
          refund.refund_reference ??
          null,

        event_data: {
          refund_id:
            refund.id,

          seller_id:
            refund.seller_id,

          fulfilment_group_id:
            refund.fulfilment_group_id,

          payment_allocation_id:
            allocation.id,

          provider_code:
            providerResult
              .provider_code ??
            refund.provider_code ??
            null,

          provider_status:
            providerResult
              .provider_status ??
            null,

          shopdrop_commission_refunded:
            false,

          courier_refunded_by_shopdrop:
            false,

          seller_product_only:
            true,
        },

        created_at:
          new Date()
            .toISOString(),
      });


  if (error) {
    console.error(
      VERSION,
      "refund event insert failed",
      error,
    );
  }
}


/*
 * ============================================================
 * BUYER NOTIFICATION
 *
 * No seller private details.
 * No banking/payment credentials.
 * ============================================================
 */

async function notifyBuyer(
  buyerId: string,
  refundId: string,
  subject: string,
  message: string,
) {
  if (!buyerId) return;


  const {
    error,
  } =
    await db.rpc(
      "enqueue_message",
      {
        p_event_key:
          `refund:${refundId}:${subject}`,

        p_user_id:
          buyerId,

        p_channel:
          "email",

        p_notification_type:
          subject === "Shop&Drop product refund completed"
            ? "refund_completed"
            : subject === "Shop&Drop product refund submitted"
            ? "refund_requested"
            : "account_notice",

        p_subject:
          subject,

        p_message_body:
          message,
      },
    );


  if (error) {
    console.error(
      VERSION,
      "refund notification failed",
      error,
    );
  }
}


/*
 * ============================================================
 * PROVIDER CONFIRMED REFUND COMPLETE
 *
 * This is the only normal path that changes the seller
 * allocation from refund_pending to buyer_refunded.
 * ============================================================
 */

async function completeRefund(
  refund: Row,
  allocation: Row,
  providerResult: Row,
) {
  const now =
    new Date().toISOString();


  const {
    error:
      refundError,
  } =
    await db
      .from("refunds")
      .update({
        refund_status:
          "refunded",

        refund_reference:
          providerResult
            .provider_refund_reference,

        provider_code:
          providerResult
            .provider_code,

        provider_refund_reference:
          providerResult
            .provider_refund_reference,

        processed_at:
          now,

        metadata: {
          ...(refund.metadata ?? {}),

          provider_status:
            providerResult
              .provider_status,

          provider_response:
            providerResult
              .provider_response ??
            {},

          completed_at:
            now,

          shopdrop_commission_refunded:
            false,

          courier_refunded_by_shopdrop:
            false,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        refund.id,
      );


  if (refundError) {
    throw new Error(
      `refund_completion_record_failed:${refundError.message}`,
    );
  }


  const {
    error:
      allocationError,
  } =
    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          "buyer_refunded",

        provider_code:
          providerResult
            .provider_code,

        provider_settlement_reference:
          providerResult
            .provider_refund_reference,

        settled_at:
          now,

        last_error:
          null,

        metadata: {
          ...(allocation.metadata ?? {}),

          refund_id:
            refund.id,

          provider_refund_reference:
            providerResult
              .provider_refund_reference,

          buyer_refunded_at:
            now,

          shopdrop_commission_refunded:
            false,

          courier_refunded_by_shopdrop:
            false,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        allocation.id,
      );


  if (allocationError) {
    throw new Error(
      `refund_allocation_completion_failed:${allocationError.message}`,
    );
  }


  await addRefundEvent(
    refund,
    allocation,
    "non_delivery_refund_completed",
    "refunded",
    providerResult,
  );


  return {
    refund_id:
      refund.id,

    payment_allocation_id:
      allocation.id,

    ok: true,

    status:
      "refunded",

    refund_amount:
      refund.refund_amount,

    currency:
      allocation.currency,

    provider_refund_reference:
      providerResult
        .provider_refund_reference,

    shopdrop_commission_refunded:
      false,

    courier_refunded_by_shopdrop:
      false,
  };
}


/*
 * ============================================================
 * PROVIDER ACCEPTED REFUND BUT HAS NOT CONFIRMED COMPLETION
 *
 * Never call this "refunded".
 * ============================================================
 */

async function markRefundSubmitted(
  refund: Row,
  allocation: Row,
  providerResult: Row,
) {
  const now =
    new Date().toISOString();


  const {
    error:
      refundError,
  } =
    await db
      .from("refunds")
      .update({
        refund_status:
          "submitted",

        refund_reference:
          providerResult
            .provider_refund_reference,

        provider_code:
          providerResult
            .provider_code,

        provider_refund_reference:
          providerResult
            .provider_refund_reference,

        metadata: {
          ...(refund.metadata ?? {}),

          provider_status:
            providerResult
              .provider_status,

          provider_response:
            providerResult
              .provider_response ??
            {},

          submitted_at:
            now,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        refund.id,
      );


  if (refundError) {
    throw new Error(
      `refund_submission_record_failed:${refundError.message}`,
    );
  }


  /*
   * Seller money remains blocked.
   */

  const {
    error:
      allocationError,
  } =
    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          "seller_refund_pending",

        provider_code:
          providerResult
            .provider_code,

        provider_allocation_reference:
          providerResult
            .provider_refund_reference,

        last_error:
          null,

        metadata: {
          ...(allocation.metadata ?? {}),

          refund_id:
            refund.id,

          provider_refund_reference:
            providerResult
              .provider_refund_reference,

          refund_submitted_at:
            now,
        },

        updated_at:
          now,
      })
      .eq(
        "id",
        allocation.id,
      );


  if (allocationError) {
    throw new Error(
      `refund_allocation_submission_failed:${allocationError.message}`,
    );
  }


  await addRefundEvent(
    refund,
    allocation,
    "non_delivery_refund_submitted",
    "submitted",
    providerResult,
  );


  return {
    refund_id:
      refund.id,

    payment_allocation_id:
      allocation.id,

    ok: true,

    status:
      "submitted",

    provider_refund_reference:
      providerResult
        .provider_refund_reference,
  };
}


/*
 * ============================================================
 * PROCESS ONE REFUND
 * ============================================================
 */

async function processRefund(
  candidate: Row,
) {
  /*
   * Claim it first.
   */

  let refund:
    Row | null = null;


  try {
    refund =
      await claimRefund(
        candidate,
      );

  } catch (e) {
    return {
      refund_id:
        candidate.id,

      ok: false,

      status:
        "claim_failed",

      error:
        e instanceof Error
          ? e.message
          : String(e),
    };
  }


  /*
   * Another worker already claimed it.
   */

  if (!refund) {
    return {
      refund_id:
        candidate.id,

      ok: true,

      skipped:
        true,

      status:
        "already_claimed",
    };
  }


  let allocation:
    Row | null = null;


  try {
    allocation =
      await getAllocation(
        refund,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    return await refundFailure(
      refund,
      null,
      reason,
      false,
    );
  }


  let payment:
    Row;


  try {
    payment =
      await getPayment(
        refund,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    return await refundFailure(
      refund,
      allocation,
      reason,
      false,
    );
  }


  let financial:
    Row;


  try {
    financial =
      validateRefund(
        refund,
        allocation,
        payment,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    return await refundFailure(
      refund,
      allocation,
      reason,
      false,
    );
  }


  /*
   * Submit only the exact seller product allocation.
   */

  const providerResult =
    await submitRefund(
      refund,
      allocation,
      payment,
      financial,
    );


  if (!providerResult.ok) {

    /*
     * Payment provider has not been activated/configured yet.
     *
     * Seller remains blocked.
     * Buyer is NOT falsely told refund completed.
     */

    if (
      providerResult
        .activation_required
    ) {
      const now =
        new Date()
          .toISOString();


      await db
        .from("refunds")
        .update({
          refund_status:
            "activation_required",

          provider_code:
            providerResult
              .provider_code ??
            null,

          metadata: {
            ...(refund.metadata ?? {}),

            last_error:
              providerResult.error,

            activation_required:
              true,
          },

          updated_at:
            now,
        })
        .eq(
          "id",
          refund.id,
        );


      await db
        .from(
          "payment_allocations",
        )
        .update({
          status:
            "seller_refund_pending",

          last_error:
            providerResult.error,

          updated_at:
            now,
        })
        .eq(
          "id",
          allocation.id,
        );


      return {
        refund_id:
          refund.id,

        ok: false,

        activation_required:
          true,

        status:
          "activation_required",

        provider_code:
          providerResult
            .provider_code ??
          null,

        error:
          providerResult.error,
      };
    }


    return await refundFailure(
      refund,
      allocation,

      providerResult.error ??
      "refund_provider_failed",

      providerResult.retryable ===
        true,

      providerResult
        .provider_response ??
      {},
    );
  }


  /*
   * Provider explicitly says refund completed.
   */

  if (
    providerResult.completed
  ) {
    let completed:
      Row;


    try {
      completed =
        await completeRefund(
          refund,
          allocation,
          providerResult,
        );

    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : String(e);


      /*
       * Provider says money has already been refunded.
       *
       * NEVER blindly send another refund.
       */

      await db
        .from("refunds")
        .update({
          refund_status:
            "reconciliation_required",

          provider_code:
            providerResult
              .provider_code,

          provider_refund_reference:
            providerResult
              .provider_refund_reference,

          refund_reference:
            providerResult
              .provider_refund_reference,

          metadata: {
            ...(refund.metadata ?? {}),

            provider_reports_completed:
              true,

            reconciliation_error:
              reason,

            provider_response:
              providerResult
                .provider_response ??
              {},
          },

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          refund.id,
        );


      await db
        .from(
          "payment_allocations",
        )
        .update({
          status:
            "reconciliation_required",

          last_error:
            reason,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          allocation.id,
        );


      return {
        refund_id:
          refund.id,

        ok: false,

        provider_reports_completed:
          true,

        status:
          "reconciliation_required",

        error:
          reason,
      };
    }


    await notifyBuyer(
      refund.buyer_id,

      refund.id,

      "Shop&Drop product refund completed",

      `Your product refund of ${
        financial.amount.toFixed(2)
      } ${
        financial.currency
      } for the confirmed non-delivery has been completed.`,
    );


    return completed;
  }


  /*
   * Provider accepted but settlement is still pending.
   */

  let submitted:
    Row;


  try {
    submitted =
      await markRefundSubmitted(
        refund,
        allocation,
        providerResult,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);


    /*
     * Provider accepted the refund.
     *
     * Do NOT resubmit blindly.
     */

    await db
      .from("refunds")
      .update({
        refund_status:
          "reconciliation_required",

        provider_code:
          providerResult
            .provider_code,

        provider_refund_reference:
          providerResult
            .provider_refund_reference,

        refund_reference:
          providerResult
            .provider_refund_reference,

        metadata: {
          ...(refund.metadata ?? {}),

          provider_accepted:
            true,

          reconciliation_error:
            reason,

          provider_response:
            providerResult
              .provider_response ??
            {},
        },

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        refund.id,
      );


    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          "reconciliation_required",

        last_error:
          reason,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        allocation.id,
      );


    return {
      refund_id:
        refund.id,

      ok: false,

      provider_accepted:
        true,

      status:
        "reconciliation_required",

      error:
        reason,
    };
  }


  await notifyBuyer(
    refund.buyer_id,

    refund.id,

    "Shop&Drop product refund submitted",

    `Your product refund of ${
      financial.amount.toFixed(2)
    } ${
      financial.currency
    } for the confirmed non-delivery has been submitted to the payment provider.`,
  );


  return submitted;
}

// END BLOCK 2 — ATTACH BLOCK 3 DIRECTLY BELOW
/*
 * ============================================================
 * AUTOMATIC REFUND WORKER
 *
 * This function processes only refund records already created
 * by the protected non-delivery SQL foundation.
 *
 * It does NOT accept:
 *
 * browser-selected refund amounts
 * browser-selected sellers
 * browser-selected payment allocations
 * browser-selected payout destinations
 *
 * The authoritative refund amount comes only from the exact
 * seller payment allocation.
 *
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
      !URL ||
      !SERVICE_KEY
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


    // FIX 20D: Verify the scheduler's dedicated Vault token before refund access.
    const workerToken = req.headers.get("x-shopdrop-worker-token") ?? "";
    if (!/^[0-9a-f]{64}$/.test(workerToken)) {
      return reply({ ok: false, error: "unauthorized" }, 401);
    }
    let authorized = false;
    try {
      const { data, error } = await db.rpc("shopdrop_verify_refund_worker", {
        p_token: workerToken,
      });
      authorized = !error && data === true;
    } catch (_error) {
      authorized = false;
    }
    if (!authorized) {
      return reply({ ok: false, error: "unauthorized" }, 401);
    }

    /*
     * ========================================================
     * FIND REFUNDS READY FOR PROVIDER PROCESSING
     * ========================================================
     */

    let refunds:
      Row[] = [];


    try {
      refunds =
        await getReadyRefunds(
          10,
        );

    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      console.error(
        VERSION,
        "refund lookup failed",
        reason,
      );

      return reply(
        {
          ok: false,

          error:
            reason,
        },
        500,
      );
    }


    /*
     * No refunds waiting.
     *
     * This is a normal successful worker run.
     */

    if (
      refunds.length === 0
    ) {
      return reply({
        ok: true,

        ready:
          0,

        processed:
          0,

        message:
          "No non-delivery refunds ready for processing.",
      });
    }


    /*
     * ========================================================
     * PROCESS EACH REFUND INDEPENDENTLY
     *
     * One failed refund must not stop unrelated refunds.
     * ========================================================
     */

    const results:
      Row[] = [];


    for (
      const refund
      of refunds
    ) {
      try {
        const result =
          await processRefund(
            refund,
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
          "unexpected refund processing error",
          refund.id,
          reason,
        );


        /*
         * Unexpected worker error.
         *
         * Never mark buyer refunded.
         * Never release seller money.
         */

        await db
          .from("refunds")
          .update({
            refund_status:
              "retry_pending",

            metadata: {
              ...(refund.metadata ?? {}),

              unexpected_worker_error:
                reason,

              unexpected_worker_error_at:
                new Date()
                  .toISOString(),
            },

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            refund.id,
          );


        if (
          refund.payment_allocation_id
        ) {
          await db
            .from(
              "payment_allocations",
            )
            .update({
              status:
                "seller_refund_pending",

              last_error:
                reason,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              refund.payment_allocation_id,
            );
        }


        results.push({
          refund_id:
            refund.id,

          ok: false,

          status:
            "retry_pending",

          error:
            reason,
        });
      }
    }


    /*
     * ========================================================
     * WORKER SUMMARY
     * ========================================================
     */

    const refunded =
      results.filter(
        (item) =>
          item.status ===
          "refunded",
      ).length;


    const submitted =
      results.filter(
        (item) =>
          item.status ===
          "submitted",
      ).length;


    const activationRequired =
      results.filter(
        (item) =>
          item.activation_required ===
          true,
      ).length;


    const retryPending =
      results.filter(
        (item) =>
          item.status ===
          "retry_pending",
      ).length;


    const exceptions =
      results.filter(
        (item) =>
          item.status ===
            "exception" ||
          item.status ===
            "reconciliation_required",
      ).length;


    /*
     * ========================================================
     * RESPONSE
     *
     * "processed" does NOT mean "refunded".
     *
     * Individual provider states remain authoritative.
     * ========================================================
     */

    return reply({
      ok: true,

      ready:
        refunds.length,

      processed:
        results.length,

      refunded,

      submitted,

      activation_required:
        activationRequired,

      retry_pending:
        retryPending,

      exceptions,

      results,

      policy: {
        refund_type:
          "confirmed_non_delivery",

        seller_product_only:
          true,

        shopdrop_commission_refunded:
          false,

        courier_refunded_by_shopdrop:
          false,

        temporary_delay_triggers_refund:
          false,

        seller_can_be_paid_and_refunded:
          false,

        admin_exception_separate:
          true,
      },
    });

  },
);
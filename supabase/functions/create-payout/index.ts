import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-R12H-CREATE-PAYOUT-V2";

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

function payoutEnv(
  provider: string,
  name: string,
) {
  return Deno.env.get(
    `SHOPDROP_PAYOUT_${envPart(provider)}_${name}`,
  ) ?? "";
}


/*
 * ============================================================
 * SHOP&DROP SELLER PAYOUT
 *
 * CONTROLLING RULE:
 *
 * payment received
 * != seller payout
 *
 * courier booked
 * != seller payout
 *
 * in transit
 * != seller payout
 *
 * verified delivered
 * ->
 * exact seller allocation becomes seller_payout_eligible
 * ->
 * automatic seller payout record
 * ->
 * payout provider
 * ->
 * provider confirmation
 * ->
 * seller allocation settled
 *
 * NO INSPECTION PERIOD.
 *
 * One seller's delivery must NEVER release another seller.
 * ============================================================
 */


/*
 * ============================================================
 * CREATE PAYOUT RECORDS FROM ELIGIBLE A2 ALLOCATIONS
 *
 * SQL installed successfully:
 *
 * create_pending_eligible_seller_payouts(integer)
 * ============================================================
 */

async function createEligiblePayouts() {
  const {
    data,
    error,
  } =
    await db.rpc(
      "create_pending_eligible_seller_payouts",
      {
        p_limit: 25,
      },
    );

  if (error) {
    throw new Error(
      `automatic_payout_creation_failed:${error.message}`,
    );
  }

  return data;
}


/*
 * ============================================================
 * FIND A2 SELLER ALLOCATION FOR PAYOUT
 *
 * This is the authoritative money source.
 *
 * We do NOT recalculate commission here.
 *
 * Seller allocation already contains seller proceeds after
 * Shop&Drop commission was separated.
 * ============================================================
 */

async function getSellerAllocation(
  payout: Row,
) {
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
        "order_id",
        payout.order_id,
      )
      .eq(
        "seller_id",
        payout.seller_id,
      )
      .eq(
        "allocation_type",
        "seller",
      )
      .in(
        "status",
        [
          "seller_payout_created",
          "seller_payout_processing",
          "seller_payout_submitted",
          "seller_payout_eligible",
        ],
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (
    error ||
    !data
  ) {
    throw new Error(
      `eligible_seller_allocation_not_found:${
        error?.message ??
        "missing"
      }`,
    );
  }

  return data;
}


/*
 * ============================================================
 * SELLER PAYOUT PROFILE
 *
 * Existing Shop&Drop payout architecture requires a verified
 * beneficiary/payment destination.
 *
 * No bank account details are accepted from browser input at
 * payout execution time.
 * ============================================================
 */

async function getPayoutProfile(
  sellerId: string,
) {
  const {
    data,
    error,
  } =
    await db
      .from(
        "seller_payout_profiles",
      )
      .select("*")
      .eq(
        "seller_id",
        sellerId,
      )
      .eq(
        "is_verified",
        true,
      )
      .order(
        "updated_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (
    error ||
    !data
  ) {
    throw new Error(
      "verified_seller_payout_profile_required",
    );
  }

  return data;
}


/*
 * ============================================================
 * PAYOUT PROVIDER
 *
 * Provider-neutral.
 *
 * No payment company is hard-coded.
 * ============================================================
 */

async function getProvider(
  payoutProfile: Row,
) {
  let provider:
    Row | null = null;

  if (
    payoutProfile.provider_id
  ) {
    const {
      data,
    } =
      await db
        .from(
          "payment_providers",
        )
        .select("*")
        .eq(
          "id",
          payoutProfile.provider_id,
        )
        .maybeSingle();

    provider =
      data ?? null;
  }


  if (!provider) {
    const requested =
      providerCode(
        payoutProfile.provider_code ??
        payoutProfile.provider ??
        "",
      );

    if (requested) {
      const {
        data,
      } =
        await db
          .from(
            "payment_providers",
          )
          .select("*")
          .eq(
            "provider_code",
            requested,
          )
          .maybeSingle();

      provider =
        data ?? null;
    }
  }


  if (!provider) {
    throw new Error(
      "payout_provider_not_configured",
    );
  }


  const active =
    provider.active ??
    provider.enabled ??
    provider.is_active ??
    true;


  if (active === false) {
    throw new Error(
      "payout_provider_inactive",
    );
  }


  return provider;
}


/*
 * ============================================================
 * CALL PAYOUT PROVIDER ADAPTER
 * ============================================================
 */

async function submitPayout(
  payout: Row,
  allocation: Row,
  profile: Row,
  provider: Row,
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
        "payout_provider_code_missing",
    };
  }


  const payoutUrl =
    payoutEnv(
      code,
      "URL",
    );


  const apiKey =
    payoutEnv(
      code,
      "API_KEY",
    );


  const authHeader =
    payoutEnv(
      code,
      "AUTH_HEADER",
    ) ||
    "Authorization";


  /*
   * Provider not activated yet.
   *
   * Never pretend seller was paid.
   */

  if (
    !payoutUrl ||
    !apiKey
  ) {
    return {
      ok: false,

      activation_required:
        true,

      provider_code:
        code,

      error:
        "payout_provider_activation_required",
    };
  }


  const authoritativeAmount =
    money(
      allocation.amount,
    );


  const payoutAmount =
    money(
      payout.payout_amount,
    );


  if (
    authoritativeAmount === null ||
    payoutAmount === null ||
    authoritativeAmount < 0 ||
    payoutAmount < 0
  ) {
    return {
      ok: false,
      retryable: false,
      error:
        "invalid_payout_amount",
    };
  }


  /*
   * Hard financial protection.
   *
   * seller_payouts amount MUST equal A2 seller allocation.
   */

  if (
    authoritativeAmount !==
    payoutAmount
  ) {
    return {
      ok: false,
      retryable: false,

      error:
        "payout_allocation_amount_mismatch",

      allocation_amount:
        authoritativeAmount,

      payout_amount:
        payoutAmount,
    };
  }


  const currency =
    clean(
      allocation.currency ??
      payout.currency ??
      profile.currency,
    )
      .toUpperCase();


  if (
    !/^[A-Z]{3}$/.test(
      currency,
    )
  ) {
    return {
      ok: false,
      retryable: false,
      error:
        "invalid_payout_currency",
    };
  }


  /*
   * Only the stored/verified provider beneficiary reference
   * is sent.
   *
   * Browser cannot substitute payout destination.
   */

  const beneficiaryReference =
    clean(
      profile.provider_beneficiary_reference ??
      profile.beneficiary_reference ??
      profile.provider_account_reference ??
      profile.account_reference,
    );


  if (!beneficiaryReference) {
    return {
      ok: false,
      retryable: false,
      error:
        "verified_beneficiary_reference_missing",
    };
  }


  const payload = {
    shopdrop_payout_id:
      payout.id,

    shopdrop_order_id:
      payout.order_id,

    seller_id:
      payout.seller_id,

    allocation_id:
      allocation.id,

    fulfilment_group_id:
      allocation.fulfilment_group_id,

    amount:
      authoritativeAmount,

    currency,

    beneficiary_reference:
      beneficiaryReference,

    idempotency_key:
      `shopdrop-seller-payout-${payout.id}`,

    metadata: {
      purpose:
        "seller_product_proceeds",

      commission_already_separated:
        true,

      courier_money_excluded:
        true,

      verified_delivery_required:
        true,

      inspection_window:
        false,
    },
  };


  let res: Response;


  try {
    res =
      await fetch(
        payoutUrl,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            [authHeader]:
              apiKey,

            "x-shopdrop-idempotency-key":
              `shopdrop-seller-payout-${payout.id}`,

            "x-shopdrop-payout-id":
              payout.id,
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
        `payout_provider_network_error:${
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
        `payout_provider_http_${res.status}`,

      provider_response:
        data,
    };
  }


  const providerPayoutReference =
    clean(
      data.provider_payout_reference ??
      data.payout_reference ??
      data.transfer_reference ??
      data.transfer_id ??
      data.id,
    );


  if (!providerPayoutReference) {
    return {
      ok: false,
      retryable: false,

      error:
        "payout_provider_reference_missing",

      provider_response:
        data,
    };
  }


  const providerStatus =
    clean(
      data.status ??
      data.payout_status ??
      data.transfer_status,
    )
      .toLowerCase();


  /*
   * IMPORTANT:
   *
   * Provider accepting the request is NOT the same as money
   * settling in the seller's account.
   */

  const settled =
    [
      "paid",
      "settled",
      "completed",
      "succeeded",
    ].includes(
      providerStatus,
    );


  return {
    ok: true,

    provider_code:
      code,

    provider_payout_reference:
      providerPayoutReference,

    provider_status:
      providerStatus ||
      "submitted",

    settled,

    provider_response:
      data,
  };
}
/*
 * ============================================================
 * FIND PAYOUTS READY FOR AUTOMATIC PROCESSING
 *
 * The SQL bridge created seller_payouts from exact A2 seller
 * allocations after verified delivery.
 *
 * We process only payout records that are genuinely eligible
 * or safely retryable.
 * ============================================================
 */

async function getReadyPayouts(
  limit = 10,
) {
  const {
    data,
    error,
  } =
    await db
      .from("seller_payouts")
      .select("*")
      .in(
        "payout_status",
        [
          "eligible",
          "retry_pending",
        ],
      )
      .order(
        "eligible_at",
        {
          ascending: true,
        },
      )
      .limit(limit);


  if (error) {
    throw new Error(
      `seller_payout_claim_failed:${error.message}`,
    );
  }


  return Array.isArray(data)
    ? data
    : [];
}


/*
 * ============================================================
 * MARK PAYOUT PROCESSING
 *
 * Re-check current status before provider submission.
 *
 * This protects against two workers attempting the same payout
 * at the same time.
 * ============================================================
 */

async function claimPayout(
  payout: Row,
) {
  const {
    data,
    error,
  } =
    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "processing",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        payout.id,
      )
      .in(
        "payout_status",
        [
          "eligible",
          "retry_pending",
        ],
      )
      .select("*")
      .maybeSingle();


  if (error) {
    throw new Error(
      `seller_payout_claim_failed:${error.message}`,
    );
  }


  return data ?? null;
}


/*
 * ============================================================
 * SAFE RETRY / EXCEPTION
 *
 * A provider/network failure must NEVER make Shop&Drop mark
 * the seller as paid.
 * ============================================================
 */

async function payoutFailure(
  payout: Row,
  allocation: Row | null,
  reason: string,
  retryable: boolean,
  providerResponse: Row = {},
) {
  const status =
    retryable
      ? "retry_pending"
      : "exception";


  await db
    .from("seller_payouts")
    .update({
      payout_status:
        status,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      payout.id,
    );


  if (allocation) {
    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          retryable
            ? "seller_payout_created"
            : "exception",

        last_error:
          reason,

        metadata:
          {
            ...(
              allocation.metadata ??
              {}
            ),

            seller_payout_id:
              payout.id,

            payout_error:
              reason,

            payout_provider_response:
              providerResponse,
          },

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        allocation.id,
      );
  }


  return {
    payout_id:
      payout.id,

    ok: false,

    status,

    retryable,

    error:
      reason,
  };
}


/*
 * ============================================================
 * SETTLE PAYOUT
 *
 * Called only when provider explicitly confirms that the
 * seller payout is settled/paid/completed/succeeded.
 * ============================================================
 */

async function settlePayout(
  payout: Row,
  allocation: Row,
  providerResult: Row,
) {
  const now =
    new Date()
      .toISOString();


  const {
    error:
      payoutError,
  } =
    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "paid",

        payout_reference:
          providerResult
            .provider_payout_reference,

        paid_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        payout.id,
      );


  if (payoutError) {
    throw new Error(
      `seller_payout_settlement_record_failed:${payoutError.message}`,
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
          "seller_payout_settled",

        provider_code:
          providerResult
            .provider_code,

        provider_settlement_reference:
          providerResult
            .provider_payout_reference,

        settled_at:
          now,

        last_error:
          null,

        metadata:
          {
            ...(
              allocation.metadata ??
              {}
            ),

            seller_payout_id:
              payout.id,

            provider_payout_reference:
              providerResult
                .provider_payout_reference,

            payout_settled_at:
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
      `seller_allocation_settlement_failed:${allocationError.message}`,
    );
  }


  return {
    payout_id:
      payout.id,

    allocation_id:
      allocation.id,

    ok: true,

    status:
      "paid",

    provider_payout_reference:
      providerResult
        .provider_payout_reference,
  };
}


/*
 * ============================================================
 * PROVIDER ACCEPTED BUT NOT YET SETTLED
 *
 * This is deliberately NOT "paid".
 *
 * A later provider confirmation/webhook can complete the
 * settlement.
 * ============================================================
 */

async function markSubmitted(
  payout: Row,
  allocation: Row,
  providerResult: Row,
) {
  const now =
    new Date()
      .toISOString();


  const {
    error:
      payoutError,
  } =
    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "submitted",

        payout_reference:
          providerResult
            .provider_payout_reference,

        updated_at:
          now,
      })
      .eq(
        "id",
        payout.id,
      );


  if (payoutError) {
    throw new Error(
      `seller_payout_submission_record_failed:${payoutError.message}`,
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
          "seller_payout_submitted",

        provider_code:
          providerResult
            .provider_code,

        provider_allocation_reference:
          providerResult
            .provider_payout_reference,

        last_error:
          null,

        metadata:
          {
            ...(
              allocation.metadata ??
              {}
            ),

            seller_payout_id:
              payout.id,

            provider_payout_reference:
              providerResult
                .provider_payout_reference,

            payout_submitted_at:
              now,

            provider_status:
              providerResult
                .provider_status,
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
      `seller_allocation_submission_failed:${allocationError.message}`,
    );
  }


  return {
    payout_id:
      payout.id,

    allocation_id:
      allocation.id,

    ok: true,

    status:
      "submitted",

    provider_payout_reference:
      providerResult
        .provider_payout_reference,
  };
}


/*
 * ============================================================
 * SELLER NOTIFICATION
 *
 * Notifications never contain banking details.
 * ============================================================
 */

async function notifySeller(
  sellerId: string,
  payoutId: string,
  subject: string,
  message: string,
) {
  if (!sellerId) return;


  const {
    error,
  } =
    await db.rpc(
      "enqueue_message",
      {
        p_event_key:
          `seller-payout:${payoutId}:${subject}`,

        p_user_id:
          sellerId,

        p_channel:
          "email",

        p_notification_type:
          subject === "Shop&Drop seller payout completed"
            ? "payout_completed"
            : subject === "Shop&Drop seller payout submitted"
            ? "payout_submitted"
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
      "seller payout notification failed",
      error,
    );
  }
}


/*
 * ============================================================
 * PROCESS ONE SELLER PAYOUT
 * ============================================================
 */

async function processPayout(
  candidate: Row,
) {
  /*
   * Claim first.
   */

  let payout:
    Row | null = null;


  try {
    payout =
      await claimPayout(
        candidate,
      );

  } catch (e) {
    return {
      payout_id:
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

  if (!payout) {
    return {
      payout_id:
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


  /*
   * ========================================================
   * EXACT A2 SELLER ALLOCATION
   * ========================================================
   */

  try {
    allocation =
      await getSellerAllocation(
        payout,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    return await payoutFailure(
      payout,
      null,
      reason,
      false,
    );
  }


  /*
   * ========================================================
   * HARD SELLER RELATIONSHIP CHECK
   * ========================================================
   */

  if (
    clean(
      allocation.order_id,
    ) !==
      clean(
        payout.order_id,
      ) ||
    clean(
      allocation.seller_id,
    ) !==
      clean(
        payout.seller_id,
      )
  ) {
    return await payoutFailure(
      payout,
      allocation,
      "seller_payout_relationship_mismatch",
      false,
    );
  }


  /*
   * ========================================================
   * ELIGIBILITY / DELIVERY PROTECTION
   *
   * SQL bridge could only create payout from
   * seller_payout_eligible.
   *
   * Allocation is now normally seller_payout_created.
   *
   * fulfilment_group_id must remain present.
   * ========================================================
   */

  if (
    !allocation
      .fulfilment_group_id
  ) {
    return await payoutFailure(
      payout,
      allocation,
      "seller_fulfilment_group_missing",
      false,
    );
  }


  /*
   * ========================================================
   * AUTHORITATIVE AMOUNT
   * ========================================================
   */

  const allocationAmount =
    money(
      allocation.amount,
    );


  const payoutAmount =
    money(
      payout.payout_amount,
    );


  if (
    allocationAmount === null ||
    payoutAmount === null ||
    allocationAmount < 0 ||
    payoutAmount < 0 ||
    allocationAmount !==
      payoutAmount
  ) {
    return await payoutFailure(
      payout,
      allocation,
      "seller_payout_amount_mismatch",
      false,
    );
  }


  /*
   * ========================================================
   * VERIFIED PAYOUT PROFILE
   * ========================================================
   */

  let profile: Row;


  try {
    profile =
      await getPayoutProfile(
        payout.seller_id,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    /*
     * This can be resolved when seller completes/updates the
     * payout profile, so keep it retryable.
     */

    return await payoutFailure(
      payout,
      allocation,
      reason,
      true,
    );
  }


  /*
   * ========================================================
   * PROVIDER
   * ========================================================
   */

  let provider: Row;


  try {
    provider =
      await getProvider(
        profile,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);

    return await payoutFailure(
      payout,
      allocation,
      reason,
      true,
    );
  }


  /*
   * ========================================================
   * MARK ALLOCATION PROCESSING
   * ========================================================
   */

  const {
    error:
      processingError,
  } =
    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          "seller_payout_processing",

        last_error:
          null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        allocation.id,
      );


  if (processingError) {
    return await payoutFailure(
      payout,
      allocation,
      `seller_allocation_processing_failed:${processingError.message}`,
      true,
    );
  }


  /*
   * ========================================================
   * SUBMIT TO REAL PAYOUT PROVIDER
   * ========================================================
   */

  const providerResult =
    await submitPayout(
      payout,
      allocation,
      profile,
      provider,
    );


  if (!providerResult.ok) {

    /*
     * No provider credentials/account activated yet.
     *
     * Do not mark seller paid.
     */

    if (
      providerResult
        .activation_required
    ) {
      await db
        .from("seller_payouts")
        .update({
          payout_status:
            "activation_required",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          payout.id,
        );


      await db
        .from(
          "payment_allocations",
        )
        .update({
          status:
            "seller_payout_created",

          last_error:
            providerResult.error,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          allocation.id,
        );


      return {
        payout_id:
          payout.id,

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


    return await payoutFailure(
      payout,
      allocation,

      providerResult.error ??
      "payout_provider_failed",

      providerResult.retryable ===
        true,

      providerResult
        .provider_response ??
      {},
    );
  }


  /*
   * ========================================================
   * PROVIDER CONFIRMED SETTLEMENT IMMEDIATELY
   * ========================================================
   */

  if (
    providerResult.settled
  ) {
    let result: Row;

    try {
      result =
        await settlePayout(
          payout,
          allocation,
          providerResult,
        );

    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      /*
       * Provider says money settled.
       *
       * Never resubmit blindly.
       * Record exception for reconciliation.
       */

      await db
        .from("seller_payouts")
        .update({
          payout_status:
            "reconciliation_required",

          payout_reference:
            providerResult
              .provider_payout_reference,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          payout.id,
        );


      await db
        .from(
          "payment_allocations",
        )
        .update({
          status:
            "reconciliation_required",

          provider_code:
            providerResult
              .provider_code,

          provider_settlement_reference:
            providerResult
              .provider_payout_reference,

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
        payout_id:
          payout.id,

        ok: false,

        provider_reports_settled:
          true,

        status:
          "reconciliation_required",

        error:
          reason,
      };
    }


    await notifySeller(
      payout.seller_id,

      payout.id,

      "Shop&Drop seller payout completed",

      `Your Shop&Drop seller payout of ${
        allocationAmount.toFixed(2)
      } ${
        clean(
          allocation.currency,
        ).toUpperCase()
      } has been completed.`,
    );


    return result;
  }


  /*
   * ========================================================
   * PROVIDER ACCEPTED — AWAIT SETTLEMENT CONFIRMATION
   * ========================================================
   */

  let submitted:
    Row;


  try {
    submitted =
      await markSubmitted(
        payout,
        allocation,
        providerResult,
      );

  } catch (e) {
    const reason =
      e instanceof Error
        ? e.message
        : String(e);


    /*
     * Provider already accepted the payout.
     *
     * Do NOT retry submission blindly.
     */

    await db
      .from("seller_payouts")
      .update({
        payout_status:
          "reconciliation_required",

        payout_reference:
          providerResult
            .provider_payout_reference,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        payout.id,
      );


    await db
      .from(
        "payment_allocations",
      )
      .update({
        status:
          "reconciliation_required",

        provider_code:
          providerResult
            .provider_code,

        provider_allocation_reference:
          providerResult
            .provider_payout_reference,

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
      payout_id:
        payout.id,

      ok: false,

      provider_accepted:
        true,

      status:
        "reconciliation_required",

      error:
        reason,
    };
  }


  await notifySeller(
    payout.seller_id,

    payout.id,

    "Shop&Drop seller payout submitted",

    `Your Shop&Drop seller payout of ${
      allocationAmount.toFixed(2)
    } ${
      clean(
        allocation.currency,
      ).toUpperCase()
    } has been submitted for settlement.`,
  );


  return submitted;
}

// END BLOCK 2 — ATTACH BLOCK 3 DIRECTLY BELOW
/*
 * ============================================================
 * AUTOMATIC PAYOUT WORKER ENTRY POINT
 *
 * This function is backend-controlled.
 *
 * It does NOT accept:
 *
 * seller-selected payout amounts
 * browser-supplied bank accounts
 * browser-sup
 * 
plied payout destinations
 * browser-supplied provider references
 * browser-controlled eligibility
 *
 * All payout authority comes from:
 *
 * verified delivery
 * -> A2 seller allocation
 * -> automatic payout record
 * -> verified seller payout profile
 * -> configured payout provider.
 *
 * NO inspection period.
 * ============================================================
 */

Deno.serve(
  async (req) => {

    /*
     * --------------------------------------------------------
     * BASIC METHOD / CONFIGURATION PROTECTION
     * --------------------------------------------------------
     */

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


    /*
     * ========================================================
     * STEP 1
     *
     * Automatically convert newly eligible seller allocations
     * into seller_payout records.
     *
     * No employee creates ordinary payouts.
     * ========================================================
     */

    let creationResult:
      Row | null = null;


    try {

      creationResult =
        await createEligiblePayouts();

    } catch (e) {

      const reason =
        e instanceof Error
          ? e.message
          : String(e);


      console.error(
        VERSION,
        "automatic payout creation failed",
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
     * ========================================================
     * STEP 2
     *
     * Find payouts ready for processing.
     * ========================================================
     */

    let payouts:
      Row[] = [];


    try {

      payouts =
        await getReadyPayouts(
          10,
        );

    } catch (e) {

      const reason =
        e instanceof Error
          ? e.message
          : String(e);


      console.error(
        VERSION,
        "payout lookup failed",
        reason,
      );


      return reply(
        {
          ok: false,

          payout_creation:
            creationResult,

          error:
            reason,
        },
        500,
      );
    }


    /*
     * Nothing ready.
     *
     * This is a normal successful worker run.
     */

    if (
      payouts.length === 0
    ) {
      return reply({
        ok: true,

        payout_creation:
          creationResult,

        ready:
          0,

        processed:
          0,

        message:
          "No seller payouts ready for processing.",
      });
    }


    /*
     * ========================================================
     * STEP 3
     *
     * Process payouts independently.
     *
     * One seller failure must never block unrelated sellers.
     * ========================================================
     */

    const results:
      Row[] = [];


    for (
      const payout
      of payouts
    ) {

      try {

        const result =
          await processPayout(
            payout,
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
          "unexpected payout processing error",
          payout.id,
          reason,
        );


        /*
         * Unexpected worker error.
         *
         * Do not mark seller paid.
         */

        await db
          .from(
            "seller_payouts",
          )
          .update({
            payout_status:
              "retry_pending",

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            payout.id,
          );


        results.push({
          payout_id:
            payout.id,

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
     * SUMMARY
     * ========================================================
     */

    const paid =
      results.filter(
        (item) =>
          item.status ===
          "paid",
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
     * SUCCESSFUL WORKER RESPONSE
     *
     * Important:
     *
     * "processed" does NOT mean all sellers were paid.
     *
     * Individual result states remain authoritative.
     * ========================================================
     */

    return reply({
      ok: true,

      payout_creation:
        creationResult,

      ready:
        payouts.length,

      processed:
        results.length,

      paid,

      submitted,

      activation_required:
        activationRequired,

      retry_pending:
        retryPending,

      exceptions,

      results,

      architecture: {
        automatic:
          true,

        seller_specific:
          true,

        verified_delivery_required:
          true,

        commission_already_separated:
          true,

        courier_money_excluded:
          true,

        inspection_window:
          false,

        provider_neutral:
          true,
      },
    });

  },
);
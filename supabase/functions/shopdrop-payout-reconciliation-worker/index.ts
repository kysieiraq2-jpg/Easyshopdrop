
// SHOP&DROP
// AUDIT 5 - PAYOUT RECONCILIATION WORKER V2
// ORIGINAL V1 PROCESSING PRESERVED
// ADDED VAULT WORKER AUTHENTICATION
// NO DIRECT BANK TRANSFERS

import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-PAYOUT-RECONCILIATION-V2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(
  SUPABASE_URL,
  SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function response(
  body: Record<string, unknown>,
  status = 200,
): Response {
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

function safeEqual(
  a: string,
  b: string,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |=
      a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}

// ADDITION: Authenticate the scheduler using
// the existing Supabase Vault token verifier.
// The actual token is never stored in this code.

async function authorized(
  req: Request,
): Promise<boolean> {
  const authorization =
    req.headers.get("authorization") ?? "";

  // Preserve original service-role access.

  if (
    SERVICE_KEY &&
    safeEqual(
      authorization,
      `Bearer ${SERVICE_KEY}`,
    )
  ) {
    return true;
  }

  // New scheduled-worker authorization.

  const token =
    req.headers.get(
      "x-shopdrop-payout-worker-token",
    ) ?? "";

  if (!/^[a-fA-F0-9]{64}$/.test(token)) {
    return false;
  }

  try {
    const { data, error } = await db.rpc(
      "shopdrop_verify_payout_worker_token",
      {
        p_token: token,
      },
    );

    return !error && data === true;
  } catch {
    return false;
  }
}

type QueueItem = {
  reconciliation_id: string;
  allocation_id: string;
};

type Allocation = {
  id: string;
  order_id: string;
  seller_id: string;
  fulfilment_group_id: string | null;
  allocation_type: string;
  status: string;
};

async function updateQueue(
  id: string,
  status: string,
): Promise<void> {
  const { error } = await db
    .from("shopdrop_payout_reconciliation")
    .update({
      status,
      last_checked_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `queue_update_failed:${error.message}`,
    );
  }
}

// END BLOCK 1
async function processItem(
  item: QueueItem,
): Promise<string> {
  const { data: allocation, error } =
    await db
      .from("payment_allocations")
      .select(
        "id,order_id,seller_id,fulfilment_group_id,allocation_type,status",
      )
      .eq("id", item.allocation_id)
      .single();

  if (error || !allocation) {
    await updateQueue(
      item.reconciliation_id,
      "failed",
    );
    return "allocation_missing";
  }

  const a = allocation as Allocation;

  if (a.allocation_type !== "seller") {
    await updateQueue(
      item.reconciliation_id,
      "failed",
    );
    return "not_seller_allocation";
  }

  if (
    [
      "seller_payout_eligible",
      "seller_payout_pending",
      "seller_paid",
    ].includes(a.status)
  ) {
    await updateQueue(
      item.reconciliation_id,
      "completed",
    );
    return "already_advanced";
  }

  if (a.status !== "seller_held") {
    await updateQueue(
      item.reconciliation_id,
      "held",
    );
    return "financial_hold";
  }

  if (
    !a.order_id ||
    !a.seller_id ||
    !a.fulfilment_group_id
  ) {
    await updateQueue(
      item.reconciliation_id,
      "held",
    );
    return "missing_allocation_identifiers";
  }

  // Existing database financial guards
  // remain authoritative.
  //
  // This RPC cannot bypass the installed
  // delivery, payment, dispute or refund guards.

  const { error: eligibilityError } =
    await db.rpc(
      "mark_seller_allocation_payout_eligible",
      {
        p_order_id: a.order_id,
        p_seller_id: a.seller_id,
        p_fulfilment_group_id:
          a.fulfilment_group_id,
      },
    );

  if (eligibilityError) {
    console.warn(
      VERSION,
      "Eligibility held",
      item.reconciliation_id,
      eligibilityError.message,
    );

    await updateQueue(
      item.reconciliation_id,
      "held",
    );

    return "eligibility_held";
  }

  // Confirm the allocation actually changed.
  // A successful RPC response alone is
  // not proof of payout eligibility.

  const { data: updated, error: checkError } =
    await db
      .from("payment_allocations")
      .select("status")
      .eq("id", a.id)
      .single();

  if (checkError || !updated) {
    await updateQueue(
      item.reconciliation_id,
      "held",
    );
    return "status_check_failed";
  }

  if (
    [
      "seller_payout_eligible",
      "seller_payout_pending",
      "seller_paid",
    ].includes(updated.status)
  ) {
    await updateQueue(
      item.reconciliation_id,
      "completed",
    );
    return "eligibility_confirmed";
  }

  await updateQueue(
    item.reconciliation_id,
    "held",
  );

  return "eligibility_not_confirmed";
}

// END BLOCK 2
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return response(
      {
        ok: false,
        error: "method_not_allowed",
      },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return response(
      {
        ok: false,
        error: "backend_configuration_missing",
      },
      500,
    );
  }

  // Preserve service-role authorization.
  // Also accept a valid Vault-backed
  // internal scheduler token.

  if (!(await authorized(req))) {
    return response(
      {
        ok: false,
        error: "unauthorized",
      },
      401,
    );
  }

  let claimed: QueueItem[] = [];

  try {
    const { data, error } = await db.rpc(
      "shopdrop_claim_payout_reconciliation",
      {
        p_limit: 10,
      },
    );

    if (error) {
      throw new Error(
        `queue_claim_failed:${error.message}`,
      );
    }

    claimed = (data ?? []) as QueueItem[];

    const results: Record<string, number> = {
      eligibility_confirmed: 0,
      already_advanced: 0,
      financial_hold: 0,
      eligibility_held: 0,
      other: 0,
    };

    for (const item of claimed) {
      try {
        const result =
          await processItem(item);

        if (result in results) {
          results[result]++;
        } else {
          results.other++;
        }
      } catch (error) {
        console.error(
          VERSION,
          "Reconciliation error",
          item.reconciliation_id,
          error instanceof Error
            ? error.message
            : String(error),
        );

        try {
          await updateQueue(
            item.reconciliation_id,
            "held",
          );
        } catch (queueError) {
          console.error(
            VERSION,
            "Queue recovery failed",
            item.reconciliation_id,
            queueError,
          );
        }

        results.other++;
      }
    }

    return response({
      ok: true,
      claimed: claimed.length,
      results,
      direct_transfers: 0,
    });
  } catch (error) {
    console.error(
      VERSION,
      "Worker failure",
      error instanceof Error
        ? error.message
        : String(error),
    );

    return response(
      {
        ok: false,
        error: "reconciliation_worker_failed",
      },
      500,
    );
  }
});


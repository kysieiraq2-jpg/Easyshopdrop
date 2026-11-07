
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// SHOPDROP-FIX31O: restricted reconciliation assessment, no money movement.
// A provider refund/void must NEVER be inferred from a database status alone.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ ok: false, error: "post_required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond({ ok: false, error: "configuration_missing" }, 503);

  // Worker-to-worker only; no public user access.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return respond({ ok: false, error: "unauthorized" }, 401);
  const verifier = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: validWorkerToken, error: workerAuthError } = await verifier.rpc(
    "shopdrop_verify_two_payment_reconciliation_token", { p_token: token }
  );
  if (token !== serviceKey && (workerAuthError || validWorkerToken !== true)) {
    return respond({ ok: false, error: "unauthorized" }, 401);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await admin
    .from("platform_settings").select("setting_value,is_active")
    .eq("setting_key", "shopdrop_two_payment_checkout").single();
  if (configError || !config?.is_active || config.setting_value?.live_checkout_enabled !== false) {
    return respond({ ok: false, error: "safe_mode_required" }, 503);
  }

  // Fix31T: recover abandoned claims before taking new work.
  // This only changes queue state; it never authorizes money movement.
  const { data: recovery, error: recoveryError } = await admin.rpc(
    "shopdrop_recover_stale_two_payment_claims",
    { p_timeout_minutes: 15, p_max_attempts: 5 }
  );
  if (recoveryError) {
    console.error("FIX31T stale claim recovery failed", recoveryError.code);
    return respond({ ok: false, error: "stale_claim_recovery_unavailable" }, 503);
  }
  const recovered = recovery?.[0] ?? { requeued: 0, escalated: 0 };

  const { data: jobs, error: queueError } = await admin.rpc(
    "shopdrop_claim_two_payment_reconciliation", { p_limit: 20 }
  );
  if (queueError) return respond({ ok: false, error: "claim_unavailable" }, 503);

  let noConfirmedFunds = 0;
  let providerReviewRequired = 0;
  let ambiguous = 0;
  let safelyFinished = 0;
  for (const job of jobs ?? []) {
    let classification = "recovery_not_yet_verified";
    let requiresReview = true;
    try {
      const { data: legs, error: legError } = await admin
        .from("shopdrop_checkout_payment_legs")
        .select("payment_type,payment_status,verification_status,provider_code,provider_reference")
        .eq("order_id", job.order_id);
      if (legError || !legs?.length) {
        ambiguous++;
        classification = "payment_evidence_missing";
      } else {
        const hasMoneyRisk = legs.some((l) =>
          l.payment_status === "paid" || l.payment_status === "authorized" ||
          l.verification_status === "verified" || Boolean(l.provider_reference)
        );
        if (hasMoneyRisk) {
          providerReviewRequired++;
          classification = "provider_funds_require_verified_recovery";
        } else {
          noConfirmedFunds++;
          // No local evidence is NOT proof no provider funds exist.
          classification = "provider_status_unconfirmed";
        }
      }
    } catch {
      ambiguous++;
      classification = "reconciliation_assessment_error";
    }
    // Fail closed: never resolve, void or refund based on local DB status.
    const { data: finished, error: finishError } = await admin.rpc(
      "shopdrop_finish_two_payment_reconciliation",
      {
        p_order_id: job.order_id,
        p_claim_token: job.claim_token,
        p_result: requiresReview ? "manual_review" : "pending",
        p_note: classification,
      }
    );
    if (finishError || finished !== true) {
      console.error("FIX31R finish rejected", finishError?.code ?? "claim_mismatch");
      ambiguous++;
    } else safelyFinished++;
  }

  return respond({
    ok: true,
    version: "SHOPDROP-FIX31T-STALE-CLAIM-RECOVERY-V1",
    stale_claims_requeued: recovered.requeued,
    stale_claims_escalated: recovered.escalated,
    assessed: (jobs ?? []).length,
    no_confirmed_funds: noConfirmedFunds,
    provider_review_required: providerReviewRequired,
    ambiguous: ambiguous,
    provider_refunds_executed: 0,
    money_movement_enabled: false,
    queue_records_modified: safelyFinished,
  });
});

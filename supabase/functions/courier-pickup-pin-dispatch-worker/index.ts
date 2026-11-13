
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-FIX36H-COURIER-PIN-DISPATCH-V1";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("SHOPDROP_COURIER_PIN_WORKER_SECRET") ?? "";
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-shopdrop-pin-worker-secret, content-type",
  "Access-Control-Allow-Origin": "*",
};
type RecordValue = Record<string, unknown>;
function reply(body: RecordValue, status = 200) {
  return new Response(JSON.stringify({ version: VERSION, ...body }), {
    status, headers: HEADERS,
  });
}
// Constant-time comparison for the two server-only credentials.
function equalSecrets(a: string, b: string) {
  const encoder = new TextEncoder();
  const aa = encoder.encode(a), bb = encoder.encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}
function normalizeCode(v: unknown) {
  const code = String(v ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,64}$/.test(code)) return "";
  return code;
}
function providerSecretName(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
function destinationApproved(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (!host || host === "localhost" ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      /^127\./.test(host) || /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
      host === "::1" || host === "[::1]") return false;
    return true;
  } catch { return false; }
}
function safeString(v: unknown, max = 128) {
  const s = String(v ?? "").trim();
  return /^[A-Za-z0-9:_./-]{8,128}$/.test(s) && s.length <= max ? s : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: HEADERS });
  }
  if (req.method !== "POST") {
    return reply({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!URL || !SERVICE_KEY || !WORKER_SECRET || WORKER_SECRET.length < 32) {
    return reply({ ok: false, error: "worker_not_configured" }, 503);
  }
  const authorization = req.headers.get("authorization") ?? "";
  const expectedAuth = "Bearer " + SERVICE_KEY;
  const suppliedSecret = req.headers.get("x-shopdrop-pin-worker-secret") ?? "";
  if (!equalSecrets(authorization, expectedAuth) ||
      !equalSecrets(suppliedSecret, WORKER_SECRET)) {
    return reply({ ok: false, error: "backend_authorization_required" }, 403);
  }

  const db = createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Disabled-by-default release. No courier connection or payment will be
  // accessed if this explicit approval gate is incomplete.
  const { data: settings, error: configError } = await db
    .from("platform_settings")
    .select("setting_value,is_active")
    .eq("setting_key", "shopdrop_courier_pin_dispatch_activation")
    .maybeSingle();
  const c = settings?.setting_value as RecordValue | undefined;
  if (configError || !settings?.is_active || !c ||
      c.dispatch_enabled !== true ||
      c.provider_adapter_approved !== true ||
      c.sandbox_deliveries_verified !== true) {
    return reply({
      ok: true, dispatch_enabled: false,
      reason: "provider_approval_and_sandbox_required",
      courier_pin_sent: 0, funds_moved: false,
    });
  }

  const { data: enqueued, error: queueError } =
    await db.rpc("shopdrop_queue_courier_pin_deliveries", { p_limit: 10 });
  if (queueError) {
    return reply({ ok: false, error: "dispatch_queue_unavailable" }, 503);
  }
  const { data: claimed, error: claimError } =
    await db.rpc("shopdrop_claim_courier_pin_deliveries", { p_limit: 10 });
  if (claimError || !Array.isArray(claimed)) {
    return reply({ ok: false, error: "dispatch_claim_unavailable" }, 503);
  }

  let accepted = 0, rejected = 0, unfinished = 0;
  for (const job of claimed as RecordValue[]) {
    const shipmentId = String(job.shipment_id ?? "");
    const bookingId = String(job.courier_booking_id ?? "");
    const claimToken = String(job.claim_token ?? "");
    const dispatchKey = String(job.dispatch_key ?? "");
    const code = normalizeCode(job.provider_code);
    let acknowledged = false;
    let acknowledgmentRef = "";
    let errorCode = "delivery_failed";

    try {
      if (!code || !/^[0-9a-f-]{36}$/i.test(shipmentId) ||
          !/^[0-9a-f-]{36}$/i.test(bookingId) ||
          !/^[0-9a-f-]{36}$/i.test(claimToken) ||
          dispatchKey.length < 16) {
        errorCode = "shipment_not_eligible";
      } else {
        const suffix = providerSecretName(code);
        const endpoint = Deno.env.get("COURIER_PIN_DELIVERY_URL_" + suffix) ?? "";
        const secret = Deno.env.get("COURIER_PIN_DELIVERY_SECRET_" + suffix) ?? "";
        if (!destinationApproved(endpoint) || secret.length < 24) {
          errorCode = "provider_not_configured";
        } else {
          // Issue only after provider settings, verified payment legs,
          // seller-held proceeds, active booking and single pickup location.
          const { data: issue, error: issueError } = await db.rpc(
            "shopdrop_issue_courier_collection_pin",
            { p_shipment_id: shipmentId },
          );
          if (issueError || !issue?.ok ||
              issue.shipment_id !== shipmentId ||
              issue.courier_booking_id !== bookingId ||
              !/^[0-9]{6}$/.test(String(issue.pickup_pin ?? ""))) {
            errorCode = "issuance_denied";
          } else {
            // The PIN is ephemeral and is never added to queue rows,
            // returned from this function, emailed, or logged.
            // An approved courier adapter must authenticate the request,
            // dedupe this key and respond with the same idempotency key.
            const response = await fetch(endpoint, {
              method: "POST",
              redirect: "error",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + secret,
                "X-ShopDrop-Idempotency-Key": dispatchKey,
              },
              body: JSON.stringify({
                protocol: "shopdrop_courier_pin_delivery_v1",
                idempotency_key: dispatchKey,
                shipment_id: shipmentId,
                courier_booking_id: bookingId,
                pickup_collection_pin: issue.pickup_pin,
                pickup_instruction: "Hand the six-digit collection PIN to the seller or authorized handover person only after physically collecting the parcel. The seller submits the PIN to Shop&Drop. Do not use this PIN as proof of final delivery.",
                delivery_confirmation_is_separate: true,
              }),
              signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) {
              errorCode = "provider_rejected";
            } else {
              let body: RecordValue = {};
              try {
                const parsed: unknown = await response.json();
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  body = parsed as RecordValue;
                }
              } catch { /* No response details retained. */ }
              const ref = safeString(body.reference);
              if (body.accepted === true &&
                  body.idempotency_key === dispatchKey && ref) {
                acknowledged = true;
                acknowledgmentRef = ref;
              } else {
                errorCode = "provider_ack_invalid";
              }
            }
          }
        }
      }
    } catch {
      // Deliberately do not log PINs, HTTP bodies or provider secrets.
      errorCode = "provider_unavailable";
    }

    const { error: finishError } = await db.rpc(
      "shopdrop_finish_courier_pin_delivery", {
        p_shipment_id: shipmentId,
        p_claim_token: claimToken,
        p_accepted: acknowledged,
        p_provider_reference: acknowledged ? acknowledgmentRef : null,
        p_error_code: acknowledged ? null : errorCode,
      },
    );
    if (finishError) unfinished++;
    else if (acknowledged) accepted++;
    else rejected++;
  }

  return reply({
    ok: true, dispatch_enabled: true,
    queue_new: Number(enqueued ?? 0),
    attempted: claimed.length,
    courier_provider_acknowledged: accepted,
    scheduled_retry_or_failed: rejected,
    needs_reconciliation: unfinished,
    funds_moved: false,
    seller_payout_eligible: false,
  });
});



// Shop&Drop — Shared arrival release worker V2.
// Services and dispatching.
// Preserves V1 staging, authentication and safety.
// Adds provider-neutral adapter integration.
// No live fund movement.

import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

import {
  arrivalReleaseIdempotencyKey,
  submitArrivalRelease,
  type ArrivalBookingType,
  type ArrivalReleaseRequest,
} from "../_shared/shopdrop-arrival-release-adapter.ts";

const VERSION =
  "SHOPDROP-ARRIVAL-RELEASE-WORKER-V2";

function reply(
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
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

async function sameSecret(
  supplied: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();

  const [a, b] = await Promise.all([
    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(supplied),
    ),
    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(expected),
    ),
  ]);

  const left = new Uint8Array(a);
  const right = new Uint8Array(b);

  let difference = 0;

  for (let i = 0; i < left.length; i++) {
    difference |= left[i] ^ right[i];
  }

  return difference === 0;
}

function validBookingType(
  value: unknown,
): value is ArrivalBookingType {
  return value === "service" ||
    value === "dispatch";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return reply({
      ok: false,
      error: "method_not_allowed",
    }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");

  const serviceKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  const workerSecret = Deno.env.get(
    "SHOPDROP_ARRIVAL_RELEASE_WORKER_SECRET",
  );

  if (!url || !serviceKey || !workerSecret) {
    return reply({
      ok: false,
      error: "configuration_missing",
    }, 503);
  }

  const supplied = request.headers.get(
    "x-shopdrop-arrival-worker-secret",
  ) ?? "";

  if (
    !supplied ||
    !(await sameSecret(supplied, workerSecret))
  ) {
    return reply({
      ok: false,
      error: "unauthorized",
    }, 401);
  }

  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    // Preserve existing launch configuration check.
    const { data: region, error: regionError } =
      await db
        .from("platform_settings")
        .select("setting_value,is_active")
        .eq("setting_key", "shopdrop_launch_region")
        .single();

    if (
      regionError ||
      !region?.is_active ||
      !region.setting_value
    ) {
      return reply({
        ok: false,
        error: "launch_configuration_unavailable",
      }, 503);
    }

    // Preserve V1 automatic staging.
    const { data, error } = await db.rpc(
      "shopdrop_stage_arrival_provider_releases",
      { p_limit: 25 },
    );

    if (error) {
      console.error(
        VERSION,
        "arrival release staging failed",
      );

      return reply({
        ok: false,
        error: "staging_failed",
      }, 500);
    }

    // V2: Read staged records.
    // No payout status is changed by this worker.
    const { data: ledger, error: ledgerError } =
      await db
        .from(
          "shopdrop_arrival_provider_release_ledger",
        )
        .select(
          "id,booking_type,booking_id,payment_id," +
          "provider_id,provider_code," +
          "provider_amount,currency,release_status",
        )
        .eq(
          "release_status",
          "awaiting_safeguards",
        )
        .order("created_at", {
          ascending: true,
        })
        .limit(25);

    if (ledgerError) {
      console.error(
        VERSION,
        "arrival release ledger read failed",
      );

      return reply({
        ok: false,
        error: "ledger_read_failed",
        records_staged:
          data?.records_staged ?? 0,
        funds_moved: false,
        provider_release_submitted: false,
      }, 500);
    }

    let checked = 0;
    let safeguardsVerified = 0;
    let activationRequired = 0;
    let adapterRejected = 0;
    let validationHeld = 0;
    let failures = 0;

    for (const record of ledger ?? []) {
      checked++;

      try {
        // Fail closed for unexpected booking types.
        if (!validBookingType(
          record.booking_type,
        )) {
          validationHeld++;
          continue;
        }

        // Authoritative backend eligibility check.
        const {
          data: claim,
          error: claimError,
        } = await db.rpc(
          "shopdrop_claim_arrival_provider_release",
          {
            p_ledger_id: record.id,
          },
        );

        if (claimError) {
          failures++;
          console.error(
            VERSION,
            "arrival claim validation failed",
          );
          continue;
        }

        if (
          claim?.safeguards_verified !== true
        ) {
          validationHeld++;
          continue;
        }

        safeguardsVerified++;

        // Activation must remain blocked until
        // the compatible provider is configured.
        if (
          claim.status ===
          "activation_required"
        ) {
          activationRequired++;
        }

        // The shared adapter is deliberately
        // inactive and cannot transfer money.
        //
        // Missing provider configuration remains
        // a safe hold, never an invented provider.
        if (
          typeof record.provider_code !==
            "string" ||
          !record.provider_code.trim()
        ) {
          validationHeld++;
          continue;
        }

        const releaseRequest:
          ArrivalReleaseRequest = {
          ledger_id: record.id,
          booking_type: record.booking_type,
          booking_id: record.booking_id,
          payment_id: record.payment_id,
          provider_id: record.provider_id,
          provider_code: record.provider_code,
          provider_amount:
            Number(record.provider_amount),
          currency: record.currency,
          idempotency_key:
            arrivalReleaseIdempotencyKey(
              record.booking_type,
              record.booking_id,
            ),
        };

        const result =
          await submitArrivalRelease(
            releaseRequest,
          );

        // Fail closed if a future adapter
        // unexpectedly reports a transfer.
        if (
          result.submitted ||
          result.funds_moved
        ) {
          console.error(
            VERSION,
            "unexpected provider release result",
          );

          return reply({
            ok: false,
            error:
              "unexpected_release_submission",
            funds_moved:
              result.funds_moved,
            provider_release_submitted:
              result.submitted,
          }, 500);
        }

        if (
          result.status ===
          "activation_required"
        ) {
          activationRequired++;
        } else {
          adapterRejected++;
        }
      } catch {
        failures++;
        console.error(
          VERSION,
          "arrival release validation failed",
        );
      }
    }

    return reply({
      ok: true,
      records_staged:
        data?.records_staged ?? 0,
      records_checked: checked,
      safeguards_verified:
        safeguardsVerified,
      activation_required:
        activationRequired,
      validation_held:
        validationHeld,
      adapter_rejected:
        adapterRejected,
      validation_failures: failures,
      funds_moved: false,
      provider_release_submitted: false,
      live_payments_enabled:
        region.setting_value
          .live_payments_enabled === true,
      worker_mode:
        "staging_and_adapter_validation_only",
      next_step:
        "provider_release_activation_after_testing",
    });
  } catch {
    return reply({
      ok: false,
      error: "worker_processing_failed",
    }, 500);
  }
});

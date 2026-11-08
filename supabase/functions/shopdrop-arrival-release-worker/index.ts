
// Shop&Drop — Shared arrival release staging worker.
// Handles services and dispatching.
// Preserves all existing payout functions.
// No provider transfers or live payout activation.

import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-ARRIVAL-RELEASE-WORKER-V1";

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

    return reply({
      ok: true,
      records_staged: data?.records_staged ?? 0,
      funds_moved: false,
      provider_release_submitted: false,
      live_payments_enabled:
        region.setting_value.live_payments_enabled ===
        true,
      worker_mode: "staging_only",
      next_step: "provider_release_adapter",
    });
  } catch {
    return reply({
      ok: false,
      error: "worker_processing_failed",
    }, 500);
  }
});


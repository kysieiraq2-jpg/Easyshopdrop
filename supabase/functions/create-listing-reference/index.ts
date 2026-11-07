
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-REFERENCE-V2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify({
      version: VERSION,
      ...body,
    }),
    {
      status,
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function adminClient() {
  return createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        error: "method_not_allowed",
      },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(
      {
        ok: false,
        error: "backend_configuration_error",
      },
      500,
    );
  }

  /*
   * Authentication first.
   */

  const authorization =
    req.headers.get("Authorization");

  if (!authorization) {
    return json(
      {
        ok: false,
        error: "authentication_required",
      },
      401,
    );
  }

  const db = adminClient();

  const token =
    authorization.replace(/^Bearer\s+/i, "");

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return json(
      {
        ok: false,
        error: "invalid_authentication",
      },
      401,
    );
  }

  let input: Record<string, unknown>;

  try {
    input = await req.json();
  } catch {
    return json(
      {
        ok: false,
        error: "invalid_json",
      },
      400,
    );
  }

  /*
   * V26.24 compatibility:
   *
   * Existing callers may send:
   *   { prefix: "SD-LST" }
   *
   * Newer callers may send:
   *   { listing_type: "product" }
   *
   * Both are supported.
   */

  const requestedPrefix =
    String(input.prefix ?? "")
      .trim()
      .toUpperCase();

  const listingType =
    String(
      input.listing_type ??
      input.listingType ??
      input.type ??
      "",
    )
      .trim()
      .toLowerCase();

  const typeMap: Record<string, string> = {
    product: "SD-LST",
    listing: "SD-LST",
    service: "SD-SVC",
    dispatch: "SD-DSP",
  };

  let prefix: string | null = null;

  if (listingType && typeMap[listingType]) {
    prefix = typeMap[listingType];
  } else if (
    ["SD-LST", "SD-SVC", "SD-DSP"].includes(
      requestedPrefix,
    )
  ) {
    prefix = requestedPrefix;
  }

  if (!prefix) {
    return json(
      {
        ok: false,
        error: "invalid_listing_reference_type",
      },
      400,
    );
  }

  /*
   * Reference generation remains server-side.
   *
   * The client cannot manufacture an SD reference
   * or request another Shop&Drop reference namespace.
   */

  const { data, error } =
    await db.rpc(
      "generate_shopdrop_reference",
      { prefix },
    );

  if (error) {
    console.error(
      VERSION,
      "reference generation failed",
      error,
    );

    return json(
      {
        ok: false,
        error: "reference_generation_failed",
      },
      500,
    );
  }

  if (
    typeof data !== "string" ||
    !data.startsWith(`${prefix}-`)
  ) {
    return json(
      {
        ok: false,
        error: "invalid_generated_reference",
      },
      500,
    );
  }

  return json({
    ok: true,
    reference: data,
    prefix,
  });
});


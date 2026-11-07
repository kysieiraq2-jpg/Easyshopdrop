
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-CHANGE-REQUESTS-V2";

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
    JSON.stringify({ version: VERSION, ...body }),
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

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
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
      { ok: false, error: "method_not_allowed" },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(
      { ok: false, error: "backend_configuration_error" },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return json(
      { ok: false, error: "authentication_required" },
      401,
    );
  }

  const db = adminClient();
  const token = authorization.replace(/^Bearer\s+/i, "");

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return json(
      { ok: false, error: "invalid_authentication" },
      401,
    );
  }

  /*
   * Change requests are administrative operations.
   */

  const { data: admin, error: adminError } =
    await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (adminError) {
    console.error(VERSION, adminError);

    return json(
      { ok: false, error: "admin_check_failed" },
      500,
    );
  }

  if (!admin) {
    return json(
      { ok: false, error: "administrator_required" },
      403,
    );
  }

  let input: Record<string, unknown>;

  try {
    input = await req.json();
  } catch {
    return json(
      { ok: false, error: "invalid_json" },
      400,
    );
  }

  const title = cleanText(
    input.title ??
    input.subject,
    200,
  );

  const description = cleanText(
    input.description ??
    input.details ??
    input.message,
    5000,
  );

  const target = cleanText(
    input.target ??
    input.area ??
    input.component,
    200,
  );

  const reason = cleanText(
    input.reason,
    2000,
  );

  if (!description) {
    return json(
      { ok: false, error: "change_description_required" },
      400,
    );
  }

  /*
   * Change-request references are generated server-side.
   * This is an administrative reference and does not
   * modify any V26.24 transaction reference family.
   */

  const reference =
    `SD-CHG-${crypto.randomUUID()}`;

  const payload = {
    user_id: user.id,
    change_reference: reference,
    title: title || null,
    description,
    target: target || null,
    reason: reason || null,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } =
    await db
      .from("integration_events")
      .insert({
        event_type: "website_change_request",
        external_reference: reference,
        payload,
        status: "received",
      });

  if (insertError) {
    console.error(VERSION, insertError);

    return json(
      { ok: false, error: "change_request_storage_failed" },
      500,
    );
  }

  return json({
    ok: true,
    reference,
    status: "submitted",
  });
});


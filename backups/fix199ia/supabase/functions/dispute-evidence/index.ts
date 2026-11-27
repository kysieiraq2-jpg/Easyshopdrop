
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-DISPUTE-EVIDENCE-V2";

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

function cleanText(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
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

  let input: Record<string, unknown>;

  try {
    input = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const disputeReference = cleanText(
    input.dispute_reference ??
    input.disputeReference,
    100,
  );

  const transactionReference = cleanText(
    input.transaction_reference ??
    input.transactionReference,
    100,
  );

  if (!disputeReference && !transactionReference) {
    return json(
      {
        ok: false,
        error: "dispute_reference_required",
      },
      400,
    );
  }

  const description = cleanText(
    input.description ??
    input.details ??
    input.message,
    3000,
  );

  const fileName = cleanText(
    input.file_name ??
    input.fileName,
    255,
  );

  const contentType = cleanText(
    input.content_type ??
    input.contentType,
    150,
  ).toLowerCase();

  /*
   * This function records evidence metadata only.
   *
   * Actual evidence files must use the protected
   * create-signed-upload flow.
   */

  const evidenceReference =
    `SD-EVD-${crypto.randomUUID()}`;

  const payload = {
    user_id: user.id,

    evidence_reference:
      evidenceReference,

    dispute_reference:
      disputeReference || null,

    transaction_reference:
      transactionReference || null,

    description:
      description || null,

    file_name:
      fileName || null,

    content_type:
      contentType || null,

    upload_method:
      "signed_upload",

    created_at:
      new Date().toISOString(),
  };

  const { error: insertError } =
    await db
      .from("integration_events")
      .insert({
        event_type:
          "dispute_evidence_metadata",

        external_reference:
          evidenceReference,

        payload,

        status:
          "awaiting_signed_upload",
      });

  if (insertError) {
    console.error(
      VERSION,
      "evidence metadata storage failed",
      insertError,
    );

    return json(
      {
        ok: false,
        error: "evidence_metadata_storage_failed",
      },
      500,
    );
  }

  return json({
    ok: true,

    reference:
      evidenceReference,

    dispute_reference:
      disputeReference || null,

    upload_required:
      true,

    upload_function:
      "create-signed-upload",

    status:
      "awaiting_signed_upload",
  });
});


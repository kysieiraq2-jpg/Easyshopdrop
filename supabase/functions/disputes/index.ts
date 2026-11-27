import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-199GB2-DISPUTES-V4-CASE";

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

  const orderId =
    cleanText(input.order_id ?? input.orderId, 100);

  const paymentId =
    cleanText(input.payment_id ?? input.paymentId, 100);

  const transactionReference =
    cleanText(
      input.transaction_reference ??
      input.reference,
      100,
    );

  const reason =
    cleanText(input.reason ?? input.category, 100);

  const description =
    cleanText(
      input.description ??
      input.details ??
      input.message,
      5000,
    );

  if (!orderId && !paymentId && !transactionReference) {
    return json(
      { ok: false, error: "transaction_reference_required" },
      400,
    );
  }

  if (!reason || !description) {
    return json(
      { ok: false, error: "dispute_details_required" },
      400,
    );
  }

  /*
   * FIX 4B: Verify that every supplied reference belongs to the
   * authenticated buyer before creating a dispute event.
   * Preserve existing event format and all other behavior.
   */
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let verifiedOrderId: string | null = null;

  if (orderId || transactionReference) {
    const supplied = orderId || transactionReference;
    const field = uuidPattern.test(supplied) ? "id" : "order_reference";
    const { data: ownedOrder, error: orderError } = await db
      .from("orders")
      .select("id")
      .eq(field, supplied)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error(VERSION, "order ownership check failed", orderError);
      return json({ ok: false, error: "order_verification_failed" }, 500);
    }
    if (!ownedOrder) {
      return json({ ok: false, error: "order_not_found_or_not_owned" }, 403);
    }
    verifiedOrderId = ownedOrder.id;

    if (orderId && transactionReference) {
      const secondaryField = uuidPattern.test(transactionReference)
        ? "id" : "order_reference";
      const { data: secondary, error: secondaryError } = await db
        .from("orders")
        .select("id")
        .eq(secondaryField, transactionReference)
        .eq("buyer_id", user.id)
        .maybeSingle();
      if (secondaryError) {
        return json({ ok: false, error: "order_verification_failed" }, 500);
      }
      if (!secondary || secondary.id !== verifiedOrderId) {
        return json({ ok: false, error: "reference_mismatch" }, 403);
      }
    }
  }

  if (paymentId) {
    if (!uuidPattern.test(paymentId)) {
      return json({ ok: false, error: "invalid_payment_reference" }, 400);
    }
    const { data: ownedPayment, error: paymentError } = await db
      .from("payments")
      .select("order_id")
      .eq("id", paymentId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (paymentError) {
      console.error(VERSION, "payment ownership check failed", paymentError);
      return json({ ok: false, error: "payment_verification_failed" }, 500);
    }
    if (!ownedPayment || !ownedPayment.order_id ||
        (verifiedOrderId && ownedPayment.order_id !== verifiedOrderId)) {
      return json({ ok: false, error: "payment_not_found_or_not_owned" }, 403);
    }
    verifiedOrderId = ownedPayment.order_id;
  }

  if (!verifiedOrderId) {
    return json({ ok: false, error: "verified_order_required" }, 403);
  }

  // Fix 199G-B2: one atomic, ownership-checked case and linked support event.
  const { data: result, error: caseError } = await db.rpc(
    "shopdrop_open_product_dispute_199gb",
    { p_user_id: user.id, p_order_id: verifiedOrderId,
      p_reason: reason, p_description: description },
  );
  if (caseError) {
    const code = caseError.code;
    if (code === "23514") return json({ ok: false, error: "paid_order_required_for_dispute" }, 409);
    if (code === "42501") return json({ ok: false, error: "order_not_found_or_not_owned" }, 403);
    if (code === "22023") return json({ ok: false, error: "invalid_dispute_details" }, 400);
    console.error(VERSION, "dispute case creation failed", code);
    return json({ ok: false, error: "dispute_storage_failed" }, 500);
  }
  if (!result?.ok || !uuidPattern.test(result.dispute_id ?? "") ||
      typeof result.dispute_reference !== "string" ||
      !result.dispute_reference.startsWith("SD-DSP-")) {
    return json({ ok: false, error: "dispute_confirmation_unavailable" }, 500);
  }
  return json({ ok: true, dispute_id: result.dispute_id,
    dispute_reference: result.dispute_reference, status: result.status,
    duplicate: result.duplicate === true });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

// Fix31J: provider-neutral PREPARATION ONLY. Never charges cards or changes payout status.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "post_required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service) return json({ ok: false, error: "configuration_unavailable" }, 503);
  if (!authorization?.startsWith("Bearer ")) return json({ ok: false, error: "authentication_required" }, 401);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ ok: false, error: "invalid_session" }, 401);

  let payload: { payment_id?: unknown };
  try { payload = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const paymentId = payload?.payment_id;
  if (typeof paymentId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId)) {
    return json({ ok: false, error: "invalid_payment_id" }, 400);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: config, error: configError } = await admin.from("platform_settings")
    .select("setting_value,is_active").eq("setting_key", "shopdrop_two_payment_checkout").single();
  if (configError || !config?.is_active || config.setting_value?.live_checkout_enabled !== false) {
    return json({ ok: false, error: "safe_preparation_mode_required" }, 503);
  }

  const { data: payment, error: paymentError } = await admin.from("payments")
    .select("id,order_id,buyer_id,payment_status").eq("id", paymentId).single();
  if (paymentError || !payment) return json({ ok: false, error: "payment_not_found" }, 404);
  if (payment.buyer_id !== auth.user.id) return json({ ok: false, error: "access_denied" }, 403);
  if (payment.payment_status !== "pending") return json({ ok: false, error: "payment_not_pending" }, 409);

  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,buyer_id,payment_status").eq("id", payment.order_id).single();
  if (orderError || !order || order.buyer_id !== auth.user.id || order.payment_status !== "pending") {
    return json({ ok: false, error: "order_not_eligible" }, 409);
  }

  const { data, error } = await admin.rpc("shopdrop_prepare_two_payment_checkout", { p_payment_id: paymentId });
  if (error) {
    console.error("FIX31J preparation rejected", error.code);
    return json({ ok: false, error: "checkout_preparation_rejected" }, 409);
  }
  return json({ ...data, mode: "preparation_only", live_payments_enabled: false });
});

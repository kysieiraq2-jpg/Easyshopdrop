
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-PHASE6C-CHECKOUT-V3-CORS";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400"
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors
    });
  }

  if (req.method !== "POST") {
    return json({
      version: VERSION,
      ok: false,
      error: "method_not_allowed"
    }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return json({
      version: VERSION,
      ok: false,
      error: "backend_configuration_missing"
    }, 503);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);

  if (!match) {
    return json({
      version: VERSION,
      ok: false,
      error: "unauthorized"
    }, 401);
  }

  try {
    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(match[1]);

    if (authError || !authData.user) {
      return json({
        version: VERSION,
        ok: false,
        error: "invalid_session"
      }, 401);
    }

    const buyerId = authData.user.id;

    const contentLength =
      Number(req.headers.get("content-length") ?? 0);

    if (Number.isFinite(contentLength) &&
        contentLength > 32768) {
      return json({
        version: VERSION,
        ok: false,
        error: "request_too_large"
      }, 413);
    }

    let body: unknown;

    try {
      const raw = await req.text();

      if (raw.length > 32768) {
        return json({
          version: VERSION,
          ok: false,
          error: "request_too_large"
        }, 413);
      }

      body = JSON.parse(raw);
    } catch {
      return json({
        version: VERSION,
        ok: false,
        error: "invalid_json"
      }, 400);
    }

    if (!body || typeof body !== "object" ||
        Array.isArray(body)) {
      return json({
        version: VERSION,
        ok: false,
        error: "invalid_request"
      }, 400);
    }

    const payload = body as Record<string, unknown>;
    const requestId = payload.request_id;

    if (typeof requestId !== "string" ||
        !UUID.test(requestId)) {
      return json({
        version: VERSION,
        ok: false,
        error: "invalid_request_id"
      }, 400);
    }

    const deliveryAddressId = payload.delivery_address_id;
    if (typeof deliveryAddressId !== "string" || !UUID.test(deliveryAddressId)) {
      return json({ version: VERSION, ok: false,
        error: "valid_delivery_address_required" }, 400);
    }

    const items = payload.items;

    if (!Array.isArray(items) ||
        items.length < 1 || items.length > 50) {
      return json({
        version: VERSION,
        ok: false,
        error: "invalid_cart"
      }, 400);
    }

    const cleanItems: {
      product_id: string;
      quantity: number;
    }[] = [];

    const seen = new Set<string>();

    for (const item of items) {
      if (!item || typeof item !== "object" ||
          Array.isArray(item)) {
        return json({
          version: VERSION,
          ok: false,
          error: "invalid_cart_item"
        }, 400);
      }

      const value = item as Record<string, unknown>;
      const productId = value.product_id;
      const quantity = value.quantity;

      if (typeof productId !== "string" ||
          !UUID.test(productId) ||
          typeof quantity !== "number" ||
          !Number.isSafeInteger(quantity) ||
          quantity < 1 || quantity > 10000) {
        return json({
          version: VERSION,
          ok: false,
          error: "invalid_cart_item"
        }, 400);
      }

      const normalized = productId.toLowerCase();

      if (seen.has(normalized)) {
        return json({
          version: VERSION,
          ok: false,
          error: "duplicate_cart_product"
        }, 400);
      }

      seen.add(normalized);
      cleanItems.push({
        product_id: normalized,
        quantity
      });
    }

    cleanItems.sort((a, b) =>
      a.product_id.localeCompare(b.product_id)
    );

    const adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data, error } = await adminClient.rpc(
      "shopdrop_create_checkout_order_once",
      {
        p_buyer_id: buyerId,
        p_request_id: requestId.toLowerCase(),
        p_items: cleanItems
      }
    );

    if (error) {
      console.error(
        VERSION,
        "checkout_order_error",
        error.code
      );

      const message = error.message ?? "";

      if (message.includes("checkout_request_cart_mismatch")) {
        return json({
          version: VERSION,
          ok: false,
          error: "checkout_request_cart_mismatch"
        }, 409);
      }

      if (message.includes("insufficient_stock") ||
          message.includes("product_not_available") ||
          message.includes("product_changed_during_checkout")) {
        return json({
          version: VERSION,
          ok: false,
          error: "product_unavailable"
        }, 409);
      }

      return json({
        version: VERSION,
        ok: false,
        error: "order_creation_failed"
      }, 409);
    }

    if (!data || typeof data !== "object" ||
        data.ok !== true ||
        typeof data.order_id !== "string") {
      return json({
        version: VERSION,
        ok: false,
        error: "invalid_order_result"
      }, 500);
    }

    // Bind the buyer-owned address before returning a usable order.
    const { data: attached, error: attachError } = await adminClient.rpc(
      "shopdrop_attach_checkout_delivery_address", {
        p_order_id: data.order_id,
        p_buyer_id: buyerId,
        p_address_id: deliveryAddressId.toLowerCase()
      }
    );
    if (attachError || attached !== true) {
      console.error(VERSION, "delivery_address_attachment_failed", attachError?.code);
      return json({ version: VERSION, ok: false,
        error: "delivery_address_attachment_failed" }, 409);
    }

    return json({
      version: VERSION,
      ok: true,
      order_id: data.order_id,
      order_reference: data.order_reference,
      currency: data.currency,
      product_total: data.product_total,
      item_count: data.item_count ?? items.length,
      total_quantity: data.total_quantity,
      payment_status: data.payment_status,
      reused: data.reused === true
    });

  } catch (error) {
    console.error(
      VERSION,
      "unexpected_error",
      error instanceof Error ? error.name : "unknown"
    );

    return json({
      version: VERSION,
      ok: false,
      error: "internal_error"
    }, 500);
  }
});


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-COURIER-V3-ADDRESS";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: Record<string, unknown>, status = 200) {
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

function cleanProvider(value: unknown): string | null {
  const code = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return code || null;
}

function isoCountry(value: unknown): string | null {
  const code = String(value ?? "").trim().toUpperCase();

  return /^[A-Z]{2}$/.test(code)
    ? code
    : null;
}

function isoCurrency(value: unknown): string | null {
  const code = String(value ?? "").trim().toUpperCase();

  return /^[A-Z]{3}$/.test(code)
    ? code
    : null;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

Deno.serve(async (req) => {
  /*
   * SHOP&DROP R7
   * GLOBAL COURIER QUOTE ROUTER
   *
   * Buyer chooses the courier.
   * Shop&Drop does NOT automatically choose a courier.
   * No courier company is hard-coded.
   */

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS,
    });
  }

  if (req.method !== "POST") {
    return reply(
      {
        ok: false,
        error: "method_not_allowed",
      },
      405,
    );
  }

  /*
   * Authentication must happen before quotation processing.
   */

  const authorization =
    req.headers.get("Authorization");

  if (!authorization) {
    return reply(
      {
        ok: false,
        error: "authentication_required",
      },
      401,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return reply(
      {
        ok: false,
        error: "backend_configuration_error",
      },
      500,
    );
  }

  const admin = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const token =
    authorization.replace(/^Bearer\s+/i, "");

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return reply(
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
    return reply(
      {
        ok: false,
        error: "invalid_json",
      },
      400,
    );
  }

  /*
   * V26.24 supplies the Shop&Drop order identity.
   * The browser does NOT control shipping price,
   * provider credentials or trusted transaction data.
   */

  const orderId = String(
    input.order_id ??
    input.orderId ??
    "",
  ).trim();

  if (!orderId) {
    return reply(
      {
        ok: false,
        error: "order_id_required",
      },
      400,
    );
  }

  const {
    data: order,
    error: orderError,
  } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error(
      VERSION,
      "order lookup:",
      orderError,
    );

    return reply(
      {
        ok: false,
        error: "order_lookup_failed",
      },
      500,
    );
  }

  if (!order) {
    return reply(

      {
        ok: false,
        error: "order_not_found",
      },
      404,
    );
  }

  // Fix 23E: fail closed before either quotation or selection when the
  // order has no saved delivery address belonging to its buyer.
  if (!order.delivery_address_id || !order.buyer_id) {
    return reply({ ok: false, error: "delivery_address_required" }, 409);
  }
  const { data: buyerDelivery, error: buyerDeliveryError } = await admin
    .from("addresses")
    .select("id")
    .eq("id", order.delivery_address_id)
    .eq("user_id", order.buyer_id)
    .maybeSingle();
  if (buyerDeliveryError) {
    return reply({ ok: false, error: "delivery_address_lookup_failed" }, 500);
  }
  if (!buyerDelivery) {
    return reply({ ok: false, error: "delivery_address_not_authorized" }, 409);
  }

  // Fix 18D: buyer-authorized selection of a previously stored provider quote.
  // The browser supplies only the server-issued quote UUID, never its price.
  if (input.action === "select_quote") {
    if (user.id !== String(order.buyer_id ?? ""))
      return reply({ ok: false, error: "buyer_access_required" }, 403);
    const groupId = String(input.fulfilment_group_id ?? "");
    const quoteId = String(input.quote_id ?? "");
    const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (!uuid.test(groupId) || !uuid.test(quoteId))
      return reply({ ok: false, error: "valid_quote_and_group_required" }, 400);
    const [{ data: group, error: groupError }, { data: quote, error: quoteError }] = await Promise.all([
      admin.from("fulfilment_groups").select("id,order_id,selected_quote_id,status")
        .eq("id", groupId).eq("order_id", orderId).maybeSingle(),
      admin.from("courier_quotes")
        .select("id,order_id,buyer_id,fulfilment_group_id,status,expires_at,amount,currency")
        .eq("id", quoteId).eq("order_id", orderId)
        .eq("buyer_id", user.id).eq("fulfilment_group_id", groupId).maybeSingle(),
    ]);
    if (groupError || quoteError) return reply({ ok: false, error: "quote_selection_lookup_failed" }, 500);
    if (!group || !quote) return reply({ ok: false, error: "quote_selection_not_found" }, 404);
    if (group.selected_quote_id === quoteId)
      return reply({ ok: true, order_id: orderId, fulfilment_group_id: groupId, quote_id: quoteId });
    if (group.selected_quote_id) return reply({ ok: false, error: "courier_selection_already_locked" }, 409);
    const expiry = Date.parse(String(quote.expires_at ?? ""));
    if (String(quote.status).toLowerCase() !== "quoted" ||
        !Number.isFinite(expiry) || expiry <= Date.now() ||
        !Number.isFinite(Number(quote.amount)) || Number(quote.amount) <= 0)
      return reply({ ok: false, error: "courier_quote_expired_or_invalid" }, 409);
    // A169 database protections remain authoritative for selection.
    const { data: updated, error: updateError } = await admin.from("fulfilment_groups")
      .update({ selected_quote_id: quoteId })
      .eq("id", groupId).eq("order_id", orderId)
      .is("selected_quote_id", null).select("id,selected_quote_id").maybeSingle();
    if (updateError) return reply({ ok: false, error: "courier_quote_selection_rejected" }, 409);
    if (!updated) return reply({ ok: false, error: "courier_selection_changed" }, 409);
    return reply({ ok: true, order_id: orderId, fulfilment_group_id: groupId, quote_id: quoteId });
  }

  const buyerId =
    String(order.buyer_id ?? "");

  const requestedGroupId = String(input.fulfilment_group_id ?? input.fulfilmentGroupId ?? "").trim();
  let sellerId = String(order.seller_id ?? "");
  let pickupAddressId = order.pickup_address_id;
  let deliveryAddressId = order.delivery_address_id;
  let selectedProductId = order.product_id;
  let groupId: string | null = null;
  let selectedQuantity = Number(order.quantity ?? 1);

  if (requestedGroupId) {
    const { data: group, error: groupError } = await admin
      .from("fulfilment_groups")
      .select("id,order_id,seller_id,pickup_address_id,delivery_address_id")
      .eq("id", requestedGroupId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (groupError) return reply({ ok: false, error: "fulfilment_group_lookup_failed" }, 500);
    if (!group) return reply({ ok: false, error: "fulfilment_group_not_found" }, 404);
    groupId = String(group.id);
    sellerId = String(group.seller_id ?? "");
    deliveryAddressId = group.delivery_address_id ?? order.delivery_address_id;

    const { data: items, error: itemsError } = await admin
      .from("order_items")
      .select("id,product_id,seller_id,quantity")
      .eq("order_id", orderId)
      .eq("seller_id", sellerId);
    if (itemsError) return reply({ ok: false, error: "fulfilment_items_lookup_failed" }, 500);
    if (!items?.length) return reply({ ok: false, error: "fulfilment_items_missing" }, 409);

    // Current provider adapters quote exactly one physical parcel.
    // Never underquote a multi-item shipment by silently using one item's dimensions.
    if (items.length !== 1 || Number(items[0].quantity) !== 1) {
      return reply({ ok: false, error: "multi_parcel_quote_adapter_required", fulfilment_group_id: groupId }, 409);
    }
    selectedProductId = items[0].product_id;
    selectedQuantity = Number(items[0].quantity);
    pickupAddressId = group.pickup_address_id;
  } else {
    // Existing single-item compatibility. Multi-seller orders require an explicit group.
    const { data: groups, error: groupsError } = await admin
      .from("fulfilment_groups").select("id").eq("order_id", orderId).limit(2);
    if (groupsError) return reply({ ok: false, error: "fulfilment_groups_lookup_failed" }, 500);
    if ((groups ?? []).length > 1) {
      return reply({ ok: false, error: "fulfilment_group_id_required" }, 400);
    }
  }

  if (user.id !== buyerId && user.id !== sellerId) {
    return reply({ ok: false, error: "order_access_denied" }, 403);
  }

  // Resolve the product's chosen pickup address before the group's fallback.
  const { data: product, error: productError } = await admin
    .from("products").select("*")
    .eq("id", selectedProductId).eq("seller_id", sellerId).maybeSingle();
  if (productError) return reply({ ok: false, error: "product_lookup_failed" }, 500);
  if (!product) return reply({ ok: false, error: "shipping_product_missing" }, 409);
  pickupAddressId = product.pickup_address_id ?? pickupAddressId;
  if (!pickupAddressId || !deliveryAddressId) {
    return reply({ ok: false, error: "order_addresses_required" }, 409);
  }
  const [pickupResult, deliveryResult] = await Promise.all([
    admin.from("addresses").select("*").eq("id", pickupAddressId).eq("user_id", sellerId).maybeSingle(),
    admin.from("addresses").select("*").eq("id", deliveryAddressId).eq("user_id", buyerId).maybeSingle(),
  ]);
  if (pickupResult.error || deliveryResult.error) {
    return reply({ ok: false, error: "shipping_details_lookup_failed" }, 500);
  }
  const pickup = pickupResult.data;
  const delivery = deliveryResult.data;
  if (!pickup || !delivery) {
    return reply({ ok: false, error: "shipping_details_incomplete" }, 409);
  }

  if (!groupId && selectedQuantity !== 1) {
    return reply({ ok: false, error: "multi_parcel_quote_adapter_required" }, 409);
  }

  /*
   * INTERNATIONAL ROUTE
   */

  const originCountry =
    isoCountry(
      pickup.country_code,
    );

  const destinationCountry =
    isoCountry(
      delivery.country_code,
    );

  if (!originCountry || !destinationCountry) {
    return reply(
      {
        ok: false,
        error: "international_route_required",
      },
      409,
    );
  }

  const quoteCurrency =
    isoCurrency(
      order.shipping_currency ??
      order.currency ??
      input.currency,
    );

  if (!quoteCurrency) {
    return reply(
      {
        ok: false,
        error: "valid_currency_required",
      },
      409,
    );
  }

  /*
   * PARCEL
   */

  const weightKg =
    positiveNumber(
      product.shipping_weight_kg,
    );

  if (!weightKg) {
    return reply(
      {
        ok: false,
        error: "valid_shipment_weight_required",
      },
      409,
    );
  }

  const lengthCm =
    positiveNumber(
      product.shipping_length_cm,
    );

  const widthCm =
    positiveNumber(
      product.shipping_width_cm,
    );

  const heightCm =
    positiveNumber(
      product.shipping_height_cm,
    );

  /*
   * GLOBAL COURIER REGISTRY
   *
   * This is not a forced courier list.
   *
   * It represents courier integrations currently
   * available to Shop&Drop for quotation.
   */

  const {
    data: providerRows,
    error: providerError,
  } = await admin
    .from("courier_providers")
    .select("*");

  if (providerError) {
    console.error(
      VERSION,
      "courier registry:",
      providerError,
    );

    return reply(
      {
        ok: false,
        error: "courier_registry_error",
      },
      500,
    );
  }

  const availableProviders =
    (providerRows ?? [])
      .map((row: Record<string, unknown>) => {
        const code =
          cleanProvider(
            row.provider_code ??
            row.code ??
            row.provider_name,
          );

        const enabled =
          row.enabled ??
          row.active ??
          row.is_active ??
          true;

        if (!code || enabled === false) {
          return null;
        }

        return {
          code,
          row,
        };
      })
      .filter(Boolean) as Array<{
        code: string;
        row: Record<string, unknown>;
      }>;

  if (!availableProviders.length) {
    return reply(
      {
        ok: false,
        error:
          "courier_provider_configuration_required",
        origin_country: originCountry,
        destination_country: destinationCountry,
      },
      503,
    );
  }

  /*
   * Request quotes from every configured adapter.
   *
   * We return ALL successful choices.
   * We DO NOT choose the cheapest.
   * We DO NOT choose the fastest.
   * The BUYER chooses.
   */

  const results = await Promise.all(
    availableProviders.map(
      async ({ code }) => {
        const envCode =
          code

            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "_");

        const adapterUrl =
          Deno.env.get(
            `COURIER_ADAPTER_URL_${envCode}`,
          ) ?? "";

        const adapterSecret =
          Deno.env.get(
            `COURIER_ADAPTER_SECRET_${envCode}`,
          ) ?? "";

        if (!adapterUrl || !adapterSecret) {
          return [];
        }

        try {
          const providerResponse =
            await fetch(adapterUrl, {
              method: "POST",

              headers: {
                "content-type":
                  "application/json",

                "x-shopdrop-adapter-secret":
                  adapterSecret,
              },

              body: JSON.stringify({
                provider: code,

                order_id: order.id,
                ...(groupId ? { fulfilment_group_id: groupId } : {}),

                origin: {
                  country_code:
                    originCountry,

                  city:
                    pickup.city ?? null,

                  postal_code:
                    pickup.postal_code ?? null,
                },

                destination: {
                  country_code:
                    destinationCountry,

                  city:
                    delivery.city ?? null,

                  postal_code:
                    delivery.postal_code ?? null,
                },

                parcel: {
                  weight_kg: weightKg,
                  length_cm: lengthCm,
                  width_cm: widthCm,
                  height_cm: heightCm,
                },

                currency:
                  quoteCurrency,
              }),
            });

          if (!providerResponse.ok) {
            console.error(
              VERSION,
              code,
              providerResponse.status,
            );

            return [];
          }

          const result =
            await providerResponse.json();

          const providerQuotes =
            Array.isArray(result.quotes)
              ? result.quotes
              : [result];

          return providerQuotes
            .map(
              (
                quote:
                  Record<string, unknown>,
              ) => {
                const amount =
                  positiveNumber(
                    quote.amount ??
                    quote.price,
                  );

                if (!amount) {
                  return null;
                }

                return {
                  provider: code,

                  quote_reference:
                    quote.quote_reference ??
                    quote.id ??
                    null,

                  service_code:
                    quote.service_code ??
                    quote.service ??
                    null,

                  service_name:
                    quote.service_name ??
                    quote.name ??
                    null,

                  amount,

                  currency:
                    isoCurrency(
                      quote.currency,
                    ) ??
                    quoteCurrency,

                  estimated_days:
                    quote.estimated_days ??
                    quote.transit_days ??
                    null,
                };
              },
            )
            .filter(Boolean);
        } catch (error) {
          console.error(
            VERSION,
            code,
            error,
          );

          return [];
        }
      },
    ),
  );

  const quotes = results.flat();

  if (!quotes.length) {
    return reply(
      {
        ok: false,
        error: "courier_quotes_unavailable",

        origin_country:
          originCountry,

        destination_country:
          destinationCountry,

        currency:
          quoteCurrency,
      },
      503,
    );
  }

  // Fix 18D: persist only actual provider-returned quotes; no browser-supplied price.
  // Payment requires a persisted, unexpired quote tied to a seller group.
  if (groupId) {
    if (user.id !== buyerId)
      return reply({ ok: false, error: "buyer_access_required" }, 403);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const persisted = [] as Record<string, unknown>[];
    for (const quote of quotes as Record<string, unknown>[]) {
      const reference = String(quote.quote_reference ?? "").trim();
      const provider = String(quote.provider ?? "").trim();
      const currency = isoCurrency(quote.currency);
      const amount = Number(quote.amount);
      if (!reference || !provider || !currency ||
          !Number.isFinite(amount) || amount <= 0) continue;
      const days = quote.estimated_days == null ? null : Number(quote.estimated_days);
      const { data: saved, error: saveError } = await admin.from("courier_quotes")
        .insert({
          order_id: orderId,
          buyer_id: buyerId,
          fulfilment_group_id: groupId,
          courier_name: provider,
          service_name: String(quote.service_name ?? quote.service_code ?? provider),
          quote_reference: reference,
          amount,
          currency,
          estimated_days: days !== null && Number.isInteger(days) && days >= 0 ? days : null,
          status: "quoted",
          expires_at: expiresAt,
        }).select("id").single();
      if (saveError || !saved?.id) {
        console.error(VERSION, "courier_quote_persist_failed", saveError);
        return reply({ ok: false, error: "courier_quote_storage_failed" }, 503);
      }
      persisted.push({ ...quote, quote_id: saved.id, expires_at: expiresAt });
    }
    if (!persisted.length)
      return reply({ ok: false, error: "no_persistable_courier_quotes" }, 503);
    quotes.splice(0, quotes.length, ...persisted);
  }

  /*
   * RETURN ALL VALID OPTIONS.
   *
   * Buyer chooses one later.
   */

  return reply({
    ok: true,

    order_id:
      order.id,

    ...(groupId ? { fulfilment_group_id: groupId } : {}),

    origin_country:
      originCountry,

    destination_country:
      destinationCountry,

    currency:
      quoteCurrency,

    buyer_selects_courier:
      true,

    quotes,

    quoted_at:
      new Date().toISOString(),
  });
});


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-COURIER-V5-199DA-CHECKOUT";

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

  // Only the buyer can request the new private checkout context.
  // No addresses, contact details, credentials or seller IDs are returned.
  if (input.action === "checkout_context") {
    if (user.id !== order.buyer_id || user.is_anonymous === true) {
      return reply({ok:false,error:"buyer_access_required"},403);
    }
    if (order.currency !== "ZAR" || order.payment_status !== "pending" ||
        !order.delivery_address_id) {
      return reply({ok:false,error:"valid_pending_checkout_required"},409);
    }
    const [{data:address,error:addressError},
           {data:groups,error:groupError},
           {data:totals,error:totalError},
           {data:approval,error:approvalError}] = await Promise.all([
      admin.from("addresses").select("id,country_code").eq("id",order.delivery_address_id).eq("user_id",user.id).maybeSingle(),
      admin.from("fulfilment_groups").select("id,order_id,seller_id,selected_quote_id,currency,delivery_address_id").eq("order_id",orderId).limit(2),
      admin.rpc("get_order_financial_totals",{p_order_id:orderId}),
      admin.from("platform_settings").select("is_active,setting_value").eq("setting_key","shopdrop_two_payment_checkout").maybeSingle(),
    ]);
    if (addressError || groupError || totalError || approvalError || !address ||
        address.country_code !== "ZA" || groups?.length !== 1 ||
        groups[0].currency !== "ZAR" || groups[0].seller_id !== order.seller_id ||
        (groups[0].delivery_address_id && groups[0].delivery_address_id !== address.id) ||
        totals?.order_id !== orderId || totals?.currency !== "ZAR" ||
        Number(totals.seller_count) !== 1) {
      return reply({ok:false,error:"checkout_details_unavailable"},409);
    }
    const group = groups[0];
    const cents = (value: unknown) => {
      if (value == null || String(value).trim() === "") return NaN;
      const n = Number(value);
      const c = Math.round(n*100);
      return Number.isSafeInteger(c) && c >= 0 && Math.abs(n*100-c)<0.0001 ? c : NaN;
    };
    const productCents = cents(totals.product_total);
    const feeCents = cents(totals.commission_total);
    if (!Number.isSafeInteger(productCents) || productCents <= 0 ||
        !Number.isSafeInteger(feeCents) ||
        cents(totals.product_plus_commission_total) !== productCents+feeCents) {
      return reply({ok:false,error:"checkout_amounts_invalid"},409);
    }
    const code = String(Deno.env.get("SHOPDROP_APPOINTED_COURIER_CODE") ?? "").trim().toLowerCase();
    let appointed: Record<string, unknown> | null = null;
    if (approval?.is_active === true &&
        approval.setting_value?.courier_provider_confirmed === true &&
        Deno.env.get("SHOPDROP_COURIER_QUOTATIONS_ENABLED") === "true" &&
        /^[a-z0-9_-]+$/.test(code)) {
      const {data:provider,error:providerError} = await admin.from("courier_providers")
        .select("provider_code,provider_name").eq("provider_code",code)
        .eq("is_active",true).eq("supports_domestic",true).maybeSingle();
      const suffix=code.toUpperCase().replace(/[^A-Z0-9]/g,"_");
      let secureAdapter=false;
      try {
        const url=new URL(Deno.env.get("COURIER_ADAPTER_URL_"+suffix) ?? "");
        secureAdapter=url.protocol==="https:"&&!url.username&&!url.password &&
          Boolean(Deno.env.get("COURIER_ADAPTER_SECRET_"+suffix));
      } catch (_) { /* Unconfigured provider remains inactive. */ }
      if (!providerError && provider && secureAdapter) {
        appointed={code:provider.provider_code,name:provider.provider_name};
      }
    }
    let quoteResult: Record<string, unknown> | null = null;
    let courierCents: number | null = null;
    if (appointed && group.selected_quote_id) {
      const {data:quote,error:quoteError}=await admin.from("courier_quotes")
        .select("id,order_id,buyer_id,fulfilment_group_id,courier_name,quote_reference,service_name,amount,currency,status,expires_at")
        .eq("id",group.selected_quote_id).eq("order_id",orderId)
        .eq("buyer_id",user.id).eq("fulfilment_group_id",group.id).maybeSingle();
      if (quoteError) return reply({ok:false,error:"selected_quote_unavailable"},503);
      const amount=cents(quote?.amount);
      if (quote && quote.courier_name===code && quote.currency==="ZAR" &&
          ["active","valid","quoted","available","selected"].includes(String(quote.status).toLowerCase()) &&
          String(quote.quote_reference ?? "").trim() &&
          Date.parse(String(quote.expires_at))>Date.now() &&
          Number.isSafeInteger(amount) && amount>0 &&
          Number.isSafeInteger(productCents+feeCents+amount)) {
        courierCents=amount;
        quoteResult={quote_id:quote.id,quote_reference:quote.quote_reference,
          provider:code,service_name:quote.service_name,amount:amount/100,
          currency:"ZAR",expires_at:quote.expires_at};
      }
    }
    return reply({ok:true,order_id:orderId,fulfilment_group_id:group.id,
      currency:"ZAR",appointed_courier:appointed,quotation_enabled:Boolean(appointed),
      selected_quote:quoteResult,selection_locked:Boolean(group.selected_quote_id),
      amounts:{product:productCents/100,shopdrop_commission:feeCents/100,
        courier:courierCents===null?null:courierCents/100,
        total:courierCents===null?null:(productCents+feeCents+courierCents)/100},
      intended_payment_model:"single_provider_payment",
      live_payment_activated:false});
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
        .select("id,order_id,buyer_id,fulfilment_group_id,status,expires_at,amount,currency,courier_name,quote_reference")
        .eq("id", quoteId).eq("order_id", orderId)
        .eq("buyer_id", user.id).eq("fulfilment_group_id", groupId).maybeSingle(),
    ]);
    if (groupError || quoteError) return reply({ ok: false, error: "quote_selection_lookup_failed" }, 500);
    if (!group || !quote) return reply({ ok: false, error: "quote_selection_not_found" }, 404);
    // Do not accept an expired quote even for an idempotent repeat.
    const expiry = Date.parse(String(quote.expires_at ?? ""));
    if (String(quote.status).toLowerCase() !== "quoted" ||
        !Number.isFinite(expiry) || expiry <= Date.now() ||
        !Number.isFinite(Number(quote.amount)) || Number(quote.amount) <= 0)
      return reply({ ok: false, error: "courier_quote_expired_or_invalid" }, 409);
    if (order.currency === "ZAR") {
      const approvedCode=String(Deno.env.get("SHOPDROP_APPOINTED_COURIER_CODE") ?? "").trim().toLowerCase();
      const {data:approval,error:approvalError}=await admin.from("platform_settings")
        .select("is_active,setting_value").eq("setting_key","shopdrop_two_payment_checkout").maybeSingle();
      const {data:provider,error:providerError}=await admin.from("courier_providers")
        .select("provider_code").eq("provider_code",approvedCode)
        .eq("is_active",true).eq("supports_domestic",true).maybeSingle();
      if (approvalError || providerError || !provider || approval?.is_active!==true ||
          approval.setting_value?.courier_provider_confirmed!==true ||
          Deno.env.get("SHOPDROP_COURIER_QUOTATIONS_ENABLED")!=="true" ||
          quote.courier_name!==approvedCode || quote.currency!=="ZAR" ||
          !String(quote.quote_reference ?? "").trim() || order.payment_status!=="pending") {
        return reply({ok:false,error:"appointed_courier_quote_required"},409);
      }
    }
    if (group.selected_quote_id === quoteId)
      return reply({ ok: true, order_id: orderId, fulfilment_group_id: groupId, quote_id: quoteId });
    if (group.selected_quote_id) return reply({ ok: false, error: "courier_selection_already_locked" }, 409);
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

  // Fix 199D-A: South African physical-product quotation handoff.
  // Legacy international fields and routing remain unchanged.
  const domesticZA = originCountry === "ZA" && destinationCountry === "ZA";
  let appointedCode: string | null = null;
  let privateOrigin: Record<string, unknown> = {};
  let privateDestination: Record<string, unknown> = {};
  if (domesticZA) {
    if (user.id !== buyerId || user.is_anonymous === true || buyerId === sellerId) {
      return reply({ ok: false, error: "buyer_access_required" }, 403);
    }
    if (!groupId || order.payment_status !== "pending" ||
        deliveryAddressId !== order.delivery_address_id || quoteCurrency !== "ZAR") {
      return reply({ ok: false, error: "valid_pending_checkout_required" }, 409);
    }
    if (!lengthCm || !widthCm || !heightCm) {
      return reply({ ok: false, error: "complete_parcel_dimensions_required" }, 409);
    }
    // No real contact data can leave Shop&Drop before an explicitly appointed
    // courier, its adapter and the quotation activation gate are confirmed.
    const configuredCode = String(Deno.env.get("SHOPDROP_APPOINTED_COURIER_CODE") ?? "").trim().toLowerCase();
    const { data: approval, error: approvalError } = await admin
      .from("platform_settings").select("is_active,setting_value")
      .eq("setting_key", "shopdrop_two_payment_checkout").maybeSingle();
    if (approvalError || approval?.is_active !== true ||
        approval.setting_value?.courier_provider_confirmed !== true ||
        Deno.env.get("SHOPDROP_COURIER_QUOTATIONS_ENABLED") !== "true" ||
        !/^[a-z0-9_-]+$/.test(configuredCode)) {
      return reply({ ok: false, error: "appointed_courier_not_activated" }, 503);
    }
    appointedCode = configuredCode;
    // Use the already ownership-checked, exact selected addresses.
    // Contact numbers fall back to each party's private profile only.
    const [{ data: sellerProfile, error: sellerProfileError },
           { data: buyerProfile, error: buyerProfileError }] = await Promise.all([
      admin.from("profiles").select("full_name,mobile_number").eq("id", sellerId).maybeSingle(),
      admin.from("profiles").select("full_name,mobile_number").eq("id", buyerId).maybeSingle(),
    ]);
    if (sellerProfileError || buyerProfileError || !sellerProfile || !buyerProfile) {
      return reply({ ok: false, error: "private_courier_contact_unavailable" }, 409);
    }
    const field = (value: unknown) => String(value ?? "").trim();
    const contact = (address: Record<string, unknown>, profile: Record<string, unknown>) => {
      const phone = field(address.mobile_number) || field(profile.mobile_number);
      const digits = phone.replace(/\D/g, "");
      if (!/^[+0-9 ()-]+$/.test(phone) || digits.length < 9 || digits.length > 15 ||
          !field(address.address_line_1) || !field(address.city) || !field(address.state_province)) {
        return null;
      }
      return {
        name: field(address.recipient_name) || field(profile.full_name),
        mobile_number: phone,
        address_line_1: field(address.address_line_1),
        address_line_2: field(address.address_line_2) || null,
        state_province: field(address.state_province),
      };
    };
    const origin = contact(pickup, sellerProfile);
    const destination = contact(delivery, buyerProfile);
    if (!origin || !destination) {
      return reply({ ok: false, error: "courier_address_or_contact_incomplete" }, 409);
    }
    privateOrigin = origin;
    privateDestination = destination;
  }

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

  const quoteProviders = domesticZA
    ? availableProviders.filter(({code,row}) =>
        code === appointedCode && row.is_active === true && row.supports_domestic === true)
    : availableProviders;
  if (domesticZA && quoteProviders.length !== 1) {
    return reply({ ok: false, error: "appointed_courier_not_available" }, 503);
  }
  const results = await Promise.all(
    quoteProviders.map(
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

        // Refuse non-HTTPS destinations and redirects for protected ZA data.
        if (domesticZA) {
          try {
            const destination = new URL(adapterUrl);
            if (destination.protocol !== "https:" || destination.username || destination.password) return [];
          } catch (_) { return []; }
        }
        try {
          const providerResponse =
            await fetch(adapterUrl, {
              method: "POST",
              ...(domesticZA ? { redirect: "error" as const } : {}),

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
                  ...privateOrigin,
                  country_code:
                    originCountry,

                  city:
                    pickup.city ?? null,

                  postal_code:
                    pickup.postal_code ?? null,
                },

                destination: {
                  ...privateDestination,
                  country_code:
                    destinationCountry,

                  city:
                    delivery.city ?? null,

                  postal_code:
                    delivery.postal_code ?? null,
                },

                parcel: {
                  ...(domesticZA ? {
                    item_reference: product.listing_reference ?? null,
                    item_description: product.title ?? null,
                  } : {}),
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
            "courier_adapter_request_failed",
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

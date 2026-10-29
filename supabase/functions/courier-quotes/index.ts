import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R7-COURIER-V2";

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

  const buyerId =
    String(order.buyer_id ?? "");

  const sellerId =
    String(order.seller_id ?? "");

  if (
    user.id !== buyerId &&
    user.id !== sellerId
  ) {
    return reply(
      {
        ok: false,
        error: "order_access_denied",
      },
      403,
    );
  }

  /*
   * INTERNATIONAL ROUTE
   */

  const originCountry =
    isoCountry(
      order.origin_country_code ??
      order.seller_country_code ??
      input.origin_country_code,
    );

  const destinationCountry =
    isoCountry(
      order.destination_country_code ??
      order.delivery_country_code ??
      order.buyer_country_code ??
      input.destination_country_code,
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
      order.shipping_weight_kg ??
      order.weight_kg ??
      input.weight_kg,
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
      order.shipping_length_cm ??
      input.length_cm,
    );

  const widthCm =
    positiveNumber(
      order.shipping_width_cm ??
      input.width_cm,
    );

  const heightCm =
    positiveNumber(
      order.shipping_height_cm ??
      input.height_cm,
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

                origin: {
                  country_code:
                    originCountry,

                  city:
                    order.origin_city ??
                    order.seller_city ??
                    null,

                  postal_code:
                    order.origin_postal_code ??
                    order.seller_postal_code ??
                    null,
                },

                destination: {
                  country_code:
                    destinationCountry,

                  city:
                    order.destination_city ??
                    order.delivery_city ??
                    null,

                  postal_code:
                    order.destination_postal_code ??
                    order.delivery_postal_code ??
                    null,
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

  /*
   * RETURN ALL VALID OPTIONS.
   *
   * Buyer chooses one later.
   */

  return reply({
    ok: true,

    order_id:
      order.id,

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
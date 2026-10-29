import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION =
  "SHOPDROP-R12E-A2-CREATE-PAYMENT-SESSION-V2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function reply(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function isoCountry(
  value: unknown,
) {
  const country =
    String(value ?? "")
      .trim()
      .toUpperCase();

  return /^[A-Z]{2}$/.test(country)
    ? country
    : null;
}

function isoCurrency(
  value: unknown,
) {
  const currency =
    String(value ?? "")
      .trim()
      .toUpperCase();

  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : null;
}

function cleanProvider(
  value: unknown,
) {
  const provider =
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]/g,
        "",
      );

  return provider || null;
}

function cleanDeliveryMethod(
  value: unknown,
) {
  const method =
    String(
      value ??
      "integrated_courier",
    )
      .trim()
      .toLowerCase();

  if (
    method === "integrated_courier" ||
    method === "buyer_arranged" ||
    method === "collection"
  ) {
    return method;
  }

  return null;
}

function money(
  value: unknown,
) {
  const number =
    Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(
    number * 100,
  ) / 100;
}

Deno.serve(
  async (req) => {

    if (req.method === "OPTIONS") {
      return new Response(
        "ok",
        {
          headers: corsHeaders,
        },
      );
    }


    if (req.method !== "POST") {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "method_not_allowed",
        },
        405,
      );
    }


    if (
      !SUPABASE_URL ||
      !SERVICE_ROLE_KEY
    ) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "backend_configuration_error",
        },
        500,
      );
    }


    /*
     * ========================================================
     * SHOP&DROP AUTOMATED CHECKOUT
     * ========================================================
     *
     * CONTROLLING ARCHITECTURE
     *
     * V26.24 remains unchanged.
     *
     * Browser NEVER controls:
     *
     * product prices
     * commission percentages
     * commission amounts
     * seller proceeds
     * courier settlement
     * trusted checkout totals
     *
     * Supabase calculates all authoritative amounts.
     *
     * COMMISSION:
     *
     * EACH purchased item/listing:
     *
     * below 1000.00 = 10%
     * 1000.00+      = 7%
     *
     * Commission is calculated PER ITEM before seller totals
     * are aggregated.
     *
     * One buyer checkout may contain:
     *
     * many listing references
     * many sellers
     * many fulfilment groups
     * many shipments
     * many courier allocations
     *
     * while remaining one order / checkout and one payment
     * attempt.
     *
     * DELIVERY:
     *
     * integrated_courier
     * buyer_arranged
     * collection
     *
     * Integrated courier money remains independent from
     * seller payout.
     *
     * Seller money remains protected until that seller's
     * verified delivery.
     *
     * PRIVACY:
     *
     * private buyer/seller fulfilment information is never
     * sent to public browser code.
     *
     * Authorized courier/provider adapters later receive only
     * the minimum necessary protected fulfilment information.
     *
     * NORMAL OPERATION:
     *
     * fully automatic.
     * No employee performs ordinary payment routing.
     * ========================================================
     */


    const authorization =
      req.headers.get(
        "Authorization",
      );


    if (!authorization) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "authentication_required",
        },
        401,
      );
    }


    const userClient =
      createClient(
        SUPABASE_URL,
        Deno.env.get(
          "SUPABASE_ANON_KEY",
        ) ?? SERVICE_ROLE_KEY,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },

          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );


    const {
      data: {
        user,
      },
      error: userError,
    } =
      await userClient.auth
        .getUser();


    if (
      userError ||
      !user
    ) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "invalid_authentication",
        },
        401,
      );
    }


    let input:
      Record<string, unknown>;


    try {
      input =
        await req.json();
    } catch {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "invalid_json",
        },
        400,
      );
    }


    const orderId =
      String(
        input.order_id ??
        input.orderId ??
        "",
      ).trim();


    if (!orderId) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "order_id_required",
        },
        400,
      );
    }


    const deliveryMethod =
      cleanDeliveryMethod(
        input.delivery_method ??
        input.deliveryMethod ??
        "integrated_courier",
      );


    if (!deliveryMethod) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "invalid_delivery_method",
        },
        400,
      );
    }


    const admin =
      createClient(
        SUPABASE_URL,
        SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );


    /*
     * ========================================================
     * TRUSTED ORDER
     * ========================================================
     */


    const {
      data: order,
      error: orderError,
    } =
      await admin
        .from("orders")
        .select("*")
        .eq(
          "id",
          orderId,
        )
        .single();


    if (
      orderError ||
      !order
    ) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "order_not_found",
        },
        404,
      );
    }


    if (
      order.buyer_id &&
      String(
        order.buyer_id,
      ) !== user.id
    ) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "order_access_denied",
        },
        403,
      );
    }


    const currency =
      isoCurrency(
        order.currency,
      );


    if (!currency) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "invalid_order_currency",
        },
        409,
      );
    }


    const country =
      isoCountry(
        order.country_code ??
        order.buyer_country_code ??
        order.delivery_country_code,
      );


    /*
     * ========================================================
     * AUTHORITATIVE ITEM-LEVEL FINANCIAL CALCULATION
     * ========================================================
     *
     * A2.1 database function calculates:
     *
     * product total
     * item-by-item commission
     * seller count
     * item count
     *
     * It does NOT trust V26.24/browser prices.
     */


    const {
      data: financialData,
      error: financialError,
    } =
      await admin.rpc(
        "get_order_financial_totals",
        {
          p_order_id:
            orderId,
        },
      );


    if (
      financialError ||
      !financialData
    ) {
      console.error(
        VERSION,
        "financial calculation failed",
        financialError,
      );

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "financial_calculation_failed",
          order_id:
            orderId,
        },
        409,
      );
    }


    const productTotal =
      money(
        financialData
          .product_total,
      );


    const commissionTotal =
      money(
        financialData
          .commission_total,
      );


    const productPlusCommission =
      money(
        financialData
          .product_plus_commission_total,
      );


    if (
      productTotal === null ||
      commissionTotal === null ||
      productPlusCommission === null ||
      productTotal < 0 ||
      commissionTotal < 0
    ) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "invalid_financial_totals",
        },
        409,
      );
    }


    /*
     * ========================================================
     * CREATE / REFRESH SELLER + SHOP&DROP ALLOCATIONS
     * ========================================================
     *
     * This creates seller allocations and commission
     * allocations from the item-level calculation.
     *
     * Courier allocations are created separately per physical
     * fulfilment/shipment.
     */


    const {
      data: allocationData,
      error: allocationError,
    } =
      await admin.rpc(
        "create_multiseller_payment_allocations",
        {
          p_order_id:
            orderId,

          p_currency:
            currency,

          p_delivery_method:
            deliveryMethod,
        },
      );


    if (allocationError) {
      console.error(
        VERSION,
        "allocation creation failed",
        allocationError,
      );

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_allocation_failed",
          order_id:
            orderId,
        },
        409,
      );
    }


    /*
     * ========================================================
     * COURIER TOTAL
     * ========================================================
     *
     * Integrated courier:
     *
     * courier allocations may already exist for actual
     * fulfilment/shipment bookings.
     *
     * Buyer-arranged / collection:
     *
     * Shop&Drop courier amount MUST be zero.
     */


    let courierTotal = 0;


    if (
      deliveryMethod ===
        "integrated_courier"
    ) {

      const {
        data: courierRows,
        error: courierError,
      } =
        await admin
          .from(
            "payment_allocations",
          )
          .select(
            "amount,status",
          )
          .eq(
            "order_id",
            orderId,
          )
          .eq(
            "allocation_type",
            "courier",
          );


      if (courierError) {
        console.error(
          VERSION,
          "courier allocation read failed",
          courierError,
        );

        return reply(
          {
            ok: false,
            version: VERSION,
            error:
              "courier_allocation_read_failed",
          },
          500,
        );
      }


      courierTotal =
        Math.round(
          (courierRows ?? [])
            .reduce(
              (
                total:
                  number,
                row:
                  Record<
                    string,
                    unknown
                  >,
              ) => {

                const amount =
                  Number(
                    row.amount ??
                    0,
                  );

                return total +
                  (
                    Number.isFinite(
                      amount,
                    )
                      ? amount
                      : 0
                  );
              },
              0,
            )
            *
            100,
        ) / 100;

    } else {

      courierTotal = 0;
    }


    const checkoutTotal =
      Math.round(
        (
          productPlusCommission +
          courierTotal
        )
        *
        100,
      ) / 100;


    /*
     * ========================================================
     * PAYMENT PROVIDER SELECTION
     * ========================================================
     *
     * Still provider-neutral.
     *
     * No Stripe / Adyen / PayPal / other provider is
     * hard-coded.
     */


    const requestedProvider =
      cleanProvider(
        input.provider,
      );


    let providerQuery =
      admin
        .from(
          "payment_providers",
        )
        .select("*");


    if (requestedProvider) {
      providerQuery =
        providerQuery.eq(
          "provider_code",
          requestedProvider,
        );
    }


    const {
      data: providerRows,
      error: providerError,
    } =
      await providerQuery;


    if (providerError) {
      console.error(
        VERSION,
        providerError,
      );

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_provider_registry_error",
        },
        500,
      );
    }


    const providers =
      (
        providerRows ??
        []
      ).filter(
        (
          provider:
            Record<
              string,
              unknown
            >,
        ) => {

          const active =
            provider.active ??
            provider.enabled ??
            provider.is_active ??
            true;


          if (
            active === false
          ) {
            return false;
          }


          const currencies =
            Array.isArray(
              provider.currencies,
            )
              ? provider.currencies
                  .map(
                    (
                      value:
                        unknown,
                    ) =>
                      String(
                        value,
                      )
                        .toUpperCase(),
                  )
              : null;


          if (
            currencies &&
            currencies.length &&
            !currencies.includes(
              currency,
            )
          ) {
            return false;
          }


          const countries =
            Array.isArray(
              provider.countries,
            )
              ? provider.countries
                  .map(
                    (
                      value:
                        unknown,
                    ) =>
                      String(
                        value,
                      )
                        .toUpperCase(),
                  )
              : null;


          if (
            country &&
            countries &&
            countries.length &&
            !countries.includes(
              country,
            )
          ) {
            return false;
          }


          return true;
        },
      );


    if (!providers.length) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_provider_not_available",
          country,
          currency,
        },
        503,
      );
    }


    providers.sort(
      (
        a:
          Record<
            string,
            unknown
          >,
        b:
          Record<
            string,
            unknown
          >,
      ) =>
        Number(
          a.priority ??
          999,
        )
        -
        Number(
          b.priority ??
          999,
        ),
    );


    const selected =
      providers[0];


    const providerCode =
      cleanProvider(
        selected.provider_code ??
        selected.code ??
        selected.provider_name,
      );


    if (!providerCode) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "invalid_payment_provider_configuration",
        },
        500,
      );
    }


    const providerEnvName =
      providerCode
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          "_",
        );


    const adapterUrl =
      Deno.env.get(
        `PAYMENT_ADAPTER_URL_${providerEnvName}`,
      ) ?? "";


    const adapterSecret =
      Deno.env.get(
        `PAYMENT_ADAPTER_SECRET_${providerEnvName}`,
      ) ?? "";


    if (
      !adapterUrl ||
      !adapterSecret
    ) {
      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_provider_configuration_required",
          provider:
            providerCode,
          country,
          currency,
        },
        503,
      );
    }


    /*
     * ========================================================
     * INVENTORY RESERVATION
     * ========================================================
     *
     * Only after:
     *
     * order validation
     * financial calculation
     * allocation calculation
     * usable payment provider resolution
     *
     * do we reserve stock.
     */


    const {
      data: reservationData,
      error: reservationError,
    } =
      await admin.rpc(
        "reserve_order_inventory",
        {
          p_order_id:
            orderId,
        },
      );


    if (reservationError) {
      console.error(
        VERSION,
        "inventory reservation failed",
        reservationError,
      );

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "inventory_reservation_failed",

          user_message:
            "One or more items are no longer available for checkout.",

          order_id:
            orderId,
        },
        409,
      );
    }


    const reservation =
      reservationData ??
      {
        ok: true,
        order_id:
          orderId,
      };


    async function
      releaseCheckoutReservation() {

      const {
        error: releaseError,
      } =
        await admin.rpc(
          "release_order_inventory",
          {
            p_order_id:
              orderId,

            p_reason:
              "payment_session_failed",
          },
        );


      if (releaseError) {
        console.error(
          VERSION,
          "reservation release failed",
          releaseError,
        );

        return false;
      }


      return true;
    }


    /*
     * ========================================================
     * ITEM REFERENCES FOR PAYMENT AUDIT
     * ========================================================
     *
     * No private seller contact/address data is included.
     */


    const {
      data: orderItems,
      error: itemError,
    } =
           await admin
        .from("order_items")
        .select(
          "id,order_id,product_id,seller_id,quantity,unit_price",
        )
        .eq(
          "order_id",
          orderId,
        );


    if (
      itemError ||
      !orderItems ||
      !orderItems.length
    ) {
      await releaseCheckoutReservation();

      console.error(
        VERSION,
        "order item read failed",
        itemError,
      );

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "order_items_not_available",
        },
        409,
      );
    }


    /*
     * ========================================================
     * BUILD SAFE ITEM FINANCIAL BREAKDOWN
     *
     * IMPORTANT:
     *
     * Commission tier is determined independently for each
     * purchased item/listing.
     *
     * No seller address, mobile number, email or other private
     * fulfilment information is sent to the payment provider.
     * ========================================================
     */


    const itemBreakdown:
      Array<
        Record<
          string,
          unknown
        >
      > = [];


    for (
      const item
      of orderItems
    ) {

      const unitPrice =
        money(
          item.unit_price,
        );


      const quantity =
        Number(
          item.quantity ??
          0,
        );


      if (
        unitPrice === null ||
        unitPrice < 0 ||
        !Number.isInteger(
          quantity,
        ) ||
        quantity <= 0
      ) {
        await releaseCheckoutReservation();

        return reply(
          {
            ok: false,
            version: VERSION,
            error:
              "invalid_order_item_financial_data",
            order_item_id:
              item.id,
          },
          409,
        );
      }


      const commissionRate =
        unitPrice < 1000
          ? 0.10
          : 0.07;


      const lineProductTotal =
        Math.round(
          unitPrice *
          quantity *
          100,
        ) / 100;


      const lineCommission =
        Math.round(
          (
            Math.round(
              unitPrice *
              commissionRate *
              100,
            ) / 100
          )
          *
          quantity
          *
          100,
        ) / 100;


      itemBreakdown.push(
        {
          order_item_id:
            item.id,

          product_id:
            item.product_id,

          seller_id:
            item.seller_id,

          quantity,

          unit_price:
            unitPrice,

          product_amount:
            lineProductTotal,

          commission_rate:
            commissionRate,

          commission_percentage:
            commissionRate * 100,

          commission_amount:
            lineCommission,
        },
      );
    }


    /*
     * ========================================================
     * PAYMENT REFERENCE
     *
     * Order/listing references remain independent.
     *
     * One payment attempt receives its own payment reference.
     *
     * A failed attempt can therefore be retried without
     * destroying the original order/listing references.
     * ========================================================
     */


    let paymentReference:
      string | null = null;


    const {
      data: referenceData,
      error: referenceError,
    } =
      await admin.rpc(
        "generate_shopdrop_reference",
        {
          p_reference_type:
            "payment",
        },
      );


    if (!referenceError) {

      if (
        typeof referenceData ===
        "string"
      ) {
        paymentReference =
          referenceData;
      } else if (
        referenceData &&
        typeof referenceData ===
          "object"
      ) {
        paymentReference =
          String(
            (
              referenceData as
                Record<
                  string,
                  unknown
                >
            ).reference ??
            (
              referenceData as
                Record<
                  string,
                  unknown
                >
            ).reference_number ??
            (
              referenceData as
                Record<
                  string,
                  unknown
                >
            ).value ??
            "",
          ).trim() || null;
      }
    }


    /*
     * If the reference RPC has a different signature in the
     * current database, payment creation below may still use
     * its existing database-generated reference mechanism.
     */


    /*
     * ========================================================
     * PAYMENT RECORD
     *
     * Record authoritative Shop&Drop financial values BEFORE
     * requesting the external provider session.
     *
     * We intentionally use only columns already supported by
     * the existing payments architecture.
     * ========================================================
     */


    const paymentInsert:
      Record<
        string,
        unknown
      > = {
        order_id:
          orderId,

        buyer_id:
          user.id,

        currency,

        product_amount:
          productTotal,

        courier_amount:
          courierTotal,

        commission_amount:
          commissionTotal,

        gross_amount:
          checkoutTotal,

        provider_id:
          selected.id ?? null,

        payment_status:
          "pending",
      };


    if (paymentReference) {
      paymentInsert
        .payment_reference =
          paymentReference;
    }


    let payment:
      Record<
        string,
        unknown
      > | null = null;


    const {
      data: paymentData,
      error: paymentError,
    } =
      await admin
        .from("payments")
        .insert(
          paymentInsert,
        )
        .select("*")
        .single();


    if (paymentError) {

      /*
       * Compatibility fallback:
       *
       * If payment_reference is not a physical payments
       * column, remove it and allow the existing database
       * reference architecture to operate.
       */

      if (
        paymentReference &&
        String(
          paymentError.message ??
          "",
        )
          .toLowerCase()
          .includes(
            "payment_reference",
          )
      ) {

        delete paymentInsert
          .payment_reference;


        const fallback =
          await admin
            .from("payments")
            .insert(
              paymentInsert,
            )
            .select("*")
            .single();


        if (
          fallback.error ||
          !fallback.data
        ) {
          await releaseCheckoutReservation();

          console.error(
            VERSION,
            "payment record failed",
            fallback.error,
          );

          return reply(
            {
              ok: false,
              version: VERSION,
              error:
                "payment_record_creation_failed",
            },
            500,
          );
        }


        payment =
          fallback.data;

      } else {

        await releaseCheckoutReservation();

        console.error(
          VERSION,
          "payment record failed",
          paymentError,
        );

        return reply(
          {
            ok: false,
            version: VERSION,
            error:
              "payment_record_creation_failed",
          },
          500,
        );
      }

    } else {

      payment =
        paymentData;
    }


    if (!payment) {
      await releaseCheckoutReservation();

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_record_missing",
        },
        500,
      );
    }


    const paymentId =
      String(
        payment.id ??
        "",
      ).trim();


    if (!paymentId) {
      await releaseCheckoutReservation();

      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_id_missing",
        },
        500,
      );
    }


    /*
     * ========================================================
     * LINK FINANCIAL ALLOCATIONS TO PAYMENT
     * ========================================================
     */


    const {
      error:
        allocationLinkError,
    } =
      await admin
        .from(
          "payment_allocations",
        )
        .update(
          {
            payment_id:
              paymentId,

            provider_code:
              providerCode,

            updated_at:
              new Date()
                .toISOString(),
          },
        )
        .eq(
          "order_id",
          orderId,
        )
        .is(
          "payment_id",
          null,
        );


    if (allocationLinkError) {

      await releaseCheckoutReservation();

      console.error(
        VERSION,
        "allocation payment link failed",
        allocationLinkError,
      );

      await admin
        .from("payments")
        .update(
          {
            payment_status:
              "failed",
          },
        )
        .eq(
          "id",
          paymentId,
        );


      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "allocation_payment_link_failed",
        },
        500,
      );
    }


    /*
     * ========================================================
     * PROVIDER ADAPTER PAYLOAD
     *
     * This is the permanent provider-neutral contract.
     *
     * Future provider receives:
     *
     * one checkout total
     * product total
     * Shop&Drop commission total
     * courier total
     * individual item references/calculations
     *
     * It receives NO private seller fulfilment details.
     * ========================================================
     */


    const adapterPayload = {
      version:
        VERSION,

      payment_id:
        paymentId,

      payment_reference:
        paymentReference ??
        payment.payment_reference ??
        payment.reference ??
        null,

      order_id:
        orderId,

      buyer_id:
        user.id,

      country,

      currency,

      delivery_method:
        deliveryMethod,

      amounts: {
        product:
          productTotal,

        shopdrop_commission:
          commissionTotal,

        courier:
          courierTotal,

        total:
          checkoutTotal,
      },

      allocation_model:
        "shopdrop_three_way",

      commission_model:
        "per_order_item",

      commission_rules: {
        below_1000:
          0.10,

        from_1000:
          0.07,
      },

      items:
        itemBreakdown,

      seller_count:
        Number(
          financialData
            .seller_count ??
          allocationData
            ?.seller_count ??
          0,
        ),

      item_count:
        Number(
          financialData
            .item_count ??
          allocationData
            ?.item_count ??
          orderItems.length,
        ),

      courier_policy: {
        buyer_selects:
          true,

        independent_allocation:
          true,

        settlement_before_delivery:
          true,

        seller_payout_dependency:
          false,
      },

      seller_policy: {
        held_until_verified_delivery:
          true,

        inspection_window:
          false,

        independent_by_fulfilment_group:
          true,
      },

      privacy: {
        expose_seller_address:
          false,

        expose_seller_phone:
          false,

        expose_seller_email:
          false,

        courier_protected_handoff:
          true,
      },

      metadata: {
        reservation:
          reservation,

        architecture:
          "A2.1",
      },
    };


    /*
     * ========================================================
     * CREATE EXTERNAL PAYMENT SESSION
     * ========================================================
     */


    let adapterResponse:
      Response;


    try {

      adapterResponse =
        await fetch(
          adapterUrl,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${adapterSecret}`,

              "X-ShopDrop-Provider":
                providerCode,

              "X-ShopDrop-Payment":
                paymentId,

              "X-ShopDrop-Order":
                orderId,
            },

            body:
              JSON.stringify(
                adapterPayload,
              ),
          },
        );

    } catch (error) {

      await releaseCheckoutReservation();


      await admin
        .from("payments")
        .update(
          {
            payment_status:
              "failed",
          },
        )
        .eq(
          "id",
          paymentId,
        );


      console.error(
        VERSION,
        "payment adapter unavailable",
        error,
      );


      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_provider_unavailable",
          provider:
            providerCode,
        },
        502,
      );
    }


    let providerResult:
      Record<
        string,
        unknown
      > = {};


    try {

      const parsed =
        await adapterResponse
          .json();


      if (
        parsed &&
        typeof parsed ===
          "object"
      ) {
        providerResult =
          parsed;
      }

    } catch {
      providerResult = {};
    }


    if (!adapterResponse.ok) {

      await releaseCheckoutReservation();


      await admin
        .from("payments")
        .update(
          {
            payment_status:
              "failed",
          },
        )
        .eq(
          "id",
          paymentId,
        );


      return reply(
        {
          ok: false,
          version: VERSION,
          error:
            "payment_session_creation_failed",

          provider:
            providerCode,

          provider_status:
            adapterResponse.status,
        },
        502,
      );
    }


    /*
     * ========================================================
     * STORE SAFE PROVIDER REFERENCES
     * ========================================================
     */


    const providerPaymentReference =
      String(
        providerResult
          .payment_reference ??
        providerResult
          .payment_id ??
        providerResult
          .id ??
        "",
      ).trim() || null;


    const checkoutUrl =
      String(
        providerResult
          .checkout_url ??
        providerResult
          .redirect_url ??
        providerResult
          .url ??
        "",
      ).trim() || null;


    const updateData:
      Record<
        string,
        unknown
      > = {
        payment_status:
          "session_created",
      };


    if (
      providerPaymentReference
    ) {
      updateData
        .provider_payment_reference =
          providerPaymentReference;
    }


    const {
      error: paymentUpdateError,
    } =
      await admin
        .from("payments")
        .update(
          updateData,
        )
        .eq(
          "id",
          paymentId,
        );


    if (paymentUpdateError) {
      console.error(
        VERSION,
        "payment provider reference update failed",
        paymentUpdateError,
      );
    }


    /*
     * ========================================================
     * SUCCESS
     *
     * IMPORTANT:
     *
     * Payment is NOT considered paid here.
     *
     * payment-webhook will independently verify the provider
     * event before:
     *
     * inventory commit
     * seller hold confirmation
     * Shop&Drop commission confirmation
     * courier allocation availability
     * fulfilment progression
     *
     * ========================================================
     */


    return reply(
      {
        ok: true,

        version:
          VERSION,

        order_id:
          orderId,

        payment_id:
          paymentId,

        payment_reference:
          paymentReference ??
          payment.payment_reference ??
          payment.reference ??
          null,

        provider:
          providerCode,

        currency,

        delivery_method:
          deliveryMethod,

        amounts: {
          product:
            productTotal,

          shopdrop_commission:
            commissionTotal,

          courier:
            courierTotal,

          total:
            checkoutTotal,
        },

        commission_calculation:
          "per_order_item",

        item_count:
          orderItems.length,

        seller_count:
          Number(
            financialData
              .seller_count ??
            0,
          ),

        checkout_url:
          checkoutUrl,

        provider_session:
          providerResult
            .session_id ??
          providerResult
            .session_reference ??
          null,
      },
      200,
    );

  },
);
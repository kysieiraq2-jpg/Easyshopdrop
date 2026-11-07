// SHOPDROP-FIX31E
// Provider-neutral calculations only; no live payments.

export interface CheckoutAmounts {
  product_amount: number;
  courier_amount: number;
  shopdrop_commission: number;
  seller_payout_amount: number;
  total_paid: number;
  currency: string;
}

export interface PaymentLeg {
  payment_type: "courier_direct" | "marketplace";
  destination_type: "courier_provider" | "marketplace_provider";
  amount: number;
  currency: "ZAR";
}

function cents(n: number): number {
  if (!Number.isFinite(n) || n < 0 ||
      Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) {
    throw new Error("invalid_amount");
  }
  return Math.round(n * 100);
}

export function prepareCheckoutLegs(
  p: CheckoutAmounts,
): PaymentLeg[] {
  if (p.currency !== "ZAR") throw new Error("currency_not_supported");
  const product = cents(p.product_amount);
  const courier = cents(p.courier_amount);
  const fee = cents(p.shopdrop_commission);
  if (cents(p.seller_payout_amount) !== product) {
    throw new Error("seller_amount_mismatch");
  }
  if (cents(p.total_paid) !== product + courier + fee) {
    throw new Error("checkout_total_mismatch");
  }
  if (product + fee <= 0) {
    throw new Error("empty_marketplace_payment");
  }
  const legs: PaymentLeg[] = [{
    payment_type: "marketplace",
    destination_type: "marketplace_provider",
    amount: (product + fee) / 100,
    currency: "ZAR",
  }];
  if (courier > 0) legs.push({
    payment_type: "courier_direct",
    destination_type: "courier_provider",
    amount: courier / 100,
    currency: "ZAR",
  });
  return legs;
}

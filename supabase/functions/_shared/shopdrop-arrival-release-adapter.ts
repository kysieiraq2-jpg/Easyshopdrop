
// Shop&Drop — Shared arrival payout adapter.
// Services and dispatching.
// Provider-neutral, fail-closed implementation.
// No live funds movement.
// Existing payout functions remain untouched.

export type ArrivalBookingType =
  | "service"
  | "dispatch";

export interface ArrivalReleaseRequest {
  ledger_id: string;
  booking_type: ArrivalBookingType;
  booking_id: string;
  payment_id: string;
  provider_id: string;
  provider_code: string;
  provider_amount: number;
  currency: string;
  idempotency_key: string;
}

export interface ArrivalReleaseResult {
  ok: boolean;
  status:
    | "activation_required"
    | "provider_not_configured"
    | "rejected";
  submitted: boolean;
  funds_moved: boolean;
  provider_reference: null;
  idempotency_key: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validMoney(value: number): boolean {
  return Number.isFinite(value) &&
    value > 0 &&
    value <= 999999999 &&
    Math.abs(value * 100 - Math.round(value * 100)) <
      0.000001;
}

export function validateArrivalRelease(
  request: ArrivalReleaseRequest,
): void {
  if (
    !UUID.test(request.ledger_id) ||
    !UUID.test(request.booking_id) ||
    !UUID.test(request.payment_id) ||
    !UUID.test(request.provider_id)
  ) {
    throw new Error("invalid_release_identity");
  }

  if (
    request.booking_type !== "service" &&
    request.booking_type !== "dispatch"
  ) {
    throw new Error("invalid_booking_type");
  }

  if (!validMoney(request.provider_amount)) {
    throw new Error("invalid_provider_amount");
  }

  if (!/^[A-Z]{3}$/.test(request.currency)) {
    throw new Error("invalid_currency");
  }

  if (
    typeof request.provider_code !== "string" ||
    request.provider_code.length > 64 ||
    !/^[a-z0-9_-]+$/i.test(request.provider_code)
  ) {
    throw new Error("invalid_provider_code");
  }

  const expectedKey =
    "shopdrop:arrival:" +
    request.booking_type + ":" +
    request.booking_id.toLowerCase();

  if (request.idempotency_key !== expectedKey) {
    throw new Error("invalid_idempotency_key");
  }
}

export function arrivalReleaseIdempotencyKey(
  bookingType: ArrivalBookingType,
  bookingId: string,
): string {
  if (
    (bookingType !== "service" &&
      bookingType !== "dispatch") ||
    !UUID.test(bookingId)
  ) {
    throw new Error("invalid_release_identity");
  }

  return "shopdrop:arrival:" +
    bookingType + ":" +
    bookingId.toLowerCase();
}

export async function submitArrivalRelease(
  request: ArrivalReleaseRequest,
): Promise<ArrivalReleaseResult> {
  validateArrivalRelease(request);

  // No provider may receive a release request until:
  // 1. Confirmed payment and provider-held funds.
  // 2. Verified six-digit arrival PIN.
  // 3. Correct provider assignment.
  // 4. No active dispute or payout hold.
  // 5. Atomic ledger claim and idempotency check.
  // 6. Compatible provider adapter configured.
  // 7. Explicit live payout activation.
  //
  // These conditions must be enforced server-side,
  // immediately before provider submission.
  //
  // This implementation deliberately cannot move money.

  return {
    ok: false,
    status: "activation_required",
    submitted: false,
    funds_moved: false,
    provider_reference: null,
    idempotency_key: request.idempotency_key,
  };
}


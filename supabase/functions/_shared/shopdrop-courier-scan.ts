/**
 * Shop&Drop courier scan adapter foundation.
 * No database writes, shipment state transitions, or payouts.
 * Only call after authenticating the courier webhook (signature/secret) and
 * matching the event to the provider shipment in the database.
 */
export type CourierScanInput = {
  provider: string;
  trackingNumber: string;
  eventId: string;
  eventCode: string;
  occurredAt: string;
  proofOfDeliveryReference?: string | null;
};

export type CourierScanResult = {
  kind: 'verified_delivery_candidate' | 'non_delivery_scan' | 'invalid';
  eventKey?: string;
  reason: string;
  occurredAt?: string;
};

const FINAL_DELIVERY_CODES = new Set([
  'delivered', 'delivery_completed', 'proof_of_delivery', 'pod_confirmed',
]);
const NON_DELIVERY_CODES = new Set([
  'picked_up', 'pickup', 'collected', 'in_transit', 'at_depot',
  'out_for_delivery', 'delivery_attempted', 'exception', 'returned',
]);

export function classifyCourierScan(
  input: CourierScanInput,
  context: { webhookAuthenticated: boolean; shipmentMatched: boolean },
): CourierScanResult {
  if (!context.webhookAuthenticated || !context.shipmentMatched) {
    return { kind: 'invalid', reason: 'untrusted_or_unmatched_shipment' };
  }
  const provider = input.provider?.trim();
  const tracking = input.trackingNumber?.trim();
  const eventId = input.eventId?.trim();
  const code = input.eventCode?.trim().toLowerCase();
  const timestamp = Date.parse(input.occurredAt);
  if (!provider || !tracking || !eventId || !code || !Number.isFinite(timestamp)) {
    return { kind: 'invalid', reason: 'missing_or_invalid_fields' };
  }
  if (timestamp > Date.now() + 5 * 60_000) {
    return { kind: 'invalid', reason: 'future_event_timestamp' };
  }
  const eventKey = JSON.stringify([provider, tracking, eventId]);
  if (NON_DELIVERY_CODES.has(code)) {
    return { kind: 'non_delivery_scan', eventKey, reason: code, occurredAt: new Date(timestamp).toISOString() };
  }
  if (!FINAL_DELIVERY_CODES.has(code)) {
    return { kind: 'invalid', reason: 'unmapped_provider_event' };
  }
  if (!input.proofOfDeliveryReference?.trim()) {
    return { kind: 'invalid', reason: 'proof_of_delivery_reference_required' };
  }
  return {
    kind: 'verified_delivery_candidate', eventKey,
    reason: 'requires_provider_pod_validation_and_existing_payout_gate',
    occurredAt: new Date(timestamp).toISOString(),
  };
}

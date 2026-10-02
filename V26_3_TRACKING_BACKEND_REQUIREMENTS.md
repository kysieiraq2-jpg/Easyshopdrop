# V26-3 Tracking Backend Requirements

## Tracking resilience
1. Carrier webhook is preferred when supported. Verify signature and idempotency.
2. Normalize carrier event into Shop&Drop tracking event with shipment/order refs, carrier, external ref, status, occurred_at, source, source_reference, location and details.
3. If webhook is unavailable or stale beyond configured threshold, scheduled backend job polls carrier API.
4. If carrier API is unavailable, allow verified manual Admin/courier update with actor, reason, timestamp and audit entry.
5. Never let an unverified browser click create authoritative delivery/payout status.
6. Notify authorised Buyer/Seller/Admin when meaningful normalized status changes.

## Proof of Delivery
Persist protected POD linked to SD-SHP and SD-ORD:
- carrier/tracking reference
- delivered_at
- delivery result/location
- source and source reference
- optional recipient confirmation/signature/photo/provider POD reference/document
- verification status
- created/verified timestamps and audit actor
POD evidence is private/signed-access. Verified POD may establish Product delivery, begin inspection window and support payment-dispute evidence.

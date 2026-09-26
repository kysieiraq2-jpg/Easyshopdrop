# Version 18 — Order operations demo

Added admin-only read-only reporting endpoints for order/payment/shipment status, seller reconciliation preview, and refund review queue, plus /operations.html. No payment confirmations, refunds, payouts or courier bookings are performed. Existing demo checkout and provider planning are retained.

## Known limitations
- Reporting is based on unverified demo records, not payment-provider settlements.
- No actual refund processing or seller transfers.
- No live courier tracking integration.
- Admin must sign in on the storefront first.
- Docker/PostgreSQL end-to-end integration has not been tested in this build.

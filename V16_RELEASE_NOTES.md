# Version 16 — Checkout integration preparation

- Checkout preview checks saved-address ownership, stock and subtotal in ZAR cents.
- Order creation validates that the selected address belongs to the customer and stores an address snapshot.
- The checkout UI distinguishes the product subtotal from the unavailable final payable total.
- Payment adapter no longer returns a non-existent checkout URL.
- Courier adapter explicitly reports unavailable rates and refuses shipment creation.
- The generic demo payment webhook is disabled: it cannot mark orders paid.

**Not connected:** real payment processing, payment-provider webhook verification, delivery quotes, courier bookings, refunds, stock-reservation expiry or payouts. Do not use for real orders or expose this prototype publicly.

**Existing Docker database:** db/init.sql only runs on a fresh volume. For an existing development database, apply `db/v16_migration.sql` manually after backing up.

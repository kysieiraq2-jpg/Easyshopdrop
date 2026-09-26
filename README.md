# Shop&Drop — V20 - Worldwide Marketplace upgrade

A local development prototype, not a production or payment-ready marketplace.

## Start
1. Install Docker Desktop.
2. In this folder run `docker compose up --build`.
3. Open http://localhost:3000. Register a customer on the storefront.
4. Product catalogue starts empty; product creation requires a seller account and admin approval, for which an onboarding workflow is still required.

## Added
- Individual product detail pages and reviews display
- Persistent cart quantity controls
- Saved customer addresses and address selection UI
- Demo order creation and order confirmation
- Customer order history and order details with payment/shipment status
- Restored missing seller/admin endpoints from V12
- Removed broken demo account password hashes

## Not yet implemented
Payment gateway, courier rates, linking the selected delivery address to the order, shipping fees, seller onboarding, automated refunds, production-grade CSRF protection, stock release on abandoned checkout, real product image upload, seller payout processing. The V12 demonstration webhook must not be used for live payments. Do not deploy this prototype to the public internet or process customer money.


See V15_RELEASE_NOTES.md for image-upload instructions and limitations.


## V16
See V16_RELEASE_NOTES.md. Checkout saves the selected delivery address on demo orders, but no delivery rate or final payable total is calculated. No real payments or courier bookings are enabled.


## V17
Open `/integration-planning.html` to compare provider candidates and save a local planning preference. `/api/integrations/options` reports the providers as **not connected**. No real transactions are enabled.

## Version 18
Admin operations preview: visit /operations.html after signing in as an admin. See V18_RELEASE_NOTES.md. All financial and shipping features remain demo-only.


## Version 19
See `LAUNCH_GUIDE.md` and `V19_RELEASE_NOTES.md`. This remains a local-development prototype; do not accept real payments.

## V20 upgrade note
This package upgrades the existing Shop&Drop test deployment; it does not require a new domain or GitHub repository. Back up the current deployment/database first. For an existing V19 database, apply `db/v20_migration.sql` once. Real payments, courier APIs, FX rates, payouts and social posting remain disabled until providers are selected and securely integrated.

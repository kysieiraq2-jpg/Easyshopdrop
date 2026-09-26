# Shop&Drop V23 — Navigation & Preview Usability

V23 is a focused usability correction built on the V22 security baseline.

## Improvements
- Adds a protected-admin portal structure linking marketplace administration, order/delivery/financial operations and a dedicated Marketing & Promotion portal.
- Keeps administrator controls out of the public customer/seller homepage menu; live access requires authenticated admin authorization.
- Adds a mobile-friendly homepage menu for Home/Shop, Categories/Search, Bag/Checkout, Account & Orders, Sell Something, Seller Centre and Help.
- Search now gives immediate visible feedback in GitHub Pages preview mode.
- Account and Order pages show friendly preview messages instead of raw JSON/parser errors.
- Seller Centre no longer exposes raw backend errors on GitHub Pages.
- Seller product submission validates product name, category, selling price and stock before any API request.
- Store profile uses clearer automatic web-address wording and improved mobile layout.
- Checkout uses Preview wording, adds Country and State/Province/Region fields, and prepares the user flow for delivery quote, final payable total and payment method selection.
- Live payments, refunds, courier bookings and seller payouts remain disabled until approved providers and the production backend are connected and tested.

## Security
V23 retains the V21/V22 authentication, authorization, security-header, origin-check, rate-limit and payment-webhook protections. No raw card or CVV storage is introduced.

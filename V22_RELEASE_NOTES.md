# Shop&Drop V22 — Mobile UX & Preview-Safe Navigation

V22 incorporates the findings from hands-on mobile testing of V21 while preserving the V21 security and payment-ready architecture.

## Improvements
- Branding standardized to **Shop&Drop**.
- Added a root GitHub Pages entry that opens the marketplace under `public/`.
- Public-page navigation changed to relative links to prevent the GitHub Pages 404s found during V21 testing.
- Mobile marketplace header made more compact and responsive.
- Search responds to the Search button and keyboard Enter and gives understandable preview feedback.
- GitHub Pages is explicitly treated as a front-end preview; backend-dependent functions no longer need to be mistaken for live services.
- Seller wording changed to universal **Seller / business name**.
- Seller product price is entered as a normal currency amount instead of technical cents.
- Product photo selection remains camera/gallery compatible.
- Checkout clearly separates product subtotal, delivery quote, final payable total and payment-method readiness.
- Payment architecture remains provider-neutral. Raw PAN/card number and CVV storage remain prohibited.
- Live payments, refunds, courier bookings and automatic seller payouts remain OFF until certified providers, credentials, signed webhooks and settlement verification are configured.

## V21 mobile test findings carried into V22
- Fix home/account/checkout navigation paths.
- Improve mobile header spacing.
- Provide visible form validation instead of silent failure.
- Replace raw JSON/HTML parse errors with user-friendly service messages.
- Keep seller onboarding simple for individuals, makers, second-hand sellers and companies.
- Keep payout eligibility dependent on verified settlement and fulfilment/delivery evidence.

V22 remains a controlled testing build, not a claim of PCI certification or production authorization.

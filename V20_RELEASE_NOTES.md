# Shop&Drop V20 — Worldwide Marketplace Upgrade

V20 is an upgrade of the V19 controlled-test codebase for the existing Shop&Drop deployment.

## Included
- Worldwide Shop&Drop branding and mobile-first storefront.
- Public product APIs/pages no longer expose seller identity or direct seller contact details.
- Free seller onboarding for individuals, home makers, second-hand sellers and businesses.
- 10% commission accounting separated from seller proceeds; courier and payment-processing fees have separate order fields.
- Additive V20 database migration for dynamic categories/subcategories, specials, currency/ZAR conversion fields, services, platform feedback, shipment milestones and payout eligibility.
- Admin API for creating categories/subcategories and marking products as specials.
- Homepage areas for Specials, categories, new/featured products, Sell Something — FREE, and future Other Services.
- Buyer/seller platform feedback API and privacy-oriented verified-buyer review display.
- Tracking fields retained/extended for courier handover through delivery.
- Architecture placeholders for admin marketing/social channels.

## Intentionally NOT live yet
Real payment collection/splitting, seller payouts, live FX conversion, courier quoting/booking/tracking APIs, and automated social posting require approved external providers, credentials and webhook/API integration. V20 does not fake these capabilities.

## Existing database
For an existing V19 database, apply `db/v20_migration.sql` once before running V20. New databases should use `db/init.sql` plus `db/v20_migration.sql` until the schema is consolidated in a later release.

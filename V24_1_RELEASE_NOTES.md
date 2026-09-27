# Shop&Drop V24.1 — Final Major Marketplace Refinement

V24.1 is the final planned major feature/architecture update before Shop&Drop moves primarily into backend integration, realistic transaction testing, sandbox payments, courier/notification provider testing, security review and refinement.

## Operating model
- Shop&Drop is an automated intermediary marketplace, not a warehouse or inventory owner.
- External sellers/providers own and fulfil their products/services.
- Routine stock, order splitting, notifications, tracking, commission and payout eligibility are designed for automation.
- Administrator attention is exception-based: disputes, risk flags, failed payouts, prohibited listings and provider/integration failures.

## Configurable commission engine
- Commission is no longer architecturally hard-coded as a permanent flat 10%.
- Database rules support product/service/category and progressive value tiers.
- A 10% ordinary-transaction fallback remains only as the current testing baseline.
- Each order stores a commission snapshot for transparent reconciliation.
- Final rates will be chosen after real unit-economics testing of payment, payout, notification, refund/fraud, hosting and compliance costs.

## Marketplace protection and automation
- Added returns/refunds/disputes schema with evidence, return tracking and payout holds.
- Added risk/exception flags for administrator review.
- Added notification inbox API foundation.
- Added low-stock/sold-out support, dispatch-time and product-variation fields.
- Existing multi-seller fulfilment and multi-parcel tracking remain intact.

## Customer experience
- Homepage now clearly explains that Shop&Drop is local/worldwide and open to private individuals, home makers, second-hand sellers, businesses and service providers; no company/website required.
- Administrator Sign In restored to the homepage menu.
- My Account is prepared for Track Order, transaction-linked feedback, Tell a Friend and Returns & Disputes.
- Pet Supplies is a normal product category (Dogs, Cats, Birds, Reptiles, Fish & Aquarium, Other Pets), not a service category.

## Seller & service-provider experience
- Seller Centre wording expanded to Seller & Service Provider Centre.
- Service listing uses controlled categories, description, optional photo URL, minimum booking/units, service area and availability dates.
- Clearly priced services remain: Transport & Dispatch, Equipment Hire, Once-off Cleaning, Pest Control, Entertainment & Performers and Special Occasion Vehicles.
- Open-ended quote-heavy building/painting contractor work remains outside the initial service scope.

## Security / live-provider boundary
Live payment settlement, real seller bank payouts, courier bookings, outbound email/SMS/WhatsApp and partner-catalogue imports remain disabled until approved providers, credentials, webhooks and sandbox testing are completed. Raw card/CVV details must never be stored by Shop&Drop.

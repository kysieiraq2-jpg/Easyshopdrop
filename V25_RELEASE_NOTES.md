# Shop&Drop V25 — Transaction Orchestration & Trust Architecture

V25 prepares Shop&Drop for realistic transaction testing without enabling real money movement.

## Core references
- Every product/service listing can receive a permanent `LI-...` listing reference.
- Every buyer checkout receives one `SD-...` Shop&Drop Order reference.
- Each seller portion of a multi-seller order receives its own `ST-...` seller transaction reference, permanently linked to that seller.
- Each parcel receives an `SH-...` shipment reference. Courier waybill/tracking references are stored separately and mapped to the SH/ST/SD chain.

## Transparent marketplace service fee
- Current UI/business logic no longer assumes a permanent fixed 10% commission.
- Seller enters the amount they want to receive.
- Shop&Drop calculates the configurable marketplace service fee and final published customer price before listing confirmation.
- The old testing-only 10% default fee seed is retired by the V25 migration. Launch fee rules must be deliberately configured after unit-economics testing.
- Seller statements/ledgers retain seller target proceeds, Shop&Drop service fee, published amount and payout state.

## Payments and payouts
- Provider-neutral marketplace payment boundary supports one buyer checkout where possible, internal ST allocation, and automated seller payouts after eligibility.
- Provider registry includes Stitch, Payfast, FNB eCommerce research and optional PayPal; no provider is live by default.
- No raw card/PAN/CVV data is stored by Shop&Drop.
- Payouts remain held until fulfilment/delivery/dispute rules allow release.

## Courier model
- Buyer normally pays disclosed delivery.
- Seller owns, packs and physically dispatches the item.
- Buyer can choose among courier options that are seller-supported and destination-eligible.
- Seller-arranged courier/tracking is the fallback.
- Architecture is ready for integrated courier quotes, booking, waybill generation and automatic tracking feeds later.

## Automated communication
- In-site notifications are the core record, with provider-neutral email, WhatsApp Business and SMS channels prepared for later connection.
- Critical messages are triggered by verified payment/fulfilment/courier/payout events, not autonomous AI decisions.
- Admin is exception-based rather than a manual operator for routine transactions.

## Safety
This release is still a pre-production architecture. Real payment collection, seller payouts, courier bookings and outbound messaging remain disabled until approved providers, credentials, compliance and sandbox testing are complete.

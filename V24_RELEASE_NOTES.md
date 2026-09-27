# Shop&Drop V24 — Marketplace Engine & Services Architecture

V24 builds the data and workflow foundation beneath the V23.2 interface. It keeps live payment collection, courier booking and automatic payouts disabled until approved providers are connected.

## Catalogue & inventory
- Products remain linked to a unique seller ID and product ID; seller SKU support is added.
- Live stock/quantity is stored centrally and cart quantity is checked against approved available stock.
- Categories/subcategories remain database-driven and searchable.
- Customer/admin category requests are prepared for missing product/service categories.
- Authorized partner catalogues can be registered as manual, CSV, API or feed sources; arbitrary website scraping is not part of the design.

## Multi-seller checkout & fulfilment
- One buyer order can contain products from multiple sellers.
- V24 creates one fulfilment group per seller inside an order.
- Each seller group has its own gross value, Shop&Drop commission, seller proceeds and shipment record.
- This supports multiple seller notifications, couriers/tracking numbers and payouts under one buyer order.
- Seller notifications are queued when an order is created; provider adapters for email/SMS/WhatsApp remain to be connected.

## Payout privacy
- Seller payout profiles store provider references/status rather than exposing banking credentials publicly.
- Payout eligibility and actual payment remain separate events.
- Existing settlement/fulfilment verification controls remain in force.

## Services & Dispatching
A new clearly-priced Services marketplace foundation supports free provider listings and Shop&Drop-mediated bookings for defined once-off services, including:
- transport/dispatch and delivery vehicles;
- suitable heavy transport/equipment hire;
- once-off cleaning;
- pest control;
- DJs, bands, singers/musicians and performers;
- special-occasion vehicle hire.

Pricing units supported by the schema/API: per hour, day, kilometre, gig, event, job or treatment. Open-ended quotation-heavy building/painting contractor projects are intentionally outside the initial scope.

## Tracking, feedback & referrals
- Multi-seller fulfilment shipment records and shipment-event history are prepared.
- Customer tracking can aggregate several seller fulfilments under one order.
- Transaction feedback supports completed product/service transactions.
- Referral/share codes prepare the post-purchase “Tell a friend” flow.

## Admin & preview UI
- Homepage links to Services & Dispatching.
- Seller Centre includes a service-listing form with pricing-unit support.
- Services preview page explains categories, booking flow and category suggestions.
- Admin Control Centre links to Marketplace & Services Control.

## Still intentionally disabled
- Real card/payment settlement;
- automatic bank payouts;
- live courier bookings/rates;
- outbound email/SMS/WhatsApp sending;
- live partner-catalogue ingestion.

These require approved providers, credentials, webhooks, privacy/compliance checks and end-to-end testing before production activation.

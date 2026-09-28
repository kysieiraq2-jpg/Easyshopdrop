# Shop&Drop — V24.2 Marketplace Engine & Services

V24.1 is the next development baseline after V23.2. It combines the tested Shop&Drop mobile interface with the database/workflow architecture for inventory, multi-seller orders, fulfilment, seller notifications/payout controls and clearly-priced once-off Services & Dispatching.

## Core business model
- Registration/listing remains free.
- Shop&Drop marketplace service fee is configurable. A fee rules are configurable and will be finalized before real-money launch using unit-economics testing.
- Seller/provider direct contact and sensitive payout details are not publicly exposed.
- Buyers transact through Shop&Drop.

## V24.1 architecture
See `V24.1_RELEASE_NOTES.md` and `db/v24_migration.sql` and `db/v24_1_migration.sql`.

## Local start
1. Install Docker Desktop.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`.
4. Apply database migrations for an existing database before testing V24.1 backend functions.

## Important
GitHub Pages is a frontend preview only. Real accounts, database inventory, payments, courier integrations, notifications and payouts require the Node/PostgreSQL backend and approved external providers. Do not process real customer money until those integrations and security/compliance tests are complete.


## V24.2 master product taxonomy
Shop&Drop now includes a broad database-driven product taxonomy shared by seller listing, search and administration. The structure is Shop&Drop-owned and remains expandable through Admin/category requests.

## V25 transaction orchestration
V25 adds the LI/SD/ST/SH reference chain, transparent configurable Shop&Drop marketplace service fee, provider-neutral marketplace collection/payout model, buyer-selectable courier architecture and event-driven multi-channel notifications. Real money, courier bookings and outbound messaging remain disabled until sandbox/provider integration testing is complete.

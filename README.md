# Shop&Drop — V24 Marketplace Engine & Services

V24 is the next development baseline after V23.2. It combines the tested Shop&Drop mobile interface with the database/workflow architecture for inventory, multi-seller orders, fulfilment, seller notifications/payout controls and clearly-priced once-off Services & Dispatching.

## Core business model
- Registration/listing remains free.
- Shop&Drop default commission remains 10% on successfully completed marketplace transactions.
- Seller/provider direct contact and sensitive payout details are not publicly exposed.
- Buyers transact through Shop&Drop.

## V24 architecture
See `V24_RELEASE_NOTES.md` and `db/v24_migration.sql`.

## Local start
1. Install Docker Desktop.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`.
4. Apply database migrations for an existing database before testing V24 backend functions.

## Important
GitHub Pages is a frontend preview only. Real accounts, database inventory, payments, courier integrations, notifications and payouts require the Node/PostgreSQL backend and approved external providers. Do not process real customer money until those integrations and security/compliance tests are complete.

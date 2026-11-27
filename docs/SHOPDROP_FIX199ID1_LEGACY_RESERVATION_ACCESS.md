# Fix 199I-D1 — Legacy reservation access

Supabase migration 20261127135408; applied 27 November 2026.
Migration MD5: `8f46f977368e1a37ad45b5b042149b9c`.

- Removed anonymous and authenticated execution of obsolete single-product reserve/release functions; retained definitions and service-role grants.
- Verified that current order reservation, release, paid inventory commitment, checkout creation and expiry cleanup remain backend-accessible and customer-inaccessible.
- Verified authenticated access to the checkout countdown RPC.
- No frontend, transaction procedure, or provider configuration change.

This workflow records the already-applied migration. It does not run SQL. Permission tests passed; full browser and live-provider tests are not implied.

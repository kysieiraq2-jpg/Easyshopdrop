# Fix 199I-C1 — Payout profile protection

Applied to Supabase on 27 November 2026, migration 20261127133057.
Migration MD5: `3765427da343b803ef2049e35e61e21d`.

- Removed client insert, update and delete access to legacy payout profiles.
- Retained authenticated owner-only read access and trusted backend permissions.
- Verified owner privacy, blocked self-verification and preserved backend grants using rolled-back test records.
- No change to payout execution, frontend, Edge Functions or provider configuration.

The audit also identified a legacy create-payout function referencing seller_payout_profiles, which was not present in the queried public schema. Its compatibility with the selected provider-held settlement model remains to be audited before activation. No provider was activated or paid.

This installer records the already-applied migration; it does not execute SQL.

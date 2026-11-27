# Fix 199I-D2 — Permanent advertiser identity

Applied Supabase migration 20261127140425 on 27 November 2026.
Migration MD5: `2909dd5ef172d70a2e0322352977098a`.

- Customer write access to advertiser_public_number removed; existing number generation retained.
- Unique index verified. Existing three profiles had distinct positive numbers before migration.
- Authenticated profile and public alias editing tested successfully. Attempt to change advertiser number to DEFAULT rejected. Test changes rolled back.
- No website files, transaction procedures, or provider settings modified.

This installer records the already-applied migration only; it does not execute SQL. Full signed-in browser testing remains separate.

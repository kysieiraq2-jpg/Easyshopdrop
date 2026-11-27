# Fix 199I-B — Private integration records

Applied to Supabase on 27 November 2026, migration 20261127124459.
Migration MD5: `fc25434ffb6a4fdf0d7bff21d61e7579`.

- Public vehicle advertisement and photo views retain SELECT for anonymous and authenticated users; mutation grants removed.
- Internal events: authenticated users read their own supported case events only; active administrators retain read access.
- Integration logs and webhook records: active administrators only; anonymous access and ordinary client writes removed.
- Service-role grants retained. No changes to transaction procedures, Edge Functions, public pages or provider configuration.

Live database rollback tests passed: customer scope, administrator access and existing case RPC, anonymous/client mutation restrictions, public-view read grants, service-role access. Test records rolled back.

This workflow records the already applied SQL. It does not execute SQL, deploy functions, or activate any provider. Signed-in browser regression testing remains on the functional test checklist.

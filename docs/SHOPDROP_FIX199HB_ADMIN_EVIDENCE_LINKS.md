# Fix 199H-B — Administrator dispute evidence links

Read-only navigation and exact-case evidence filtering for physical products, Other Services and Transport. Existing general evidence list remains available without a case parameter. Support event identity is checked against the typed case and transaction identity. Missing or mismatched links fail closed. No payment, payout, PIN, courier, booking or customer code is changed.

Supabase migration already installed; this file synchronizes its exact bytes, not a re-run. Database tests passed for all three categories, wrong booking rejection, isolated evidence results, unknown cases, non-administrator and anonymous denial. Test fixtures rolled back. No real files uploaded. Signed-in browser testing remains on the functional checklist.

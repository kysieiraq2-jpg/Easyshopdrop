# Fix 199H-C — Transaction navigation

Extend the existing allowlisted authentication return helper to eleven transaction pages. Preserve order reference, booking ID, selected role and tracking reference using the existing validation. Add a visible sign-in link on tracking and order details. No checkout logic, payment code, PIN processing, database, provider configuration or administrator permissions changed.

Local tests cover legacy and new routes, malformed or duplicate parameters, external redirects and private pages. Workflow checks exact source hashes, exact patch anchors, syntax, immutable backups, protected files and the staged allowlist. Browser sign-in round trips remain on the functional checklist.

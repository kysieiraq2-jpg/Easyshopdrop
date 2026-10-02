# V26-5 Protected Form API Requirements
Routes:
- POST /api/support/change-requests
- POST /api/commerce/cancellations
- POST /api/support/dispute-evidence
- POST /api/support/feedback
- POST /api/payments/disputes
- POST /api/marketplace/listing-reports

All routes require server validation, auth/role checks where applicable, CSRF/origin protections as appropriate, rate limiting, audit timestamps, immutable reference generation, and idempotency where repeated submissions could cause side effects.
File evidence must use protected signed Storage upload; do not encode file bytes into JSON.
Until a route is connected, the UI must show connection pending and must not falsely claim success.

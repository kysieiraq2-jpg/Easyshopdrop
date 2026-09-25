# Version 19 — Launch preparation

- Preserved V18 customer, seller and order-management source.
- Added local-only Docker binding and environment-file template.
- Added `.dockerignore` and `.gitignore` to reduce accidental inclusion of secrets and backups.
- Added local PostgreSQL backup and guarded restore scripts.
- Added Node built-in tests for password hashing, session token generation, HMAC helper and disabled live-payment callback.
- Added controlled-test and deployment guide.

**Not implemented:** real payment/courier connections, automatic production migrations, public HTTPS hosting, email verification, production account recovery, full end-to-end tests, or security audit.

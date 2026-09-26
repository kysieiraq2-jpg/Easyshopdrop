# Shop&Drop V21 — Security & Payment-Ready Upgrade

V21 builds on the verified V20 worldwide marketplace baseline. It hardens the application before temporary-site testing and prepares clean integration boundaries for future certified payment/courier providers.

## Security hardening
- Security headers (CSP, frame denial, MIME sniff protection, referrer and permissions policy; HSTS in production).
- Secure session cookie flag in production; session tokens remain random and only hashed tokens are stored in PostgreSQL.
- Same-origin protection for state-changing requests when `PUBLIC_ORIGIN` is configured.
- Request-body size limit and safer generic server errors.
- Registration/login throttling and stronger 12+ character password policy.
- Existing scrypt password hashing, role checks, ownership checks, parameterized SQL and audit logging retained.

## Payments and fraud controls
- Live payment collection, refunds, courier booking and automatic seller payouts remain OFF by default.
- Provider registry documents supported future payment-method categories without enabling them.
- Raw card number/PAN and CVV storage is explicitly prohibited by the integration boundary.
- Payment provider tokenization and signed webhooks are required before live activation.
- Webhook endpoint now contains signature-verification scaffolding but does not execute settlement.
- Database adds provider-event idempotency, settlement verification, risk status and payout verification/hold fields.
- Seller payout policy requires verified settlement plus verified fulfilment/delivery before release.

## Testing status
V21 is intended for controlled temporary-site testing. It is not a claim of PCI certification, penetration-test completion, or production authorization. Real provider credentials must never be committed to GitHub.

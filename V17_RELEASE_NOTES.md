# Version 17 — Provider-neutral planning

- Preserves the Version 16 checkout prototype and its disabled live payment webhook.
- Adds GET /api/integrations/options, a read-only catalogue of candidate providers and explicit disabled capability flags.
- Adds /integration-planning.html, a mobile-friendly preference screen. Preferences are stored only in this browser, not sent to providers or used for real transactions.
- Adds an integration acceptance checklist.

No provider API, real payment, courier booking, automatic payout or final delivery quote is implemented.

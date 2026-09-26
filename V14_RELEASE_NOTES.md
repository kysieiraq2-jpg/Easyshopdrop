# Version 14 — Seller management demo

Added customer-to-seller application, admin approval via existing admin API, seller-owned product editing with renewed approval, stock and price updates, and HTTPS image URL validation. New page: `/seller-apply.html`.

**Limitations:** image URLs are external links, not uploaded files. No real merchant payments, courier accounts, identity checks, seller payouts, or production security certification. Existing payment webhook is a demo-only placeholder and must not be used for live money.

To start locally, follow README.md. The project requires Docker and PostgreSQL. Existing database volumes may require migrations rather than rerunning init.sql.

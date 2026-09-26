# Version 15 — Seller photos and dashboard

- Approved sellers can upload JPEG, PNG or WebP product images up to 2 MB from the seller page.
- Uploaded images are stored in `public/uploads` locally, with generated random filenames.
- Uploaded image paths can be used when submitting products.
- Seller dashboard shows total/approved/pending products, orders, stock units and gross order-item value.
- Admin-only integration status endpoint shows demo payment, shipping and image-storage state.

## Important limitations
- This is a development prototype, not a live payment or courier integration.
- Local uploads are not durable in the included Docker setup and are not production image processing.
- Uploaded files require production malware/content checks, re-encoding, object storage, quotas and moderation.
- The existing demo payment webhook must NOT be exposed as a real provider endpoint.
- Earlier versions' seeded demo passwords and other security controls require verification and remediation before any public deployment.

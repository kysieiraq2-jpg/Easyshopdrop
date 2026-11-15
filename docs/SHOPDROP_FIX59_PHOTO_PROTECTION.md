# Fix59 — automatic selective image screening (STAGED, NOT LIVE)

Website selects images for more expensive analysis automatically.
- All new images: file validation and baseline OCR text check.
- Obvious contact details, websites, promotional text: immediate rejection.
- Ambiguous, short or low-confidence writing: advanced document OCR and logo detection.
- Clearly clean images: skip advanced request and save money.
- Every image needs an independent QR/barcode check before publication.
- Scanner failure, unrecognized text or barcode unavailable: hold private.
- No routine administrator approval. Sellers replace rejected photographs.

This is code preparation only. It does NOT scan real live uploads.
Do not deploy or set SHOPDROP_PHOTO_SCANNING_ENABLED=true yet.
Existing product photos, Supabase public bucket and user pages are unchanged.

Required later as one coordinated activation:
1. Choose OCR provider, verify fees and obtain consent/privacy notices.
2. Add a secure, private staging-bucket upload for every product/service/dispatch image.
3. Remove unverified external service_photo_url links.
4. Add QR/barcode detection for every image (not optional or AI-selected).
5. Add backend-only, scan-verified promotion from private to public storage.
6. Enforce moderation on new and changed listings, including service auto-approval.
7. Add retries, quota limits, billing alerts, deduplication with verified hashes,
   and regression tests for changed, rotated and obscured contact details.
8. Test all divisions without altering legacy approved photos.
9. Only then turn on screening; leave payments disabled.

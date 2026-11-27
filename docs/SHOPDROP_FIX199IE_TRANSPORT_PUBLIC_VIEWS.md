# Fix 199I-E — Transport public views

Applied migration 20261127144727 in Supabase. SHA256: 9d49355cc7c7f54b0c30927fbde60024fa475aad1c01d8b88d32f41621c2d88f.
Rollback assertions passed for anonymous, authenticated non-owner and owner access to published and draft advert/photo metadata. Both views verified as security invoker and security barrier after installation. Private storage bucket retained. No test records remain. No frontend, payment or publication trigger changes. Actual photo download and browser tests remain outstanding. This workflow records SQL only; it does not execute SQL.

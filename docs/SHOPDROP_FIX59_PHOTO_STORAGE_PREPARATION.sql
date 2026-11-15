-- FOR FUTURE REVIEW ONLY. DO NOT RUN BEFORE FULL ACTIVATION DESIGN.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('shopdrop-photo-pending','shopdrop-photo-pending',false,10485760,
   ARRAY['image/jpeg','image/png','image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shopdrop_photo_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  storage_bucket text NOT NULL CHECK (storage_bucket='shopdrop-photo-pending'),
  storage_path text NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('product','service','dispatch')),
  scan_decision text NOT NULL CHECK (scan_decision IN ('reject','pending_barcode')),
  reason_code text NOT NULL,
  policy_version text NOT NULL,
  advanced_used boolean NOT NULL DEFAULT false,
  barcode_verified boolean NOT NULL DEFAULT false,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket,storage_path)
);
ALTER TABLE public.shopdrop_photo_scan_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopdrop_photo_scan_results FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.shopdrop_photo_scan_results TO service_role;
-- No publication permission, no public read access, no user upload policy.

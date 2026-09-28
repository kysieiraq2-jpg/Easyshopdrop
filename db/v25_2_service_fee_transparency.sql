-- Shop&Drop V25.2 - service pricing transparency
-- Keeps provider target proceeds, Shop&Drop fee, and published customer rate separately auditable.
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS seller_target_unit_cents INTEGER;
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS shopdrop_service_fee_unit_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS published_unit_price_cents INTEGER;
UPDATE service_listings SET seller_target_unit_cents=COALESCE(seller_target_unit_cents,unit_price_cents), published_unit_price_cents=COALESCE(published_unit_price_cents,unit_price_cents) WHERE seller_target_unit_cents IS NULL OR published_unit_price_cents IS NULL;
ALTER TABLE service_listings ADD CONSTRAINT service_target_unit_nonnegative CHECK (seller_target_unit_cents IS NULL OR seller_target_unit_cents>=0);
ALTER TABLE service_listings ADD CONSTRAINT service_fee_unit_nonnegative CHECK (shopdrop_service_fee_unit_cents>=0);
ALTER TABLE service_listings ADD CONSTRAINT service_published_unit_nonnegative CHECK (published_unit_price_cents IS NULL OR published_unit_price_cents>=0);

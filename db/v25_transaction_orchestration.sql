-- Shop&Drop V25 transaction orchestration.
-- One buyer checkout (SD order) can contain multiple seller transactions (ST), shipments and provider references.
CREATE SEQUENCE IF NOT EXISTS shopdrop_listing_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS shopdrop_order_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS shopdrop_seller_tx_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS shopdrop_shipment_seq START 1000;

ALTER TABLE products ADD COLUMN IF NOT EXISTS listing_ref TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sd_order_ref TEXT UNIQUE;
ALTER TABLE fulfilment_groups ADD COLUMN IF NOT EXISTS st_ref TEXT UNIQUE;
ALTER TABLE fulfilment_shipments ADD COLUMN IF NOT EXISTS shipment_ref TEXT UNIQUE;
ALTER TABLE fulfilment_shipments ADD COLUMN IF NOT EXISTS selected_service_code TEXT;
ALTER TABLE fulfilment_shipments ADD COLUMN IF NOT EXISTS delivery_fee_cents INTEGER CHECK(delivery_fee_cents IS NULL OR delivery_fee_cents>=0);
ALTER TABLE fulfilment_shipments ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE fulfilment_shipments ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'seller_arranged' CHECK(booking_mode IN ('seller_arranged','integrated'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_target_cents INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopdrop_service_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS published_price_cents INTEGER;
UPDATE products SET seller_target_cents=COALESCE(seller_target_cents,price_cents),published_price_cents=COALESCE(published_price_cents,price_cents) WHERE seller_target_cents IS NULL OR published_price_cents IS NULL;

ALTER TABLE fulfilment_groups ADD COLUMN IF NOT EXISTS shopdrop_service_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fulfilment_groups ADD COLUMN IF NOT EXISTS seller_target_proceeds_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_provider_transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 sd_order_ref TEXT NOT NULL, provider TEXT NOT NULL, provider_transaction_ref TEXT,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>=0), currency_code TEXT NOT NULL DEFAULT 'ZAR',
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','confirmed','failed','refunded','partially_refunded')),
 raw_card_data_stored BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_provider_tx_order_idx ON payment_provider_transactions(order_id,status);

CREATE TABLE IF NOT EXISTS seller_transaction_ledger (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fulfilment_group_id UUID NOT NULL REFERENCES fulfilment_groups(id) ON DELETE CASCADE,
 st_ref TEXT NOT NULL, seller_id UUID NOT NULL REFERENCES users(id), seller_target_cents BIGINT NOT NULL,
 shopdrop_service_fee_cents BIGINT NOT NULL, published_product_cents BIGINT NOT NULL,
 delivery_fee_cents BIGINT NOT NULL DEFAULT 0, payout_status TEXT NOT NULL DEFAULT 'held' CHECK(payout_status IN ('held','eligible','queued','paid','failed','cancelled')),
 payout_provider TEXT, payout_provider_ref TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(fulfilment_group_id)
);

CREATE TABLE IF NOT EXISTS courier_options (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fulfilment_group_id UUID NOT NULL REFERENCES fulfilment_groups(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, service_code TEXT NOT NULL, service_name TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents>=0),
 estimated_days_min INTEGER, estimated_days_max INTEGER, seller_supported BOOLEAN NOT NULL DEFAULT true, destination_eligible BOOLEAN NOT NULL DEFAULT true,
 quote_expires_at TIMESTAMPTZ, UNIQUE(fulfilment_group_id,provider,service_code)
);

CREATE TABLE IF NOT EXISTS notification_delivery_log (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 provider TEXT NOT NULL DEFAULT 'unconfigured', provider_message_ref TEXT, delivery_status TEXT NOT NULL DEFAULT 'queued',
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(), delivered_at TIMESTAMPTZ, error_code TEXT, error_message TEXT
);

CREATE TABLE IF NOT EXISTS transaction_exceptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
 fulfilment_group_id UUID REFERENCES fulfilment_groups(id) ON DELETE CASCADE, exception_type TEXT NOT NULL,
 severity TEXT NOT NULL DEFAULT 'review' CHECK(severity IN ('info','review','urgent')), status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved')),
 details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
-- Retire the old testing-only fixed 10% seed. Launch fee rules must be deliberately configured after unit-economics testing.
UPDATE commission_rules SET active=false,updated_at=now()
WHERE transaction_type='all' AND category_id IS NULL AND threshold_from_cents=0 AND threshold_to_cents IS NULL AND rate_basis_points=1000 AND priority=100;

-- Shop&Drop V25.3: dedicated dispatching workflow and automatic completion protection window.
CREATE SEQUENCE IF NOT EXISTS shopdrop_dispatch_seq START 1;
CREATE TABLE IF NOT EXISTS dispatch_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_ref TEXT UNIQUE NOT NULL DEFAULT ('DR-'||to_char(now(),'YYYY')||'-'||lpad(nextval('shopdrop_dispatch_seq')::text,8,'0')),
 customer_id UUID NOT NULL REFERENCES users(id),
 vehicle_type TEXT NOT NULL,
 pickup_area TEXT NOT NULL,
 dropoff_area TEXT NOT NULL,
 required_at TIMESTAMPTZ,
 load_description TEXT NOT NULL,
 approximate_weight TEXT,
 approximate_size TEXT,
 special_requirements TEXT,
 status TEXT NOT NULL DEFAULT 'open',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dispatch_offers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dispatch_request_id UUID NOT NULL REFERENCES dispatch_requests(id) ON DELETE CASCADE,
 provider_id UUID NOT NULL REFERENCES users(id), seller_target_cents INTEGER NOT NULL CHECK(seller_target_cents>0),
 shopdrop_service_fee_cents INTEGER NOT NULL CHECK(shopdrop_service_fee_cents>=0), published_price_cents INTEGER NOT NULL CHECK(published_price_cents>0),
 currency_code TEXT NOT NULL DEFAULT 'ZAR', status TEXT NOT NULL DEFAULT 'offered', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE fulfilment_groups ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;
ALTER TABLE fulfilment_groups ADD COLUMN IF NOT EXISTS protection_deadline TIMESTAMPTZ;
ALTER TABLE fulfilment_groups ADD COLUMN IF NOT EXISTS completion_source TEXT;
CREATE INDEX IF NOT EXISTS dispatch_requests_customer_idx ON dispatch_requests(customer_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS dispatch_offers_request_idx ON dispatch_offers(dispatch_request_id,status,created_at DESC);

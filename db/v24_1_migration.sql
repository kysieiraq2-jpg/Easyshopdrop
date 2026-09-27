-- Shop&Drop V24.1 final major marketplace refinement.
-- Automation-first: Shop&Drop owns no seller stock and assumes no warehouse/office fulfilment team.
CREATE TABLE IF NOT EXISTS commission_rules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transaction_type TEXT NOT NULL DEFAULT 'all' CHECK(transaction_type IN ('all','product','service')),
 category_id UUID REFERENCES categories(id) ON DELETE SET NULL, threshold_from_cents BIGINT NOT NULL DEFAULT 0 CHECK(threshold_from_cents>=0),
 threshold_to_cents BIGINT CHECK(threshold_to_cents IS NULL OR threshold_to_cents>threshold_from_cents), rate_basis_points INTEGER NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 active BOOLEAN NOT NULL DEFAULT true, priority INTEGER NOT NULL DEFAULT 100, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS commission_rules_lookup_idx ON commission_rules(active,transaction_type,category_id,priority,threshold_from_cents);
INSERT INTO commission_rules(transaction_type,threshold_from_cents,threshold_to_cents,rate_basis_points,priority)
SELECT 'all',0,NULL,1000,100 WHERE NOT EXISTS(SELECT 1 FROM commission_rules);
CREATE TABLE IF NOT EXISTS commission_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES orders(id) ON DELETE CASCADE, service_booking_id UUID REFERENCES service_bookings(id) ON DELETE CASCADE,
 gross_cents BIGINT NOT NULL, commission_cents BIGINT NOT NULL, effective_basis_points INTEGER NOT NULL, rules_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(order_id IS NOT NULL OR service_booking_id IS NOT NULL));
ALTER TABLE products ADD COLUMN IF NOT EXISTS dispatch_days_min INTEGER NOT NULL DEFAULT 1 CHECK(dispatch_days_min>=0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dispatch_days_max INTEGER NOT NULL DEFAULT 2 CHECK(dispatch_days_max>=dispatch_days_min);
ALTER TABLE products ADD COLUMN IF NOT EXISTS variation_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out_at TIMESTAMPTZ;
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS return_disputes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
 opened_by UUID NOT NULL REFERENCES users(id), reason TEXT NOT NULL CHECK(reason IN ('not_received','damaged','wrong_item','not_as_described','cancelled','service_issue','other')),
 description TEXT NOT NULL DEFAULT '', evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','seller_response','admin_review','return_in_transit','resolved_refund','resolved_no_refund','closed')),
 payout_hold BOOLEAN NOT NULL DEFAULT true, resolution TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS return_disputes_queue_idx ON return_disputes(status,created_at);
CREATE TABLE IF NOT EXISTS return_shipments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dispute_id UUID NOT NULL REFERENCES return_disputes(id) ON DELETE CASCADE, provider TEXT, tracking_number TEXT, status TEXT NOT NULL DEFAULT 'not_created', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS risk_flags (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE SET NULL, order_id UUID REFERENCES orders(id) ON DELETE CASCADE, seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
 flag_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'review' CHECK(severity IN ('info','review','high')), details JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','cleared','actioned')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS risk_flags_open_idx ON risk_flags(status,severity,created_at);
CREATE TABLE IF NOT EXISTS recently_viewed (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,product_id));
-- Pet Supplies is a product category, not a service category.
INSERT INTO categories(name,slug,sort_order) SELECT 'Pet Supplies','pet-supplies',80 WHERE NOT EXISTS(SELECT 1 FROM categories WHERE slug='pet-supplies');
INSERT INTO categories(name,slug,parent_id,sort_order)
SELECT x.name,x.slug,p.id,x.sort_order FROM (VALUES ('Dogs','pet-supplies-dogs',1),('Cats','pet-supplies-cats',2),('Birds','pet-supplies-birds',3),('Reptiles','pet-supplies-reptiles',4),('Fish & Aquarium','pet-supplies-fish-aquarium',5),('Other Pets','pet-supplies-other',6)) AS x(name,slug,sort_order) CROSS JOIN categories p
WHERE p.slug='pet-supplies' AND NOT EXISTS(SELECT 1 FROM categories c WHERE c.slug=x.slug);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','seller','admin')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seller_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'demo',
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','pending','paid','failed','refunded')),
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'not_created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  gross_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  net_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','held')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_status_category_idx ON products(status, category);
CREATE INDEX products_seller_idx ON products(seller_id);
CREATE INDEX orders_customer_idx ON orders(customer_id);
CREATE INDEX order_items_seller_idx ON order_items(seller_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

-- No default credentials are installed. Register a customer through the storefront.

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT DEFAULT '',
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK(quantity>0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,product_id)
);

CREATE TABLE wishlists (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,product_id)
);

CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id,customer_id)
);

ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT '';

-- V16: immutable delivery-address snapshot attached to each demo order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address_snapshot JSONB;
-- Shop&Drop V20 worldwide marketplace upgrade (safe additive migration)
CREATE TABLE IF NOT EXISTS categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
 name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS services (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID REFERENCES categories(id), title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_feedback (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), order_id UUID REFERENCES orders(id),
 audience TEXT NOT NULL CHECK(audience IN ('buyer','seller')), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 topic TEXT NOT NULL DEFAULT 'overall', comments TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing_channels (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, platform TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT false,
 configuration JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS seller_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '';
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'new';
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'ZAR';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_zar_cents INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fx_rate_to_zar NUMERIC(18,8);
ALTER TABLE products ADD COLUMN IF NOT EXISTS fx_updated_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS special_price_cents INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS special_starts_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS special_ends_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_scope TEXT NOT NULL DEFAULT 'national';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_subtotal_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_processing_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopdrop_commission_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_proceeds_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'ZAR';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS handed_to_courier_at TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE seller_payouts ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ;
-- Shop&Drop V21 security/financial-control migration (additive and safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS settlement_verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS risk_status TEXT NOT NULL DEFAULT 'unreviewed';
ALTER TABLE seller_payouts ADD COLUMN IF NOT EXISTS settlement_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE seller_payouts ADD COLUMN IF NOT EXISTS fulfilment_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE seller_payouts ADD COLUMN IF NOT EXISTS hold_reason TEXT DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_event_unique ON payments(provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS security_events (
 id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 event_type TEXT NOT NULL, ip_hash TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at DESC);
-- V21 policy: payout eligibility requires verified provider settlement AND verified fulfilment/delivery.
-- Shop&Drop V24 marketplace architecture: inventory, multi-seller fulfilment, services and notifications.
-- Additive migration; live payment/courier/provider actions remain disabled until certified integrations are connected.

ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS products_seller_sku_unique ON products(seller_id,seller_sku) WHERE seller_sku IS NOT NULL AND seller_sku<>'';

CREATE TABLE IF NOT EXISTS seller_payout_profiles (
 seller_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 provider TEXT NOT NULL DEFAULT 'unconfigured', provider_account_ref TEXT,
 status TEXT NOT NULL DEFAULT 'unconfigured' CHECK(status IN ('unconfigured','pending','verified','suspended')),
 last4 TEXT, country_code TEXT DEFAULT '', currency_code TEXT DEFAULT 'ZAR', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fulfilment_groups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 seller_id UUID NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'awaiting_payment',
 gross_cents INTEGER NOT NULL DEFAULT 0, commission_cents INTEGER NOT NULL DEFAULT 0, seller_proceeds_cents INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(order_id,seller_id)
);
CREATE INDEX IF NOT EXISTS fulfilment_groups_seller_idx ON fulfilment_groups(seller_id,status);

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS fulfilment_group_id UUID REFERENCES fulfilment_groups(id) ON DELETE CASCADE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES users(id);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS courier_reference TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS origin_snapshot JSONB;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS destination_snapshot JSONB;

CREATE TABLE IF NOT EXISTS shipment_events (
 id BIGSERIAL PRIMARY KEY, shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
 status TEXT NOT NULL, description TEXT DEFAULT '', event_at TIMESTAMPTZ NOT NULL DEFAULT now(), source TEXT NOT NULL DEFAULT 'shopdrop'
);
CREATE INDEX IF NOT EXISTS shipment_events_shipment_idx ON shipment_events(shipment_id,event_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 email_enabled BOOLEAN NOT NULL DEFAULT true, sms_enabled BOOLEAN NOT NULL DEFAULT false, whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
 phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 order_id UUID REFERENCES orders(id) ON DELETE CASCADE, fulfilment_group_id UUID REFERENCES fulfilment_groups(id) ON DELETE CASCADE,
 channel TEXT NOT NULL CHECK(channel IN ('in_app','email','sms','whatsapp')), template_key TEXT NOT NULL,
 payload JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS category_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 requested_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','added','declined')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_catalogues (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), seller_id UUID NOT NULL REFERENCES users(id), name TEXT NOT NULL,
 source_type TEXT NOT NULL CHECK(source_type IN ('manual','csv','api','feed')), source_reference TEXT,
 authorization_confirmed BOOLEAN NOT NULL DEFAULT false, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','suspended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_listings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider_id UUID NOT NULL REFERENCES users(id), category_id UUID REFERENCES categories(id),
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', pricing_unit TEXT NOT NULL CHECK(pricing_unit IN ('hour','day','kilometre','gig','event','job','treatment')),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), currency_code TEXT NOT NULL DEFAULT 'ZAR', minimum_units NUMERIC(10,2) NOT NULL DEFAULT 1,
 service_area TEXT NOT NULL DEFAULT '', country_code TEXT NOT NULL DEFAULT '', image_url TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','inactive')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_listings_search_idx ON service_listings(status,category_id,pricing_unit);

CREATE TABLE IF NOT EXISTS service_availability (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_id UUID NOT NULL REFERENCES service_listings(id) ON DELETE CASCADE,
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','held','booked','blocked')),
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS service_availability_service_idx ON service_availability(service_id,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS service_bookings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_id UUID NOT NULL REFERENCES service_listings(id), customer_id UUID NOT NULL REFERENCES users(id),
 provider_id UUID NOT NULL REFERENCES users(id), starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ,
 units NUMERIC(10,2) NOT NULL CHECK(units>0), unit_price_cents INTEGER NOT NULL, subtotal_cents INTEGER NOT NULL,
 shopdrop_commission_cents INTEGER NOT NULL, provider_proceeds_cents INTEGER NOT NULL,
 service_location_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','accepted','dispatched','in_progress','completed','cancelled','refunded')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_bookings_customer_idx ON service_bookings(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS service_bookings_provider_idx ON service_bookings(provider_id,status,starts_at);

CREATE TABLE IF NOT EXISTS transaction_feedback (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
 service_booking_id UUID REFERENCES service_bookings(id) ON DELETE CASCADE, reviewer_id UUID NOT NULL REFERENCES users(id), subject_user_id UUID REFERENCES users(id),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comments TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(order_id IS NOT NULL OR service_booking_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS referrals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), referrer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 order_id UUID REFERENCES orders(id) ON DELETE SET NULL, referral_code TEXT NOT NULL UNIQUE, channel TEXT NOT NULL DEFAULT 'share', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fulfilment_shipments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fulfilment_group_id UUID NOT NULL REFERENCES fulfilment_groups(id) ON DELETE CASCADE,
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, seller_id UUID NOT NULL REFERENCES users(id),
 provider TEXT, tracking_number TEXT, courier_reference TEXT, status TEXT NOT NULL DEFAULT 'not_created',
 handed_to_courier_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fulfilment_shipments_order_idx ON fulfilment_shipments(order_id,seller_id);

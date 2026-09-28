-- Shop&Drop V25.6 account foundation. Additive and backward-compatible.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS user_capabilities (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 capability TEXT NOT NULL CHECK(capability IN ('buyer','seller','service_provider','dispatch_customer','admin')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','suspended','rejected')),
 approved_at TIMESTAMPTZ, approved_by UUID REFERENCES users(id), PRIMARY KEY(user_id,capability)
);
INSERT INTO user_capabilities(user_id,capability,status,approved_at) SELECT id,'buyer','active',now() FROM users ON CONFLICT DO NOTHING;
INSERT INTO user_capabilities(user_id,capability,status,approved_at) SELECT id,'seller',CASE WHEN EXISTS(SELECT 1 FROM seller_profiles sp WHERE sp.user_id=users.id AND sp.status='approved') THEN 'active' ELSE 'pending' END,CASE WHEN EXISTS(SELECT 1 FROM seller_profiles sp WHERE sp.user_id=users.id AND sp.status='approved') THEN now() ELSE NULL END FROM users WHERE role='seller' ON CONFLICT DO NOTHING;
INSERT INTO user_capabilities(user_id,capability,status,approved_at) SELECT id,'admin','active',now() FROM users WHERE role='admin' ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS platform_ledger_entries (
 id BIGSERIAL PRIMARY KEY, order_id UUID REFERENCES orders(id), seller_id UUID REFERENCES users(id),
 entry_type TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency_code TEXT NOT NULL DEFAULT 'ZAR',
 reference TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_ledger_order_idx ON platform_ledger_entries(order_id);

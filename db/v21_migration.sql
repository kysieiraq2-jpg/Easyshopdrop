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


-- Shop&Drop: Shared provider release ledger.
-- Additive only. No existing functions replaced.
-- No live payment or payout activation.

CREATE TABLE IF NOT EXISTS
public.shopdrop_arrival_provider_release_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  booking_type text NOT NULL
    CHECK (booking_type IN ('service', 'dispatch')),

  booking_id uuid NOT NULL,
  provider_id uuid NOT NULL
    REFERENCES auth.users(id),

  payment_id uuid NOT NULL,

  currency text NOT NULL
    CHECK (currency ~ '^[A-Z]{3}$'),

  provider_amount numeric(18,2) NOT NULL
    CHECK (provider_amount > 0),

  release_status text NOT NULL
    DEFAULT 'awaiting_safeguards'
    CHECK (
      release_status IN (
        'awaiting_safeguards',
        'eligible',
        'processing',
        'submitted',
        'confirmed',
        'held',
        'failed',
        'reconciliation_required'
      )
    ),

  provider_code text,
  provider_release_reference text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shopdrop_arrival_release_once
    UNIQUE (booking_type, booking_id),

  CONSTRAINT shopdrop_arrival_payment_once
    UNIQUE (booking_type, payment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS
shopdrop_arrival_provider_release_reference_unique
ON public.shopdrop_arrival_provider_release_ledger
(provider_code, provider_release_reference)
WHERE provider_code IS NOT NULL
  AND provider_release_reference IS NOT NULL;

ALTER TABLE
public.shopdrop_arrival_provider_release_ledger
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
public.shopdrop_arrival_provider_release_ledger
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE
public.shopdrop_arrival_provider_release_ledger
TO service_role;

COMMENT ON TABLE
public.shopdrop_arrival_provider_release_ledger
IS
'Provider-neutral arrival release ledger. Service and dispatch only. No funds move through this table.';


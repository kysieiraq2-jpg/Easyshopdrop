

-- Shop&Drop: Dispatch payout safety holds.
-- Additive only. Existing functions preserved.
-- No live payment or payout activation.

CREATE TABLE IF NOT EXISTS
public.shopdrop_dispatch_payout_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  booking_id uuid NOT NULL
    REFERENCES public.dispatch_bookings(id),

  provider_id uuid NOT NULL
    REFERENCES auth.users(id),

  hold_reason text NOT NULL
    CHECK (
      length(trim(hold_reason)) BETWEEN 3 AND 500
    ),

  hold_status text NOT NULL DEFAULT 'active'
    CHECK (hold_status IN ('active', 'released')),

  held_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shopdrop_dispatch_hold_dates_check
    CHECK (
      (hold_status = 'active'
        AND released_at IS NULL)
      OR
      (hold_status = 'released'
        AND released_at IS NOT NULL)
    ),

  CONSTRAINT shopdrop_dispatch_hold_identity_unique
    UNIQUE (id, booking_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS
shopdrop_dispatch_one_active_payout_hold
ON public.shopdrop_dispatch_payout_holds (booking_id)
WHERE hold_status = 'active';

CREATE INDEX IF NOT EXISTS
shopdrop_dispatch_payout_holds_provider_idx
ON public.shopdrop_dispatch_payout_holds
(provider_id, booking_id);

ALTER TABLE
public.shopdrop_dispatch_payout_holds
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
public.shopdrop_dispatch_payout_holds
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.shopdrop_dispatch_payout_holds
TO service_role;

COMMENT ON TABLE
public.shopdrop_dispatch_payout_holds
IS
'Dispatch payout holds for fraud, disputes and exceptions. Backend-only. No money movement.';

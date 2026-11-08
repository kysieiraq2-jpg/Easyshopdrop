
-- Shop&Drop: Other Services scheduling agreement.
-- Customer requests date and arrival time.
-- Provider may accept, decline or propose another.
-- Customer must accept any alternative.
-- No payments or payouts activated.
-- Existing service bookings preserved.

CREATE TABLE IF NOT EXISTS
public.shopdrop_service_schedule_agreements (
  booking_id uuid PRIMARY KEY
    REFERENCES public.service_bookings(id)
    ON DELETE CASCADE,

  customer_id uuid NOT NULL
    REFERENCES auth.users(id),

  provider_id uuid NOT NULL
    REFERENCES auth.users(id),

  requested_date date NOT NULL,
  requested_arrival_time time NOT NULL,

  proposed_date date,
  proposed_arrival_time time,

  confirmed_date date,
  confirmed_arrival_time time,

  agreement_status text NOT NULL
    DEFAULT 'awaiting_provider'
    CHECK (agreement_status IN (
      'awaiting_provider',
      'alternative_proposed',
      'confirmed',
      'declined',
      'cancelled'
    )),

  proposed_at timestamptz,
  confirmed_at timestamptz,

  created_at timestamptz NOT NULL
    DEFAULT now(),

  updated_at timestamptz NOT NULL
    DEFAULT now(),

  CONSTRAINT service_schedule_distinct_parties
    CHECK (customer_id <> provider_id),

  CONSTRAINT service_schedule_proposal_pair
    CHECK (
      (proposed_date IS NULL) =
      (proposed_arrival_time IS NULL)
    ),

  CONSTRAINT service_schedule_confirmation_pair
    CHECK (
      (confirmed_date IS NULL) =
      (confirmed_arrival_time IS NULL)
    ),

  CONSTRAINT service_schedule_confirmed_values
    CHECK (
      agreement_status <> 'confirmed'
      OR (
        confirmed_date IS NOT NULL
        AND confirmed_arrival_time IS NOT NULL
        AND confirmed_at IS NOT NULL
      )
    ),

  CONSTRAINT service_schedule_alternative_values
    CHECK (
      agreement_status <> 'alternative_proposed'
      OR (
        proposed_date IS NOT NULL
        AND proposed_arrival_time IS NOT NULL
        AND proposed_at IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS
shopdrop_service_schedule_provider_idx
ON public.shopdrop_service_schedule_agreements
(provider_id, agreement_status);

CREATE INDEX IF NOT EXISTS
shopdrop_service_schedule_customer_idx
ON public.shopdrop_service_schedule_agreements
(customer_id, agreement_status);

ALTER TABLE
public.shopdrop_service_schedule_agreements
ENABLE ROW LEVEL SECURITY;

-- Private backend access only until authenticated
-- booking actions and ownership checks are installed.

REVOKE ALL ON
public.shopdrop_service_schedule_agreements
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.shopdrop_service_schedule_agreements
TO service_role;


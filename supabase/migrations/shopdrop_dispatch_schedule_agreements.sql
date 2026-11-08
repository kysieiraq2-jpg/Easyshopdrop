
-- Shop&Drop: Dispatch appointment agreements.
-- Private scheduling between customer and
-- assigned transport provider.
-- Does not change offers, prices or payments.

CREATE TABLE IF NOT EXISTS
public.shopdrop_dispatch_schedule_agreements (
  booking_id uuid PRIMARY KEY
    REFERENCES public.dispatch_bookings(id)
    ON DELETE CASCADE,

  customer_id uuid NOT NULL
    REFERENCES auth.users(id),

  provider_id uuid NOT NULL
    REFERENCES auth.users(id),

  requested_arrival_at timestamptz NOT NULL,
  proposed_arrival_at timestamptz,
  confirmed_arrival_at timestamptz,

  agreement_status text NOT NULL
    DEFAULT 'awaiting_provider'
    CHECK (
      agreement_status IN (
        'awaiting_provider',
        'alternative_proposed',
        'confirmed',
        'declined',
        'cancelled'
      )
    ),

  proposed_at timestamptz,
  confirmed_at timestamptz,

  created_at timestamptz NOT NULL
    DEFAULT now(),

  updated_at timestamptz NOT NULL
    DEFAULT now(),

  CONSTRAINT shopdrop_dispatch_schedule_distinct_users
    CHECK (customer_id <> provider_id)
);

CREATE INDEX IF NOT EXISTS
shopdrop_dispatch_schedule_customer_idx
ON public.shopdrop_dispatch_schedule_agreements
(customer_id);

CREATE INDEX IF NOT EXISTS
shopdrop_dispatch_schedule_provider_idx
ON public.shopdrop_dispatch_schedule_agreements
(provider_id);

ALTER TABLE
public.shopdrop_dispatch_schedule_agreements
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
public.shopdrop_dispatch_schedule_agreements
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.shopdrop_dispatch_schedule_agreements
TO service_role;

-- New dispatch bookings receive an initial
-- appointment request from the customer's
-- requested collection/arrival time.
CREATE OR REPLACE FUNCTION
public.shopdrop_create_dispatch_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_requested_at timestamptz;
BEGIN
  SELECT r.required_at
  INTO v_requested_at
  FROM public.dispatch_requests r
  WHERE r.id = NEW.request_id
    AND r.customer_id = NEW.customer_id;

  -- Fail closed if the request has no time.
  IF v_requested_at IS NULL
     OR v_requested_at <= now()
  THEN
    RAISE EXCEPTION
      'Valid future dispatch arrival time required';
  END IF;

  INSERT INTO
  public.shopdrop_dispatch_schedule_agreements (
    booking_id,
    customer_id,
    provider_id,
    requested_arrival_at,
    agreement_status
  )
  VALUES (
    NEW.id,
    NEW.customer_id,
    NEW.provider_id,
    v_requested_at,
    'awaiting_provider'
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
shopdrop_create_dispatch_schedule_trigger
ON public.dispatch_bookings;

CREATE TRIGGER
shopdrop_create_dispatch_schedule_trigger
AFTER INSERT ON public.dispatch_bookings
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_create_dispatch_schedule();

REVOKE ALL ON FUNCTION
public.shopdrop_create_dispatch_schedule()
FROM PUBLIC, anon, authenticated;


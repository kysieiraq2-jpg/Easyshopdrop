
-- Shop&Drop: Mandatory eligibility guard.
-- Applies to service and dispatch releases.
-- Additive trigger; existing triggers preserved.
-- No provider payouts or live activation.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_arrival_release_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_valid boolean := false;
BEGIN
  -- Staging and hold states remain available.
  IF NEW.release_status NOT IN (
    'eligible',
    'processing',
    'submitted',
    'confirmed'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.booking_type = 'service' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.service_bookings b
      JOIN public.service_payments p
        ON p.booking_id = b.id
       AND p.provider_id = b.provider_id
      JOIN public.shopdrop_service_arrival_pins pin
        ON pin.booking_id = b.id
      JOIN public.shopdrop_service_arrival_payout_queue q
        ON q.booking_id = b.id
       AND q.provider_id = b.provider_id
      WHERE b.id = NEW.booking_id
        AND b.provider_id = NEW.provider_id
        AND b.payment_status = 'paid'
        AND b.booking_status NOT IN (
          'cancelled', 'disputed'
        )
        AND p.id = NEW.payment_id
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
        AND p.provider_payout_status = 'held'
        AND p.provider_amount = NEW.provider_amount
        AND p.gross_amount =
          p.provider_amount + p.commission_amount
        AND pin.verified_at IS NOT NULL
        AND q.queue_status IN (
          'awaiting_safeguards',
          'eligible',
          'processing',
          'completed'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.service_disputes d
          WHERE d.booking_id = b.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.service_provider_payout_holds h
          WHERE h.provider_id = b.provider_id
            AND h.status = 'active'
        )
    ) INTO v_valid;

  ELSIF NEW.booking_type = 'dispatch' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.dispatch_bookings b
      JOIN public.dispatch_payments p
        ON p.booking_id = b.id
      JOIN public.shopdrop_dispatch_arrival_pins pin
        ON pin.booking_id = b.id
      JOIN public.shopdrop_dispatch_arrival_payout_queue q
        ON q.booking_id = b.id
       AND q.provider_id = b.provider_id
      WHERE b.id = NEW.booking_id
        AND b.provider_id = NEW.provider_id
        AND b.booking_status = 'arrival_verified'
        AND b.arrival_verified_at IS NOT NULL
        AND b.payment_status = 'paid'
        AND p.id = NEW.payment_id
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
        AND p.provider_payout_status = 'held'
        AND p.provider_amount = NEW.provider_amount
        AND p.provider_amount = b.provider_amount
        AND p.currency = NEW.currency
        AND p.currency = b.currency
        AND p.gross_amount =
          p.provider_amount + p.commission_amount
        AND pin.verified_at IS NOT NULL
        AND q.queue_status IN (
          'awaiting_safeguards',
          'eligible',
          'processing',
          'completed'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.shopdrop_dispatch_payout_holds h
          WHERE h.booking_id = b.id
            AND h.hold_status = 'active'
        )
    ) INTO v_valid;
  END IF;

  IF NOT COALESCE(v_valid, false) THEN
    RAISE EXCEPTION
      'arrival_release_safeguards_not_satisfied';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_guard_arrival_release_eligibility()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
shopdrop_guard_arrival_release_eligibility_trigger
ON public.shopdrop_arrival_provider_release_ledger;

CREATE TRIGGER
shopdrop_guard_arrival_release_eligibility_trigger
BEFORE INSERT OR UPDATE
ON public.shopdrop_arrival_provider_release_ledger
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_arrival_release_eligibility();


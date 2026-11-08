
-- Shop&Drop: Dispatch payment schedule guard.
-- Requires confirmed arrival appointment before
-- a dispatch booking may transition to paid.
-- Additive; preserves existing payment functions.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_dispatch_payment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only inspect a transition into paid status.
  IF NEW.payment_status IS DISTINCT FROM 'paid'
     OR (
       TG_OP = 'UPDATE'
       AND OLD.payment_status = 'paid'
     )
  THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.shopdrop_dispatch_schedule_agreements a
    WHERE a.booking_id = NEW.id
      AND a.customer_id = NEW.customer_id
      AND a.provider_id = NEW.provider_id
      AND a.agreement_status = 'confirmed'
      AND a.confirmed_arrival_at IS NOT NULL
      AND a.confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Dispatch arrival appointment must be confirmed before payment';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
shopdrop_guard_dispatch_payment_schedule_trigger
ON public.dispatch_bookings;

CREATE TRIGGER
shopdrop_guard_dispatch_payment_schedule_trigger
BEFORE INSERT OR UPDATE OF payment_status
ON public.dispatch_bookings
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_dispatch_payment_schedule();

REVOKE ALL ON FUNCTION
public.shopdrop_guard_dispatch_payment_schedule()
FROM PUBLIC, anon, authenticated;



-- Shop&Drop: Service payment scheduling safeguard.
-- Additive trigger; existing functions preserved.
-- Prevents paid status before confirmed appointment.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_service_payment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only check a transition into paid status.
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
    FROM public.shopdrop_service_schedule_agreements a
    JOIN public.service_bookings b
      ON b.id = a.booking_id
    WHERE a.booking_id = NEW.id
      AND a.customer_id = NEW.buyer_id
      AND a.provider_id = NEW.provider_id
      AND a.agreement_status = 'confirmed'
      AND a.confirmed_date IS NOT NULL
      AND a.confirmed_arrival_time IS NOT NULL
      AND a.confirmed_at IS NOT NULL
      AND b.id = NEW.id
  ) THEN
    RAISE EXCEPTION
      'Service appointment must be confirmed before payment';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
shopdrop_guard_service_payment_schedule_trigger
ON public.service_bookings;

CREATE TRIGGER
shopdrop_guard_service_payment_schedule_trigger
BEFORE INSERT OR UPDATE OF payment_status
ON public.service_bookings
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_service_payment_schedule();

REVOKE ALL ON FUNCTION
public.shopdrop_guard_service_payment_schedule()
FROM PUBLIC, anon, authenticated;


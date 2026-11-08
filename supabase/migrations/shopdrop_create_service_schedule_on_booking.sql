
-- Shop&Drop: Automatically create a service
-- scheduling agreement when a booking is created.
-- Existing booking function remains unchanged.
-- No payments or payouts.

CREATE OR REPLACE FUNCTION
public.shopdrop_create_service_schedule_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only bookings with a requested appointment
  -- enter the scheduling workflow.
  IF NEW.booking_date IS NULL
     OR NEW.booking_time IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- Prevent invalid scheduling identities.
  IF NEW.buyer_id = NEW.provider_id THEN
    RAISE EXCEPTION 'invalid_booking_parties';
  END IF;

  IF NEW.booking_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'booking_date_expired';
  END IF;

  -- Never automatically confirm the appointment.
  INSERT INTO
  public.shopdrop_service_schedule_agreements (
    booking_id,
    customer_id,
    provider_id,
    requested_date,
    requested_arrival_time,
    agreement_status
  )
  VALUES (
    NEW.id,
    NEW.buyer_id,
    NEW.provider_id,
    NEW.booking_date,
    NEW.booking_time,
    'awaiting_provider'
  )
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_create_service_schedule_on_booking()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
shopdrop_create_service_schedule_on_booking_trigger
ON public.service_bookings;

CREATE TRIGGER
shopdrop_create_service_schedule_on_booking_trigger
AFTER INSERT
ON public.service_bookings
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_create_service_schedule_on_booking();


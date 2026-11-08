
-- Shop&Drop: Customer response to alternative
-- service date and arrival time.
-- Existing booking and agreed price preserved.
-- No payments or payouts activated.

CREATE OR REPLACE FUNCTION
public.shopdrop_service_customer_schedule_response(
  p_booking_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer uuid;
  v_booking public.service_bookings%ROWTYPE;
  v_schedule public.shopdrop_service_schedule_agreements%ROWTYPE;
BEGIN
  v_customer := auth.uid();

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  -- Lock booking before changing its schedule.
  SELECT *
  INTO v_booking
  FROM public.service_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_booking.buyer_id <> v_customer
  THEN
    RAISE EXCEPTION 'booking_not_available';
  END IF;

  IF v_booking.payment_status <> 'pending'
     OR v_booking.booking_status IN (
       'cancelled', 'disputed'
     )
  THEN
    RAISE EXCEPTION 'booking_not_editable';
  END IF;

  SELECT *
  INTO v_schedule
  FROM public.shopdrop_service_schedule_agreements
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_schedule.customer_id <> v_customer
     OR v_schedule.provider_id <>
        v_booking.provider_id
     OR v_schedule.agreement_status <>
        'alternative_proposed'
  THEN
    RAISE EXCEPTION 'alternative_not_available';
  END IF;

  IF p_action = 'accept' THEN

    IF v_schedule.proposed_date IS NULL
       OR v_schedule.proposed_arrival_time IS NULL
       OR v_schedule.proposed_date < CURRENT_DATE
    THEN
      RAISE EXCEPTION 'alternative_date_expired';
    END IF;

    UPDATE public.shopdrop_service_schedule_agreements
    SET agreement_status = 'confirmed',
        confirmed_date = proposed_date,
        confirmed_arrival_time =
          proposed_arrival_time,
        confirmed_at = now(),
        updated_at = now()
    WHERE booking_id = p_booking_id;

  ELSE

    UPDATE public.shopdrop_service_schedule_agreements
    SET agreement_status = 'declined',
        updated_at = now()
    WHERE booking_id = p_booking_id;

  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'action', p_action,
    'payment_collected', false,
    'funds_moved', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_service_customer_schedule_response(
  uuid, text
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_service_customer_schedule_response(
  uuid, text
)
TO authenticated;


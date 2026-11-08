
-- Shop&Drop: Other Services provider scheduling.
-- Provider accepts, declines or proposes a new date.
-- Customer must approve alternatives separately.
-- No payments or payouts.

CREATE OR REPLACE FUNCTION
public.shopdrop_service_provider_schedule_response(
  p_booking_id uuid,
  p_action text,
  p_alternative_date date DEFAULT NULL,
  p_alternative_time time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider uuid;
  v_schedule public.shopdrop_service_schedule_agreements%ROWTYPE;
  v_booking public.service_bookings%ROWTYPE;
BEGIN
  v_provider := auth.uid();

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_action NOT IN (
    'accept', 'decline', 'propose'
  ) THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  -- Serialize changes for this booking.
  SELECT *
  INTO v_booking
  FROM public.service_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_booking.provider_id <> v_provider
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
     OR v_schedule.provider_id <> v_provider
     OR v_schedule.customer_id <> v_booking.buyer_id
     OR v_schedule.agreement_status <>
        'awaiting_provider'
  THEN
    RAISE EXCEPTION 'schedule_not_awaiting_provider';
  END IF;

  IF p_action = 'accept' THEN

    IF v_schedule.requested_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'requested_date_expired';
    END IF;

    UPDATE public.shopdrop_service_schedule_agreements
    SET agreement_status = 'confirmed',
        confirmed_date = requested_date,
        confirmed_arrival_time =
          requested_arrival_time,
        confirmed_at = now(),
        updated_at = now()
    WHERE booking_id = p_booking_id;

  ELSIF p_action = 'decline' THEN

    UPDATE public.shopdrop_service_schedule_agreements
    SET agreement_status = 'declined',
        updated_at = now()
    WHERE booking_id = p_booking_id;

  ELSE

    IF p_alternative_date IS NULL
       OR p_alternative_time IS NULL
       OR p_alternative_date < CURRENT_DATE
    THEN
      RAISE EXCEPTION 'invalid_alternative_schedule';
    END IF;

    UPDATE public.shopdrop_service_schedule_agreements
    SET agreement_status = 'alternative_proposed',
        proposed_date = p_alternative_date,
        proposed_arrival_time =
          p_alternative_time,
        proposed_at = now(),
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
public.shopdrop_service_provider_schedule_response(
  uuid, text, date, time
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_service_provider_schedule_response(
  uuid, text, date, time
)
TO authenticated;


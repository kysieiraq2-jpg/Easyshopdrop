
-- Shop&Drop: Dispatch provider schedule response.
-- Provider may accept, decline or propose a time.
-- Existing offers, prices and payments preserved.

CREATE OR REPLACE FUNCTION
public.shopdrop_dispatch_provider_schedule_response(
  p_booking_id uuid,
  p_action text,
  p_alternative_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider uuid;
  v_booking public.dispatch_bookings%ROWTYPE;
  v_schedule
    public.shopdrop_dispatch_schedule_agreements%ROWTYPE;
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

  -- Lock booking before changing appointment.
  SELECT *
  INTO v_booking
  FROM public.dispatch_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_booking.provider_id <> v_provider
  THEN
    RAISE EXCEPTION 'booking_not_available';
  END IF;

  IF v_booking.payment_status <> 'pending'
     OR v_booking.booking_status IN (
       'cancelled', 'canceled',
       'disputed', 'refunded'
     )
  THEN
    RAISE EXCEPTION 'booking_not_editable';
  END IF;

  SELECT *
  INTO v_schedule
  FROM public.shopdrop_dispatch_schedule_agreements
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_schedule.provider_id <> v_provider
     OR v_schedule.customer_id <>
        v_booking.customer_id
     OR v_schedule.agreement_status <>
        'awaiting_provider'
  THEN
    RAISE EXCEPTION 'schedule_not_available';
  END IF;

  IF p_action = 'accept' THEN

    IF v_schedule.requested_arrival_at <= now()
    THEN
      RAISE EXCEPTION 'requested_time_expired';
    END IF;

    UPDATE public.shopdrop_dispatch_schedule_agreements
    SET agreement_status = 'confirmed',
        confirmed_arrival_at =
          requested_arrival_at,
        confirmed_at = now(),
        updated_at = now()
    WHERE booking_id = p_booking_id;

  ELSIF p_action = 'decline' THEN

    UPDATE public.shopdrop_dispatch_schedule_agreements
    SET agreement_status = 'declined',
        updated_at = now()
    WHERE booking_id = p_booking_id;

  ELSE

    IF p_alternative_at IS NULL
       OR p_alternative_at <= now()
    THEN
      RAISE EXCEPTION 'invalid_alternative_time';
    END IF;

    UPDATE public.shopdrop_dispatch_schedule_agreements
    SET agreement_status = 'alternative_proposed',
        proposed_arrival_at = p_alternative_at,
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
public.shopdrop_dispatch_provider_schedule_response(
  uuid, text, timestamptz
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_dispatch_provider_schedule_response(
  uuid, text, timestamptz
)
TO authenticated;


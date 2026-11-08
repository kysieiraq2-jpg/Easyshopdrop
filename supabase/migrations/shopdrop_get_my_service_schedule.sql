
-- Shop&Drop: Secure service appointment viewing.
-- Customer and provider access only.
-- No contact details, payments or price changes.

CREATE OR REPLACE FUNCTION
public.shopdrop_get_my_service_schedule(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid;
  v_result jsonb;
BEGIN
  v_user := auth.uid();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'invalid_booking';
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'booking_id', b.id,
    'my_role',
      CASE
        WHEN b.buyer_id = v_user
          THEN 'customer'
        ELSE 'provider'
      END,
    'agreement_status', a.agreement_status,
    'requested_date', a.requested_date,
    'requested_arrival_time',
      a.requested_arrival_time,
    'proposed_date', a.proposed_date,
    'proposed_arrival_time',
      a.proposed_arrival_time,
    'confirmed_date', a.confirmed_date,
    'confirmed_arrival_time',
      a.confirmed_arrival_time,
    'booking_status', b.booking_status,
    'payment_status', b.payment_status
  )
  INTO v_result
  FROM public.service_bookings b
  JOIN public.shopdrop_service_schedule_agreements a
    ON a.booking_id = b.id
   AND a.customer_id = b.buyer_id
   AND a.provider_id = b.provider_id
  WHERE b.id = p_booking_id
    AND v_user IN (b.buyer_id, b.provider_id);

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'booking_not_available';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_get_my_service_schedule(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_get_my_service_schedule(uuid)
TO authenticated;


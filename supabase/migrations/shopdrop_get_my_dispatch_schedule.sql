
-- Shop&Drop: Secure dispatch appointment viewing.
-- Only the assigned customer or provider.
-- Read-only; no contact details or payments.

CREATE OR REPLACE FUNCTION
public.shopdrop_get_my_dispatch_schedule(
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
        WHEN b.customer_id = v_user
          THEN 'customer'
        ELSE 'provider'
      END,
    'agreement_status', a.agreement_status,
    'requested_arrival_at',
      a.requested_arrival_at,
    'proposed_arrival_at',
      a.proposed_arrival_at,
    'confirmed_arrival_at',
      a.confirmed_arrival_at,
    'booking_status', b.booking_status,
    'payment_status', b.payment_status
  )
  INTO v_result
  FROM public.dispatch_bookings b
  JOIN public.shopdrop_dispatch_schedule_agreements a
    ON a.booking_id = b.id
   AND a.customer_id = b.customer_id
   AND a.provider_id = b.provider_id
  WHERE b.id = p_booking_id
    AND v_user IN (
      b.customer_id,
      b.provider_id
    );

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'booking_not_available';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_get_my_dispatch_schedule(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_get_my_dispatch_schedule(uuid)
TO authenticated;


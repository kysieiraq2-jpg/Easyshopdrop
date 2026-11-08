
-- Shop&Drop: Paid booking contact access.
-- Other Services and Dispatching only.
-- No contact disclosure before confirmed payment.
-- Existing product privacy rules unchanged.
-- No payments or payouts initiated.

CREATE OR REPLACE FUNCTION
public.shopdrop_get_paid_booking_contacts(
  p_booking_type text,
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid;
  v_customer uuid;
  v_provider uuid;
  v_paid boolean := false;
  v_request uuid;
  v_result jsonb;
BEGIN
  v_user := auth.uid();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_booking_id IS NULL
     OR p_booking_type NOT IN ('service', 'dispatch')
  THEN
    RAISE EXCEPTION 'invalid_booking';
  END IF;

  IF p_booking_type = 'service' THEN

    SELECT b.buyer_id, b.provider_id
    INTO v_customer, v_provider
    FROM public.service_bookings b
    WHERE b.id = p_booking_id
      AND b.buyer_id <> b.provider_id
      AND b.booking_status NOT IN (
        'cancelled', 'disputed'
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'booking_unavailable';
    END IF;

    IF v_user NOT IN (v_customer, v_provider) THEN
      RAISE EXCEPTION 'booking_unavailable';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.service_bookings b
      JOIN public.service_payments p
        ON p.booking_id = b.id
       AND p.buyer_id = b.buyer_id
       AND p.provider_id = b.provider_id
      JOIN public.shopdrop_service_schedule_agreements a
        ON a.booking_id = b.id
       AND a.customer_id = b.buyer_id
       AND a.provider_id = b.provider_id
      WHERE b.id = p_booking_id
        AND b.payment_status = 'paid'
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
        AND NULLIF(
          trim(p.payment_reference), ''
        ) IS NOT NULL
        AND a.agreement_status = 'confirmed'
    ) INTO v_paid;

  ELSE

    SELECT b.customer_id, b.provider_id,
           b.request_id
    INTO v_customer, v_provider, v_request
    FROM public.dispatch_bookings b
    WHERE b.id = p_booking_id
      AND b.customer_id <> b.provider_id
      AND b.booking_status NOT IN (
        'cancelled', 'disputed'
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'booking_unavailable';
    END IF;

    IF v_user NOT IN (v_customer, v_provider) THEN
      RAISE EXCEPTION 'booking_unavailable';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.dispatch_bookings b
      JOIN public.dispatch_payments p
        ON p.booking_id = b.id
      WHERE b.id = p_booking_id
        AND b.payment_status = 'paid'
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
        AND NULLIF(
          trim(p.payment_reference), ''
        ) IS NOT NULL
        AND p.provider_amount = b.provider_amount
        AND p.currency = b.currency
    ) INTO v_paid;

  END IF;

  IF NOT v_paid THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'payment_not_confirmed',
      'contacts_released', false
    );
  END IF;

  -- Return only the other booking participant's
  -- name and registered mobile number.
  SELECT jsonb_build_object(
    'ok', true,
    'booking_type', p_booking_type,
    'booking_id', p_booking_id,
    'contacts_released', true,
    'other_party',
      jsonb_build_object(
        'name', pr.full_name,
        'mobile_number', pr.mobile_number
      )
  )
  INTO v_result
  FROM public.profiles pr
  WHERE pr.id = CASE
    WHEN v_user = v_customer
      THEN v_provider
    ELSE v_customer
  END;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'contact_profile_unavailable';
  END IF;

  -- Dispatch pickup and dropoff information
  -- is needed by the assigned provider only.
  IF p_booking_type = 'dispatch'
     AND v_user = v_provider
  THEN
    SELECT v_result || jsonb_build_object(
      'pickup_address', r.pickup_address,
      'pickup_contact_name', r.pickup_contact_name,
      'pickup_contact_mobile',
        r.pickup_contact_mobile,
      'dropoff_address', r.dropoff_address,
      'dropoff_contact_name', r.dropoff_contact_name,
      'dropoff_contact_mobile',
        r.dropoff_contact_mobile
    )
    INTO v_result
    FROM public.dispatch_requests r
    WHERE r.id = v_request
      AND r.customer_id = v_customer;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_get_paid_booking_contacts(
  text, uuid
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_get_paid_booking_contacts(
  text, uuid
)
TO authenticated;


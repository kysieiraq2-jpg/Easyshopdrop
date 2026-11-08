
-- Shop&Drop: Service checkout readiness.
-- Read-only prepayment validation.
-- No payments, payouts or booking modifications.
-- Existing payment functions remain unchanged.

CREATE OR REPLACE FUNCTION
public.shopdrop_service_checkout_readiness(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid;
  v_booking record;
  v_agreement record;
  v_breakdown record;
BEGIN
  v_user := auth.uid();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'invalid_booking';
  END IF;

  -- Only the customer who owns this booking
  -- may request checkout readiness.
  SELECT
    b.id,
    b.buyer_id,
    b.provider_id,
    b.booking_status,
    b.payment_status,
    b.agreed_amount,
    s.provider_id AS listing_provider,
    s.listing_status,
    s.currency
  INTO v_booking
  FROM public.service_bookings b
  JOIN public.services s
    ON s.id = b.service_id
  WHERE b.id = p_booking_id
    AND b.buyer_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_available';
  END IF;

  IF v_booking.buyer_id = v_booking.provider_id
     OR v_booking.provider_id
        IS DISTINCT FROM v_booking.listing_provider
  THEN
    RAISE EXCEPTION 'invalid_booking_participants';
  END IF;

  IF v_booking.payment_status IS DISTINCT FROM
       'pending'
     OR lower(coalesce(
       v_booking.booking_status, ''
     )) IN (
       'cancelled',
       'canceled',
       'disputed',
       'refunded'
     )
  THEN
    RETURN jsonb_build_object(
      'ok', false,
      'ready_for_checkout', false,
      'reason', 'booking_not_payable'
    );
  END IF;

  -- Do not prepare checkout for an unavailable
  -- or unapproved service listing.
  IF v_booking.listing_status
       IS DISTINCT FROM 'approved'
     OR upper(coalesce(
       v_booking.currency, ''
     )) <> 'ZAR'
  THEN
    RETURN jsonb_build_object(
      'ok', false,
      'ready_for_checkout', false,
      'reason', 'service_not_available'
    );
  END IF;

  SELECT
    a.agreement_status,
    a.confirmed_date,
    a.confirmed_arrival_time,
    a.confirmed_at
  INTO v_agreement
  FROM public.shopdrop_service_schedule_agreements a
  WHERE a.booking_id = p_booking_id
    AND a.customer_id = v_booking.buyer_id
    AND a.provider_id = v_booking.provider_id;

  IF NOT FOUND
     OR v_agreement.agreement_status
          IS DISTINCT FROM 'confirmed'
     OR v_agreement.confirmed_date IS NULL
     OR v_agreement.confirmed_arrival_time IS NULL
     OR v_agreement.confirmed_at IS NULL
     OR v_agreement.confirmed_date < CURRENT_DATE
  THEN
    RETURN jsonb_build_object(
      'ok', false,
      'ready_for_checkout', false,
      'reason', 'appointment_not_confirmed'
    );
  END IF;

  -- Reuse the existing service pricing function.
  -- Never accept an amount from the browser.
  SELECT *
  INTO v_breakdown
  FROM public.shopdrop_service_payment_breakdown(
    p_booking_id
  );

  IF NOT FOUND
     OR v_breakdown.currency <> 'ZAR'
     OR v_breakdown.provider_amount
        IS DISTINCT FROM
        round(v_booking.agreed_amount, 2)
  THEN
    RAISE EXCEPTION 'payment_breakdown_mismatch';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ready_for_checkout', true,
    'booking_id', p_booking_id,
    'currency', v_breakdown.currency,
    'provider_amount',
      v_breakdown.provider_amount,
    'commission_amount',
      v_breakdown.commission_amount,
    'customer_total',
      v_breakdown.customer_total,
    'confirmed_date',
      v_agreement.confirmed_date,
    'confirmed_arrival_time',
      v_agreement.confirmed_arrival_time,
    'payment_collected', false,
    'funds_moved', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_service_checkout_readiness(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_service_checkout_readiness(uuid)
TO authenticated;


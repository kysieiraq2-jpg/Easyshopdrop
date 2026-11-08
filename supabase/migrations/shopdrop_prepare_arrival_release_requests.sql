
-- Shop&Drop service and dispatch arrival payout preparation
-- Provider-neutral integration
-- No bank transfers or payment status changes
-- Live payout activation remains protected

CREATE OR REPLACE FUNCTION
public.shopdrop_prepare_arrival_release_requests(
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ready boolean;
  v_requests jsonb;
BEGIN
  IF session_user <> 'postgres'
     AND auth.role() IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  IF p_limit IS NULL
     OR p_limit < 1
     OR p_limit > 100
  THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  v_ready := public.shopdrop_arrival_payout_ready();

  IF NOT v_ready THEN
    RETURN jsonb_build_object(
      'ok', true,
      'activation_required', true,
      'requests', '[]'::jsonb,
      'funds_moved', false,
      'status_changed', false
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(x)),
    '[]'::jsonb
  )
  INTO v_requests
  FROM (
    SELECT
      'service'::text AS booking_type,
      q.booking_id,
      q.provider_id,
      p.id AS payment_id,
      p.payment_reference,
      p.provider_amount,
      p.commission_amount,
      p.gross_amount,
      NULL::text AS currency
    FROM public.shopdrop_service_arrival_payout_queue q
    JOIN public.service_bookings b
      ON b.id = q.booking_id
     AND b.provider_id = q.provider_id
    JOIN public.service_payments p
      ON p.booking_id = b.id
     AND p.provider_id = b.provider_id
    JOIN public.shopdrop_service_arrival_pins pin
      ON pin.booking_id = b.id
     AND pin.verified_at IS NOT NULL
    WHERE q.queue_status = 'awaiting_safeguards'
      AND b.payment_status = 'paid'
      AND p.payment_status = 'paid'
      AND p.paid_at IS NOT NULL
      AND p.provider_payout_status = 'held'
      AND p.gross_amount =
          p.provider_amount + p.commission_amount
      AND NOT EXISTS (
        SELECT 1
        FROM public.service_provider_payouts sp
        JOIN public.service_provider_payout_holds h
          ON h.service_provider_payout_id = sp.id
        WHERE sp.booking_id = b.id
          AND sp.provider_id = b.provider_id
          AND h.status = 'active'
      )

    UNION ALL

    SELECT
      'dispatch',
      q.booking_id,
      q.provider_id,
      p.id,
      p.payment_reference,
      p.provider_amount,
      p.commission_amount,
      p.gross_amount,
      p.currency
    FROM public.shopdrop_dispatch_arrival_payout_queue q
    JOIN public.dispatch_bookings b
      ON b.id = q.booking_id
     AND b.provider_id = q.provider_id
     AND b.arrival_verified_at IS NOT NULL
     AND b.booking_status = 'arrival_verified'
    JOIN public.dispatch_payments p
      ON p.booking_id = b.id
     AND p.payment_status = 'paid'
     AND p.paid_at IS NOT NULL
     AND p.provider_payout_status = 'held'
    JOIN public.shopdrop_dispatch_arrival_pins pin
      ON pin.booking_id = b.id
     AND pin.verified_at IS NOT NULL
    WHERE q.queue_status = 'awaiting_safeguards'
      AND b.payment_status = 'paid'
      AND p.provider_amount = b.provider_amount
      AND p.currency = b.currency
      AND p.gross_amount =
          p.provider_amount + p.commission_amount

    ORDER BY booking_type, booking_id
    LIMIT p_limit
  ) x;

  RETURN jsonb_build_object(
    'ok', true,
    'activation_required', false,
    'requests', v_requests,
    'funds_moved', false,
    'status_changed', false,
    'provider_release_not_implemented', true
  );
END;
$$;

REVOKE ALL ON FUNCTION
public.shopdrop_prepare_arrival_release_requests(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.shopdrop_prepare_arrival_release_requests(integer)
TO service_role;


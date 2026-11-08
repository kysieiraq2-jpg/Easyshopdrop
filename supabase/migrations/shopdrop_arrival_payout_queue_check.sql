
-- Shop&Drop arrival payout queue checks
-- Provider-neutral. No money movement.
-- Mirrors the installed Supabase function.

CREATE OR REPLACE FUNCTION
public.shopdrop_check_arrival_payout_queues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_service_total integer;
  v_dispatch_total integer;
  v_service_ready integer;
  v_dispatch_ready integer;
  v_gate boolean;
BEGIN
  IF session_user <> 'postgres'
     AND auth.role() IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  SELECT count(*)
  INTO v_service_total
  FROM public.shopdrop_service_arrival_payout_queue;

  SELECT count(*)
  INTO v_dispatch_total
  FROM public.shopdrop_dispatch_arrival_payout_queue;

  SELECT count(*)
  INTO v_service_ready
  FROM public.shopdrop_service_arrival_payout_queue q
  JOIN public.service_bookings b
    ON b.id = q.booking_id
   AND b.provider_id = q.provider_id
  JOIN public.service_payments p
    ON p.booking_id = b.id
   AND p.provider_id = b.provider_id
  JOIN public.shopdrop_service_arrival_pins pin
    ON pin.booking_id = b.id
  WHERE q.queue_status = 'awaiting_safeguards'
    AND b.payment_status = 'paid'
    AND p.payment_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND pin.verified_at IS NOT NULL
    AND p.provider_amount >= 0
    AND p.gross_amount =
        p.provider_amount + p.commission_amount;

  SELECT count(*)
  INTO v_dispatch_ready
  FROM public.shopdrop_dispatch_arrival_payout_queue q
  JOIN public.dispatch_bookings b
    ON b.id = q.booking_id
   AND b.provider_id = q.provider_id
  JOIN public.dispatch_payments p
    ON p.booking_id = b.id
  JOIN public.shopdrop_dispatch_arrival_pins pin
    ON pin.booking_id = b.id
  WHERE q.queue_status = 'awaiting_safeguards'
    AND b.booking_status = 'arrival_verified'
    AND b.arrival_verified_at IS NOT NULL
    AND b.payment_status = 'paid'
    AND p.payment_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND pin.verified_at IS NOT NULL
    AND p.provider_payout_status = 'held'
    AND p.provider_amount = b.provider_amount
    AND p.currency = b.currency
    AND p.gross_amount =
        p.provider_amount + p.commission_amount;

  SELECT public.shopdrop_arrival_payout_ready()
  INTO v_gate;

  RETURN jsonb_build_object(
    'ok', true,
    'service_queued', v_service_total,
    'dispatch_queued', v_dispatch_total,
    'service_candidates', v_service_ready,
    'dispatch_candidates', v_dispatch_ready,
    'provider_release_enabled', v_gate,
    'funds_moved', false,
    'queue_mutations', false
  );
END;
$$;

REVOKE ALL ON FUNCTION
public.shopdrop_check_arrival_payout_queues()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.shopdrop_check_arrival_payout_queues()
TO service_role;


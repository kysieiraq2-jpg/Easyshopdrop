

-- Shop&Drop: Stage verified arrival releases.
-- Additive only. Existing functions preserved.
-- Service and dispatch. No funds moved.
-- Live payouts remain disabled.

CREATE OR REPLACE FUNCTION
public.shopdrop_stage_arrival_provider_releases(
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer := 0;
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

  -- Stage records only. Never release funds here.
  WITH candidates AS (
    SELECT
      'service'::text AS booking_type,
      q.booking_id,
      q.provider_id,
      p.id AS payment_id,
      (SELECT s.setting_value->>'currency'
       FROM public.platform_settings s
       WHERE s.setting_key = 'shopdrop_launch_region'
         AND s.is_active IS TRUE) AS currency,
      p.provider_amount
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
      AND b.booking_status NOT IN ('cancelled','disputed')
      AND p.payment_status = 'paid'
      AND p.paid_at IS NOT NULL
      AND p.provider_payout_status = 'held'
      AND p.provider_amount > 0
      AND p.gross_amount =
          p.provider_amount + p.commission_amount
      AND NOT EXISTS (
        SELECT 1
        FROM public.service_disputes d
        WHERE d.booking_id = b.id
      )
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
      'dispatch'::text,
      q.booking_id,
      q.provider_id,
      p.id,
      p.currency,
      p.provider_amount
    FROM public.shopdrop_dispatch_arrival_payout_queue q
    JOIN public.dispatch_bookings b
      ON b.id = q.booking_id
     AND b.provider_id = q.provider_id
    JOIN public.dispatch_payments p
      ON p.booking_id = b.id
    JOIN public.shopdrop_dispatch_arrival_pins pin
      ON pin.booking_id = b.id
     AND pin.verified_at IS NOT NULL
    WHERE q.queue_status = 'awaiting_safeguards'
      AND b.booking_status = 'arrival_verified'
      AND b.arrival_verified_at IS NOT NULL
      AND b.payment_status = 'paid'
      AND p.payment_status = 'paid'
      AND p.paid_at IS NOT NULL
      AND p.provider_payout_status = 'held'
      AND p.provider_amount = b.provider_amount
      AND p.currency = b.currency
      AND p.gross_amount =
          p.provider_amount + p.commission_amount
  ),
  selected AS (
    SELECT *
    FROM candidates
    WHERE currency ~ '^[A-Z]{3}$'
      AND provider_amount > 0
    ORDER BY booking_type, booking_id
    LIMIT p_limit
  ),
  inserted AS (
    INSERT INTO
    public.shopdrop_arrival_provider_release_ledger (
      booking_type,
      booking_id,
      provider_id,
      payment_id,
      currency,
      provider_amount,
      release_status
    )
    SELECT
      booking_type,
      booking_id,
      provider_id,
      payment_id,
      currency,
      provider_amount,
      'awaiting_safeguards'
    FROM selected
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'records_staged', v_count,
    'funds_moved', false,
    'provider_release_submitted', false,
    'live_payouts_activated', false,
    'next_status', 'awaiting_safeguards'
  );
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_stage_arrival_provider_releases(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.shopdrop_stage_arrival_provider_releases(integer)
TO service_role;

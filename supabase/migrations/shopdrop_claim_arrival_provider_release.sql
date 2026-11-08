
-- Shop&Drop: Secure arrival release claim boundary.
-- Additive only. No existing functions replaced.
-- Services and dispatching.
-- No funds moved and no live payout activation.

CREATE OR REPLACE FUNCTION
public.shopdrop_claim_arrival_provider_release(
  p_ledger_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_record public.shopdrop_arrival_provider_release_ledger%ROWTYPE;
  v_ready boolean;
  v_valid boolean := false;
BEGIN
  IF session_user <> 'postgres'
     AND auth.role() IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  IF p_ledger_id IS NULL THEN
    RAISE EXCEPTION 'ledger_id_required';
  END IF;

  -- Lock the release record against concurrent claims.
  SELECT *
  INTO v_record
  FROM public.shopdrop_arrival_provider_release_ledger
  WHERE id = p_ledger_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'release_not_found';
  END IF;

  IF v_record.release_status <> 'awaiting_safeguards' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', v_record.release_status,
      'claimed', false,
      'funds_moved', false
    );
  END IF;

  -- Validate authoritative service payment and arrival.
  IF v_record.booking_type = 'service' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.service_bookings b
      JOIN public.service_payments p
        ON p.booking_id = b.id
       AND p.provider_id = b.provider_id
      JOIN public.shopdrop_service_arrival_pins pin
        ON pin.booking_id = b.id
      JOIN public.shopdrop_service_arrival_payout_queue q
        ON q.booking_id = b.id
       AND q.provider_id = b.provider_id
      WHERE b.id = v_record.booking_id
        AND b.provider_id = v_record.provider_id
        AND b.payment_status = 'paid'
        AND b.booking_status NOT IN (
          'cancelled', 'disputed'
        )
        AND p.id = v_record.payment_id
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
        AND p.provider_payout_status = 'held'
        AND p.provider_amount =
            v_record.provider_amount
        AND p.gross_amount =
            p.provider_amount + p.commission_amount
        AND pin.verified_at IS NOT NULL
        AND q.queue_status = 'awaiting_safeguards'
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
    ) INTO v_valid;

  ELSIF v_record.booking_type = 'dispatch' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.dispatch_bookings b
      JOIN public.dispatch_payments p
        ON p.booking_id = b.id
      JOIN public.shopdrop_dispatch_arrival_pins pin
        ON pin.booking_id = b.id
      JOIN public.shopdrop_dispatch_arrival_payout_queue q
        ON q.booking_id = b.id
       AND q.provider_id = b.provider_id
      WHERE b.id = v_record.booking_id
        AND b.provider_id = v_record.provider_id
        AND b.booking_status = 'arrival_verified'
        AND b.arrival_verified_at IS NOT NULL
        AND b.payment_status = 'paid'
        AND p.id = v_record.payment_id
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
        AND p.provider_payout_status = 'held'
        AND p.provider_amount =
            v_record.provider_amount
        AND p.provider_amount = b.provider_amount
        AND p.currency = v_record.currency
        AND p.currency = b.currency
        AND p.gross_amount =
            p.provider_amount + p.commission_amount
        AND pin.verified_at IS NOT NULL
        AND q.queue_status = 'awaiting_safeguards'
        AND NOT EXISTS (
          SELECT 1
          FROM public.shopdrop_dispatch_payout_holds h
          WHERE h.booking_id = b.id
            AND h.hold_status = 'active'
        )
    ) INTO v_valid;
  END IF;

  IF NOT v_valid THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'safeguards_not_satisfied',
      'claimed', false,
      'funds_moved', false
    );
  END IF;

  -- Existing activation gate remains authoritative.
  SELECT public.shopdrop_arrival_payout_ready()
  INTO v_ready;

  IF NOT COALESCE(v_ready, false) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'activation_required',
      'safeguards_verified', true,
      'claimed', false,
      'funds_moved', false
    );
  END IF;

  -- Even after activation, do not claim until the
  -- compatible payment-provider release adapter
  -- is installed, verified and enabled.
  RETURN jsonb_build_object(
    'ok', true,
    'status', 'provider_adapter_required',
    'safeguards_verified', true,
    'claimed', false,
    'funds_moved', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_claim_arrival_provider_release(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.shopdrop_claim_arrival_provider_release(uuid)
TO service_role;


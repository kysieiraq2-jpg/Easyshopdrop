
-- Shop&Drop: Dispatch payment validation schedule fix
-- Records the verified Supabase correction.
-- Preserves existing payment validation and calculations.
-- Safe to rerun after the original function exists.

DO $patch$
DECLARE
  v_sql text;
  v_old text := E'  RETURN true;\nEND;';
  v_guard text := $guard$
  -- Revalidate the appointment immediately before payment validation.
  IF NOT EXISTS (
    SELECT 1
    FROM public.shopdrop_dispatch_schedule_agreements a
    WHERE a.booking_id = p_booking_id
      AND a.customer_id = v_booking.customer_id
      AND a.provider_id = v_booking.provider_id
      AND a.agreement_status = 'confirmed'
      AND a.confirmed_at IS NOT NULL
      AND a.confirmed_arrival_at > now()
  ) THEN
    RAISE EXCEPTION
      'Confirmed future dispatch appointment required for payment validation';
  END IF;

  RETURN true;
END;$guard$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_sql
  FROM pg_proc p
  WHERE p.oid =
    'public.shopdrop_validate_dispatch_payment(uuid)'::regprocedure;

  IF v_sql IS NULL THEN
    RAISE EXCEPTION 'Original function missing';
  END IF;

  IF v_sql LIKE
    '%Confirmed future dispatch appointment required for payment validation%'
  THEN
    RAISE NOTICE 'Already patched';
    RETURN;
  END IF;

  IF position(v_old IN v_sql) = 0 THEN
    RAISE EXCEPTION
      'Expected original ending not found; no changes made';
  END IF;

  v_sql := replace(v_sql, v_old, v_guard);
  EXECUTE v_sql;
END $patch$;

REVOKE ALL ON FUNCTION
public.shopdrop_validate_dispatch_payment(uuid)
FROM PUBLIC, anon, authenticated;


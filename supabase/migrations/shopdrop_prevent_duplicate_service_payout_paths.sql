
-- Shop&Drop: Prevent parallel service payout paths.
-- Additive safeguards; preserve existing triggers.
-- No live payment activation or funds movement.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_duplicate_service_payout_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking_id uuid;
  v_other_exists boolean;
BEGIN
  v_booking_id := NEW.booking_id;

  -- Serialize competing payout-path writes
  -- for the same service booking.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'shopdrop:service-payout:' ||
      v_booking_id::text,
      0
    )
  );

  IF TG_TABLE_NAME =
     'shopdrop_arrival_provider_release_ledger' THEN

    IF NEW.booking_type <> 'service' THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.service_provider_payouts p
      WHERE p.booking_id = v_booking_id
    )
    INTO v_other_exists;

  ELSIF TG_TABLE_NAME =
        'service_provider_payouts' THEN

    SELECT EXISTS (
      SELECT 1
      FROM public.shopdrop_arrival_provider_release_ledger l
      WHERE l.booking_type = 'service'
        AND l.booking_id = v_booking_id
    )
    INTO v_other_exists;

  ELSE
    RAISE EXCEPTION 'unexpected_payout_table';
  END IF;

  IF v_other_exists THEN
    RAISE EXCEPTION
      'duplicate_service_payout_path_blocked';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_guard_duplicate_service_payout_path()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
shopdrop_no_duplicate_service_arrival_path
ON public.shopdrop_arrival_provider_release_ledger;

CREATE TRIGGER
shopdrop_no_duplicate_service_arrival_path
BEFORE INSERT OR UPDATE
ON public.shopdrop_arrival_provider_release_ledger
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_duplicate_service_payout_path();

DROP TRIGGER IF EXISTS
shopdrop_no_duplicate_legacy_service_path
ON public.service_provider_payouts;

CREATE TRIGGER
shopdrop_no_duplicate_legacy_service_path
BEFORE INSERT OR UPDATE
ON public.service_provider_payouts
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_duplicate_service_payout_path();


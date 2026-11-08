
-- Shop&Drop: Enforce dispatch payout holds.
-- Additive safeguard for shared arrival release ledger.
-- Existing functions and data preserved.
-- No live payment or payout activation.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_dispatch_release_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_active_hold boolean;
BEGIN
  IF NEW.booking_type <> 'dispatch' THEN
    RETURN NEW;
  END IF;

  -- Prevent changing the identity of an existing
  -- release record.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.booking_type IS DISTINCT FROM OLD.booking_type
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
       OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.provider_amount IS DISTINCT FROM OLD.provider_amount
    THEN
      RAISE EXCEPTION
        'Dispatch release identity cannot be changed';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.shopdrop_dispatch_payout_holds h
    WHERE h.booking_id = NEW.booking_id
      AND h.hold_status = 'active'
  )
  INTO v_active_hold;

  IF v_active_hold THEN
    -- Never advance a held dispatch release.
    IF NEW.release_status IN (
      'eligible',
      'processing',
      'submitted',
      'confirmed'
    ) THEN
      RAISE EXCEPTION
        'Dispatch payout blocked by active hold';
    END IF;

    -- New staged records remain blocked.
    IF TG_OP = 'INSERT'
       AND NEW.release_status =
         'awaiting_safeguards'
    THEN
      NEW.release_status := 'held';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
shopdrop_guard_dispatch_release_hold_trigger
ON public.shopdrop_arrival_provider_release_ledger;

CREATE TRIGGER
shopdrop_guard_dispatch_release_hold_trigger
BEFORE INSERT OR UPDATE
ON public.shopdrop_arrival_provider_release_ledger
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_dispatch_release_hold();

REVOKE ALL ON FUNCTION
public.shopdrop_guard_dispatch_release_hold()
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION
public.shopdrop_guard_dispatch_release_hold()
IS
'Blocks dispatch release advancement when an active payout hold exists. Does not move funds.';

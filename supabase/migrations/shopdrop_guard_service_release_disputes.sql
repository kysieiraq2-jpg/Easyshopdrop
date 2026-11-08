
-- Shop&Drop: Service release dispute protection.
-- Additive trigger. Existing functions preserved.
-- No live payout activation.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_service_release_disputes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_blocked boolean;
BEGIN
  IF NEW.booking_type <> 'service' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.booking_type IS DISTINCT FROM OLD.booking_type
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
       OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.provider_amount IS DISTINCT FROM OLD.provider_amount
    THEN
      RAISE EXCEPTION
        'Service release identity cannot be changed';
    END IF;
  END IF;

  SELECT
    EXISTS (
      SELECT 1
      FROM public.service_disputes d
      WHERE d.booking_id = NEW.booking_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.service_provider_payouts p
      JOIN public.service_provider_payout_holds h
        ON h.service_provider_payout_id = p.id
      WHERE p.booking_id = NEW.booking_id
        AND p.provider_id = NEW.provider_id
        AND h.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.service_bookings b
      WHERE b.id = NEW.booking_id
        AND b.booking_status IN (
          'cancelled', 'disputed'
        )
    )
  INTO v_blocked;

  IF v_blocked THEN
    IF NEW.release_status IN (
      'eligible',
      'processing',
      'submitted',
      'confirmed'
    ) THEN
      RAISE EXCEPTION
        'Service payout blocked by dispute or hold';
    END IF;

    IF TG_OP = 'INSERT'
       AND NEW.release_status = 'awaiting_safeguards'
    THEN
      NEW.release_status := 'held';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
shopdrop_guard_service_release_disputes_trigger
ON public.shopdrop_arrival_provider_release_ledger;

CREATE TRIGGER
shopdrop_guard_service_release_disputes_trigger
BEFORE INSERT OR UPDATE
ON public.shopdrop_arrival_provider_release_ledger
FOR EACH ROW
EXECUTE FUNCTION
public.shopdrop_guard_service_release_disputes();

REVOKE ALL ON FUNCTION
public.shopdrop_guard_service_release_disputes()
FROM PUBLIC, anon, authenticated;


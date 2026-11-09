
-- Shop&Drop: Dispatch checkout agreement guard.
-- Additive safeguard on checkout intent creation.
-- Preserves existing checkout and payment functions.
-- No money moved.

CREATE OR REPLACE FUNCTION
public.shopdrop_guard_dispatch_checkout_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.dispatch_bookings b
    JOIN public.shopdrop_dispatch_schedule_agreements a
      ON a.booking_id = b.id
     AND a.customer_id = b.customer_id
     AND a.provider_id = b.provider_id
    WHERE b.id = NEW.booking_id
      AND b.booking_status = 'pending_payment'
      AND b.payment_status = 'pending'
      AND a.agreement_status = 'confirmed'
      AND a.confirmed_at IS NOT NULL
      AND a.confirmed_arrival_at > now()
      AND b.currency = 'ZAR'
      AND b.provider_amount > 0
  ) THEN
    RAISE EXCEPTION
      'Confirmed future dispatch appointment required for checkout';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
shopdrop_guard_dispatch_checkout_agreement_trigger
ON public.shopdrop_dispatch_checkout_intents;

CREATE TRIGGER
shopdrop_guard_dispatch_checkout_agreement_trigger
BEFORE INSERT OR UPDATE OF
  checkout_status,
  expected_amount,
  currency,
  provider_session_id,
  payment_provider
ON public.shopdrop_dispatch_checkout_intents
FOR EACH ROW
WHEN (
  NEW.checkout_status IN ('pending', 'processing')
)
EXECUTE FUNCTION
public.shopdrop_guard_dispatch_checkout_agreement();

REVOKE ALL ON FUNCTION
public.shopdrop_guard_dispatch_checkout_agreement()
FROM PUBLIC, anon, authenticated;


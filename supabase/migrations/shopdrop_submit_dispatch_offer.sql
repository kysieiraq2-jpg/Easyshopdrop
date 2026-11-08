
-- Shop&Drop: secure dispatch provider offer submission.
-- South Africa first; international architecture preserved.
-- No live payment, booking acceptance or payout activation.

CREATE OR REPLACE FUNCTION
public.shopdrop_submit_dispatch_offer(
  p_request_id uuid,
  p_vehicle_description text,
  p_provider_amount numeric,
  p_currency text DEFAULT NULL,
  p_valid_until timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider uuid;
  v_request public.dispatch_requests%ROWTYPE;
  v_config jsonb;
  v_launch_country text;
  v_currency text;
  v_offer_id uuid;
BEGIN
  v_provider := auth.uid();

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_request_id IS NULL
     OR NULLIF(trim(p_vehicle_description), '') IS NULL
     OR length(trim(p_vehicle_description)) > 500
     OR p_provider_amount IS NULL
     OR p_provider_amount <= 0
     OR p_provider_amount > 999999999
  THEN
    RAISE EXCEPTION 'Invalid dispatch offer';
  END IF;

  IF p_valid_until IS NOT NULL
     AND p_valid_until <= now()
  THEN
    RAISE EXCEPTION 'Offer expiry must be in the future';
  END IF;

  -- Require an explicitly verified, approved provider.
  IF NOT EXISTS (
    SELECT 1
    FROM public.service_provider_verification_status v
    WHERE v.provider_id = v_provider
      AND v.verification_status = 'approved'
      AND v.identity_verified IS TRUE
      AND v.account_verified IS TRUE
      AND v.approved_at IS NOT NULL
      AND v.suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Provider is not approved';
  END IF;

  -- Existing configuration controls launch geography.
  SELECT setting_value
  INTO v_config
  FROM public.platform_settings
  WHERE setting_key = 'shopdrop_launch_region'
    AND is_active IS TRUE;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Launch configuration unavailable';
  END IF;

  v_launch_country := v_config->>'launch_country';

  v_currency := upper(
    trim(coalesce(p_currency, v_config->>'currency', ''))
  );

  IF v_launch_country IS NULL
     OR v_launch_country !~ '^[A-Z]{2}$'
     OR v_currency !~ '^[A-Z]{3}$'
  THEN
    RAISE EXCEPTION 'Invalid launch configuration';
  END IF;

  -- Lock request to prevent racing with offer acceptance.
  SELECT *
  INTO v_request
  FROM public.dispatch_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'open' THEN
    RAISE EXCEPTION 'Dispatch request unavailable';
  END IF;

  IF v_request.customer_id = v_provider THEN
    RAISE EXCEPTION 'Cannot offer on your own request';
  END IF;

  -- Country-neutral area format: ISO country code / region / city.
  -- Only the configured launch country is currently permitted.
  IF split_part(v_request.pickup_area, ' / ', 1)
       <> v_launch_country
     OR split_part(v_request.dropoff_area, ' / ', 1)
       <> v_launch_country
  THEN
    RAISE EXCEPTION 'Route outside active launch region';
  END IF;

  IF v_currency <> upper(v_config->>'currency') THEN
    RAISE EXCEPTION 'Currency outside active launch configuration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dispatch_bookings
    WHERE request_id = p_request_id
  ) THEN
    RAISE EXCEPTION 'Dispatch request already booked';
  END IF;

  -- Existing unique(request_id, provider_id) constraint
  -- also prevents concurrent duplicate offers.
  INSERT INTO public.dispatch_offers (
    request_id,
    provider_id,
    vehicle_description,
    provider_amount,
    currency,
    offer_status,
    valid_until
  )
  VALUES (
    p_request_id,
    v_provider,
    trim(p_vehicle_description),
    p_provider_amount,
    v_currency,
    'pending',
    p_valid_until
  )
  RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_submit_dispatch_offer(
  uuid,text,numeric,text,timestamptz
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_submit_dispatch_offer(
  uuid,text,numeric,text,timestamptz
)
TO authenticated;


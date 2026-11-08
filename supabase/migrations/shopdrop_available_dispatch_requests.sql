
-- Shop&Drop: Available dispatch jobs for approved providers.
-- South Africa launch; international architecture preserved.
-- Read-only. No payments, bookings or private contacts.

CREATE OR REPLACE FUNCTION
public.shopdrop_get_available_dispatch_requests(
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider uuid;
  v_config jsonb;
  v_country text;
  v_result jsonb;
BEGIN
  v_provider := auth.uid();

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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

  SELECT setting_value
  INTO v_config
  FROM public.platform_settings
  WHERE setting_key = 'shopdrop_launch_region'
    AND is_active IS TRUE;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Launch configuration unavailable';
  END IF;

  v_country := v_config->>'launch_country';

  IF v_country IS NULL
     OR v_country !~ '^[A-Z]{2}$'
  THEN
    RAISE EXCEPTION 'Invalid launch country';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'request_id', q.id,
        'request_reference', q.request_ref,
        'vehicle_type', q.vehicle_type,
        'pickup_area', q.pickup_area,
        'dropoff_area', q.dropoff_area,
        'required_at', q.required_at,
        'load_description', q.load_description,
        'approximate_weight', q.approximate_weight,
        'approximate_size', q.approximate_size,
        'created_at', q.created_at
      )
      ORDER BY q.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT r.*
    FROM public.dispatch_requests r
    WHERE r.status = 'open'
      AND r.customer_id <> v_provider
      AND split_part(r.pickup_area, ' / ', 1)
          = v_country
      AND split_part(r.dropoff_area, ' / ', 1)
          = v_country
      AND NOT EXISTS (
        SELECT 1
        FROM public.dispatch_offers o
        WHERE o.request_id = r.id
          AND o.provider_id = v_provider
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.dispatch_bookings b
        WHERE b.request_id = r.id
      )
    ORDER BY r.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),50)
  ) q;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_get_available_dispatch_requests(integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_get_available_dispatch_requests(integer)
TO authenticated;


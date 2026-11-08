
-- Shop&Drop: Dispatch location details
-- South Africa first, worldwide-compatible.
-- Additive: preserves existing dispatch functions.
-- No payment, payout or public contact disclosure.

CREATE OR REPLACE FUNCTION
public.shopdrop_update_dispatch_location_details(
  p_request_id uuid,
  p_details jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer uuid;
  v_request public.dispatch_requests%ROWTYPE;
  v_pickup_lat numeric;
  v_pickup_lon numeric;
  v_dropoff_lat numeric;
  v_dropoff_lon numeric;
  v_pickup_phone text;
  v_dropoff_phone text;
BEGIN
  v_customer := auth.uid();

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_request_id IS NULL
     OR p_details IS NULL
     OR jsonb_typeof(p_details) <> 'object'
  THEN
    RAISE EXCEPTION 'Invalid dispatch details';
  END IF;

  SELECT *
  INTO v_request
  FROM public.dispatch_requests
  WHERE id = p_request_id
    AND customer_id = v_customer
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch request unavailable';
  END IF;

  IF v_request.status <> 'open' THEN
    RAISE EXCEPTION
      'Dispatch details cannot be changed after offer acceptance';
  END IF;

  IF NULLIF(trim(p_details->>'pickup_address'), '') IS NULL
     OR NULLIF(trim(p_details->>'dropoff_address'), '') IS NULL
  THEN
    RAISE EXCEPTION
      'Collection and delivery street addresses are required';
  END IF;

  IF length(p_details->>'pickup_address') > 500
     OR length(p_details->>'dropoff_address') > 500
  THEN
    RAISE EXCEPTION 'Address too long';
  END IF;

  v_pickup_lat :=
    NULLIF(p_details->>'pickup_gps_lat', '')::numeric;
  v_pickup_lon :=
    NULLIF(p_details->>'pickup_gps_lon', '')::numeric;
  v_dropoff_lat :=
    NULLIF(p_details->>'dropoff_gps_lat', '')::numeric;
  v_dropoff_lon :=
    NULLIF(p_details->>'dropoff_gps_lon', '')::numeric;

  IF (v_pickup_lat IS NULL) <> (v_pickup_lon IS NULL)
     OR (v_dropoff_lat IS NULL) <> (v_dropoff_lon IS NULL)
  THEN
    RAISE EXCEPTION
      'GPS latitude and longitude must be supplied together';
  END IF;

  IF (v_pickup_lat IS NOT NULL
      AND (v_pickup_lat < -90 OR v_pickup_lat > 90))
     OR (v_dropoff_lat IS NOT NULL
      AND (v_dropoff_lat < -90 OR v_dropoff_lat > 90))
     OR (v_pickup_lon IS NOT NULL
      AND (v_pickup_lon < -180 OR v_pickup_lon > 180))
     OR (v_dropoff_lon IS NOT NULL
      AND (v_dropoff_lon < -180 OR v_dropoff_lon > 180))
  THEN
    RAISE EXCEPTION 'Invalid GPS coordinates';
  END IF;

  v_pickup_phone :=
    NULLIF(trim(p_details->>'pickup_contact_mobile'), '');

  v_dropoff_phone :=
    NULLIF(trim(p_details->>'dropoff_contact_mobile'), '');

  -- E.164 worldwide telephone number format.
  IF (v_pickup_phone IS NOT NULL
      AND v_pickup_phone !~ '^\+[1-9][0-9]{1,14}$')
     OR (v_dropoff_phone IS NOT NULL
      AND v_dropoff_phone !~ '^\+[1-9][0-9]{1,14}$')
  THEN
    RAISE EXCEPTION
      'Contact numbers must use international format';
  END IF;

  UPDATE public.dispatch_requests
  SET
    pickup_province =
      NULLIF(trim(p_details->>'pickup_province'), ''),
    pickup_town =
      NULLIF(trim(p_details->>'pickup_town'), ''),
    pickup_address =
      trim(p_details->>'pickup_address'),
    pickup_site_name =
      NULLIF(trim(p_details->>'pickup_site_name'), ''),
    pickup_gps_lat = v_pickup_lat,
    pickup_gps_lon = v_pickup_lon,
    pickup_contact_name =
      NULLIF(trim(p_details->>'pickup_contact_name'), ''),
    pickup_contact_mobile = v_pickup_phone,

    dropoff_province =
      NULLIF(trim(p_details->>'dropoff_province'), ''),
    dropoff_town =
      NULLIF(trim(p_details->>'dropoff_town'), ''),
    dropoff_address =
      trim(p_details->>'dropoff_address'),
    dropoff_site_name =
      NULLIF(trim(p_details->>'dropoff_site_name'), ''),
    dropoff_gps_lat = v_dropoff_lat,
    dropoff_gps_lon = v_dropoff_lon,
    dropoff_contact_name =
      NULLIF(trim(p_details->>'dropoff_contact_name'), ''),
    dropoff_contact_mobile = v_dropoff_phone,

    updated_at = now()
  WHERE id = p_request_id
    AND customer_id = v_customer;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_update_dispatch_location_details(uuid,jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_update_dispatch_location_details(uuid,jsonb)
TO authenticated;


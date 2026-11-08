

-- Shop&Drop dispatch provider job details.
-- Worldwide compatible. No payment activation.
-- Private disclosure only to the assigned provider
-- after the booking has confirmed payment.

CREATE OR REPLACE FUNCTION
public.shopdrop_get_assigned_dispatch_job_details(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider uuid;
  v_details jsonb;
BEGIN
  v_provider := auth.uid();

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking ID required';
  END IF;

  SELECT jsonb_build_object(
    'booking_id', b.id,
    'request_id', r.id,
    'vehicle_type', r.vehicle_type,
    'load_description', r.load_description,
    'required_at', r.required_at,
    'pickup_area', r.pickup_area,
    'pickup_province', r.pickup_province,
    'pickup_town', r.pickup_town,
    'pickup_address', r.pickup_address,
    'pickup_site_name', r.pickup_site_name,
    'pickup_gps_lat', r.pickup_gps_lat,
    'pickup_gps_lon', r.pickup_gps_lon,
    'pickup_contact_name', r.pickup_contact_name,
    'pickup_contact_mobile', r.pickup_contact_mobile,
    'dropoff_area', r.dropoff_area,
    'dropoff_province', r.dropoff_province,
    'dropoff_town', r.dropoff_town,
    'dropoff_address', r.dropoff_address,
    'dropoff_site_name', r.dropoff_site_name,
    'dropoff_gps_lat', r.dropoff_gps_lat,
    'dropoff_gps_lon', r.dropoff_gps_lon,
    'dropoff_contact_name', r.dropoff_contact_name,
    'dropoff_contact_mobile', r.dropoff_contact_mobile,
    'delivery_required_at', r.delivery_required_at,
    'loading_instructions', r.loading_instructions,
    'unloading_instructions', r.unloading_instructions,
    'site_access_instructions', r.site_access_instructions,
    'special_requirements', r.special_requirements
  )
  INTO v_details
  FROM public.dispatch_bookings b
  JOIN public.dispatch_requests r
    ON r.id = b.request_id
  WHERE b.id = p_booking_id
    AND b.provider_id = v_provider
    AND b.customer_id = r.customer_id
    AND b.payment_status = 'paid'
    AND b.booking_status NOT IN (
      'cancelled',
      'refunded',
      'failed'
    );

  IF v_details IS NULL THEN
    RAISE EXCEPTION
      'Job details unavailable or not authorized';
  END IF;

  RETURN v_details;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_get_assigned_dispatch_job_details(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_get_assigned_dispatch_job_details(uuid)
TO authenticated;

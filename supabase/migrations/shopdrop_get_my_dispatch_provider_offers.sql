
-- Shop&Drop: Provider's own dispatch offers.
-- Additive function. Existing code preserved.
-- International database architecture preserved.
-- No private customer contact details exposed.

CREATE OR REPLACE FUNCTION
public.shopdrop_get_my_dispatch_provider_offers(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider uuid;
  v_result jsonb;
BEGIN
  v_provider := auth.uid();

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'offer_id', q.offer_id,
        'request_id', q.request_id,
        'request_reference', q.request_reference,
        'vehicle_type', q.vehicle_type,
        'pickup_area', q.pickup_area,
        'dropoff_area', q.dropoff_area,
        'required_at', q.required_at,
        'vehicle_description', q.vehicle_description,
        'provider_amount', q.provider_amount,
        'currency', q.currency,
        'offer_status', q.offer_status,
        'valid_until', q.valid_until,
        'created_at', q.created_at,
        'booking_id', q.booking_id,
        'booking_status', q.booking_status,
        'payment_status', q.payment_status
      )
      ORDER BY q.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      o.id AS offer_id,
      o.request_id,
      r.request_ref AS request_reference,
      r.vehicle_type,
      r.pickup_area,
      r.dropoff_area,
      r.required_at,
      o.vehicle_description,
      o.provider_amount,
      o.currency,
      o.offer_status,
      o.valid_until,
      o.created_at,
      b.id AS booking_id,
      b.booking_status,
      b.payment_status
    FROM public.dispatch_offers o
    JOIN public.dispatch_requests r
      ON r.id = o.request_id
    LEFT JOIN public.dispatch_bookings b
      ON b.offer_id = o.id
      AND b.provider_id = v_provider
    WHERE o.provider_id = v_provider
    ORDER BY o.created_at DESC
    LIMIT LEAST(
      GREATEST(COALESCE(p_limit,50),1),
      100
    )
  ) q;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
public.shopdrop_get_my_dispatch_provider_offers(integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.shopdrop_get_my_dispatch_provider_offers(integer)
TO authenticated;


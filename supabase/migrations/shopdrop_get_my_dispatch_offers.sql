
CREATE OR REPLACE FUNCTION public.shopdrop_get_my_dispatch_offers(
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer uuid;
  v_result jsonb;
BEGIN
  v_customer := auth.uid();

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'request_id', r.id,
        'request_reference', r.request_ref,
        'request_status', r.status,
        'offers', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'offer_id', o.id,
                'vehicle_description', o.vehicle_description,
                'provider_amount', o.provider_amount,
                'currency', o.currency,
                'offer_status', o.offer_status,
                'valid_until', o.valid_until
              )
              ORDER BY o.created_at DESC
            )
            FROM public.dispatch_offers o
            WHERE o.request_id = r.id
              AND o.offer_status = 'pending'
              AND (
                o.valid_until IS NULL
                OR o.valid_until > now()
              )
              AND r.status = 'open'
          ),
          '[]'::jsonb
        )
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.dispatch_requests r
  WHERE r.customer_id = v_customer
    AND (
      p_request_id IS NULL
      OR r.id = p_request_id
    );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.shopdrop_get_my_dispatch_offers(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.shopdrop_get_my_dispatch_offers(uuid)
TO authenticated;


-- Fix 199L: select only enabled notification channels; preserve existing claim RPC.
CREATE FUNCTION public.shopdrop_claim_outbox_channels_199l(p_limit integer, p_channels text[])
RETURNS SETOF public.message_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'backend_only';
  END IF;
  IF p_channels IS NULL OR cardinality(p_channels)=0 THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_channels) c WHERE c IS NULL OR c NOT IN ('email','whatsapp')) THEN
    RAISE EXCEPTION 'unsupported_channel';
  END IF;
  RETURN QUERY
  WITH claimed AS (
    SELECT m.id
    FROM public.message_outbox m
    WHERE m.status = 'pending'
      AND m.channel = ANY(p_channels)
      AND m.next_attempt_at <= now()
      AND m.attempt_count < m.max_attempts
    ORDER BY m.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(p_limit, 1), 25)
  )
  UPDATE public.message_outbox m
  SET status = 'processing',
      attempt_count = m.attempt_count + 1,
      updated_at = now()
  FROM claimed
  WHERE m.id = claimed.id
  RETURNING m.*;
END;
$function$;
REVOKE ALL ON FUNCTION public.shopdrop_claim_outbox_channels_199l(integer,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_claim_outbox_channels_199l(integer,text[]) TO service_role;

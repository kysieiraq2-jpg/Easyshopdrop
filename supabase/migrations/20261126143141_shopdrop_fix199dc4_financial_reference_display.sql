-- Fix 199D-C4: read-only dispatch payment and provider release reference display.
CREATE FUNCTION public.shopdrop_my_provider_financial_references_199dc4(p_view text)
RETURNS TABLE(record_kind text,record_id uuid,booking_id uuid,advertisement_reference text,offer_reference text,payment_reference text,release_reference text,recorded_amount numeric,currency text,recorded_status text,recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='28000'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('receipt','payout') THEN RAISE EXCEPTION 'Invalid view' USING ERRCODE='22023'; END IF;
 IF p_view='receipt' THEN
  RETURN QUERY
  SELECT CASE WHEN b.customer_id=u THEN 'dispatch_customer_payment' ELSE 'dispatch_provider_payment_record' END,
   p.id,b.id,b.advertisement_reference_snapshot,b.offer_reference_snapshot,p.payment_reference,NULL::text,
   CASE WHEN b.customer_id=u THEN p.gross_amount ELSE p.provider_amount END,p.currency,
   p.payment_status,p.created_at
  FROM public.dispatch_payments p JOIN public.dispatch_bookings b ON b.id=p.booking_id
  WHERE u IN(b.customer_id,b.provider_id)
  ORDER BY p.created_at DESC,p.id LIMIT 50;
 END IF;
 -- These are requests, not proof of bank settlement. Payee-only, with exact booking identity.
 RETURN QUERY
 SELECT 'service_release_request'::text,r.id,b.id,b.advertisement_reference_snapshot,NULL::text,
  r.payment_reference,r.provider_release_reference,r.amount,r.currency,r.release_status,r.created_at
 FROM public.shopdrop_provider_release_requests r
 JOIN public.service_bookings b ON r.booking_type='service' AND b.id=r.booking_id AND b.provider_id=r.payee_id
 WHERE r.payee_id=u AND b.provider_id=u
 ORDER BY r.created_at DESC,r.id LIMIT 50;
 RETURN QUERY
 SELECT 'dispatch_release_request'::text,r.id,b.id,b.advertisement_reference_snapshot,b.offer_reference_snapshot,
  r.payment_reference,r.provider_release_reference,r.amount,r.currency,r.release_status,r.created_at
 FROM public.shopdrop_provider_release_requests r
 JOIN public.dispatch_bookings b ON r.booking_type='dispatch' AND b.id=r.booking_id AND b.provider_id=r.payee_id
 WHERE r.payee_id=u AND b.provider_id=u
 ORDER BY r.created_at DESC,r.id LIMIT 50;
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_my_provider_financial_references_199dc4(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_my_provider_financial_references_199dc4(text) TO authenticated;

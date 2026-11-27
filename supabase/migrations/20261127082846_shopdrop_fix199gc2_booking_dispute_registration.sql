-- Fix 199G-C2: customer-owned service and transport disputes.
-- Existing payment verification, PIN, settlement and release workers are untouched.
CREATE FUNCTION public.shopdrop_open_booking_dispute_199gc(p_booking_type text,p_booking_id uuid,p_reason text,p_description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 u uuid:=auth.uid(); k text:=p_booking_type;
 reason text:=lower(btrim(coalesce(p_reason,''))); details text:=btrim(coalesce(p_description,''));
 sb public.service_bookings%ROWTYPE; db public.dispatch_bookings%ROWTYPE;
 provider uuid; payid uuid; payment_count integer; payout_state text; advert text;
 case_id uuid; ref text; hold_recorded boolean:=false;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='28000'; END IF;
 IF k IS NULL OR k NOT IN ('service','dispatch') OR p_booking_id IS NULL
 OR reason NOT IN ('not_completed','not_as_described','damaged','late','other')
 OR length(details) NOT BETWEEN 1 AND 5000 THEN
  RAISE EXCEPTION 'Invalid dispute details' USING ERRCODE='22023';
 END IF;
 -- Same booking row lock used by the existing completion PIN flow.
 IF k='service' THEN
  SELECT * INTO sb FROM public.service_bookings b WHERE b.id=p_booking_id AND b.buyer_id=u FOR UPDATE;
  IF NOT FOUND OR sb.provider_id=u THEN RAISE EXCEPTION 'Booking unavailable or access denied' USING ERRCODE='42501'; END IF;
  provider:=sb.provider_id; advert:=sb.advertisement_reference_snapshot;
  SELECT d.id,d.customer_dispute_reference INTO case_id,ref FROM public.service_disputes d
  WHERE d.booking_id=sb.id AND d.buyer_id=u AND d.provider_id=provider AND d.resolved_at IS NULL
  AND d.dispute_status NOT IN ('resolved','closed','rejected','cancelled','canceled')
  ORDER BY d.created_at DESC,d.id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'booking_type',k,'booking_id',p_booking_id,'dispute_id',case_id,'dispute_reference',coalesce(ref,case_id::text),'duplicate',true); END IF;
  IF sb.payment_status IS DISTINCT FROM 'paid' OR sb.booking_status IN ('cancelled','canceled','refunded') THEN
   RAISE EXCEPTION 'Verified paid booking required' USING ERRCODE='23514';
  END IF;
  SELECT count(*),min(p.id::text)::uuid INTO payment_count,payid FROM public.service_payments p
  WHERE p.booking_id=sb.id AND p.buyer_id=u AND p.provider_id=provider
  AND p.payment_status='paid' AND p.paid_at IS NOT NULL AND p.provider_amount>0 AND p.commission_amount>=0
  AND p.gross_amount=p.provider_amount+p.commission_amount
  AND length(btrim(coalesce(p.payment_reference,''))) BETWEEN 5 AND 256
  AND EXISTS(SELECT 1 FROM public.shopdrop_service_dispatch_payment_evidence e
   WHERE e.payment_kind='service' AND e.payment_id=p.id AND e.verification_status='verified');
 ELSE
  SELECT * INTO db FROM public.dispatch_bookings b WHERE b.id=p_booking_id AND b.customer_id=u FOR UPDATE;
  IF NOT FOUND OR db.provider_id=u THEN RAISE EXCEPTION 'Booking unavailable or access denied' USING ERRCODE='42501'; END IF;
  provider:=db.provider_id; advert:=coalesce(db.advertisement_reference_snapshot,db.offer_reference_snapshot);
  SELECT d.id,d.customer_dispute_reference INTO case_id,ref FROM public.shopdrop_dispatch_disputes_199gc d
  WHERE d.booking_id=db.id AND d.customer_id=u AND d.provider_id=provider AND d.resolved_at IS NULL
  AND d.dispute_status NOT IN ('resolved','closed','rejected','cancelled','canceled')
  ORDER BY d.created_at DESC,d.id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'booking_type',k,'booking_id',p_booking_id,'dispute_id',case_id,'dispute_reference',ref,'duplicate',true); END IF;
  IF db.payment_status IS DISTINCT FROM 'paid' OR db.booking_status='cancelled' THEN
   RAISE EXCEPTION 'Verified paid booking required' USING ERRCODE='23514';
  END IF;
  SELECT count(*),min(p.id::text)::uuid INTO payment_count,payid FROM public.dispatch_payments p
  WHERE p.booking_id=db.id AND p.payment_status='paid' AND p.paid_at IS NOT NULL
  AND p.provider_amount=db.provider_amount AND p.provider_amount>0 AND p.commission_amount>=0
  AND p.gross_amount=p.provider_amount+p.commission_amount AND p.currency=db.currency
  AND length(btrim(coalesce(p.payment_reference,''))) BETWEEN 5 AND 256
  AND EXISTS(SELECT 1 FROM public.shopdrop_service_dispatch_payment_evidence e
   WHERE e.payment_kind='dispatch' AND e.payment_id=p.id AND e.verification_status='verified');
 END IF;
 IF payment_count IS DISTINCT FROM 1 OR payid IS NULL THEN
  RAISE EXCEPTION 'Exactly one verified paid booking payment required' USING ERRCODE='23514';
 END IF;
 ref:=public.generate_shopdrop_reference('SD-DSP');
 IF k='service' THEN
  INSERT INTO public.service_disputes(booking_id,buyer_id,provider_id,customer_dispute_reference,dispute_reason,dispute_details)
  VALUES(p_booking_id,u,provider,ref,reason,details) RETURNING id INTO case_id;
 ELSE
  INSERT INTO public.shopdrop_dispatch_disputes_199gc(booking_id,customer_id,provider_id,customer_dispute_reference,dispute_reason,dispute_details)
  VALUES(p_booking_id,u,provider,ref,reason,details) RETURNING id INTO case_id;
  -- Connect to the existing booking-specific hold check, without changing
  -- the release algorithm, reversing funds or claiming an external bank hold.
  SELECT p.provider_payout_status INTO payout_state FROM public.dispatch_payments p WHERE p.id=payid FOR UPDATE;
  IF payout_state IS DISTINCT FROM 'paid' AND NOT EXISTS(
   SELECT 1 FROM public.shopdrop_provider_release_requests r
   WHERE r.booking_type='dispatch' AND r.booking_id=p_booking_id AND r.release_status='confirmed'
  ) THEN
   INSERT INTO public.shopdrop_dispatch_payout_holds(booking_id,provider_id,hold_reason)
   VALUES(p_booking_id,provider,'Customer dispute: '||ref)
   ON CONFLICT(booking_id) WHERE hold_status='active' DO NOTHING;
   hold_recorded:=EXISTS(SELECT 1 FROM public.shopdrop_dispatch_payout_holds h
    WHERE h.booking_id=p_booking_id AND h.provider_id=provider AND h.hold_status='active');
   IF NOT hold_recorded THEN RAISE EXCEPTION 'Existing transport hold identity requires reconciliation'; END IF;
  END IF;
 END IF;
 INSERT INTO public.integration_events(event_type,entity_type,entity_id,external_reference,idempotency_key,payload,status)
 VALUES('payment_dispute_opened',CASE WHEN k='service' THEN 'service_dispute' ELSE 'dispatch_dispute' END,case_id,ref,
 'customer-dispute:'||case_id::text,jsonb_build_object('user_id',u,'dispute_reference',ref,'dispute_id',case_id,
 'booking_type',k,'booking_id',p_booking_id,'payment_id',payid,'transaction_reference',p_booking_id::text,
 'advertisement_reference',advert,'reason',reason,'description',details,'created_at',now()),'received');
 RETURN jsonb_build_object('ok',true,'booking_type',k,'booking_id',p_booking_id,'dispute_id',case_id,
 'dispute_reference',ref,'duplicate',false,'transport_internal_hold_recorded',hold_recorded);
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_open_booking_dispute_199gc(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_open_booking_dispute_199gc(text,uuid,text,text) TO authenticated;

-- Fix 199G-B1: attach eligible customer disputes to real evidence-capable cases.
-- Existing payout, refund, provider webhook and administrative review rules unchanged.
ALTER TABLE public.disputes ADD COLUMN customer_dispute_reference text;
CREATE UNIQUE INDEX shopdrop_customer_dispute_reference_199gb
 ON public.disputes(customer_dispute_reference) WHERE customer_dispute_reference IS NOT NULL;

CREATE FUNCTION public.shopdrop_open_product_dispute_199gb(p_user_id uuid,p_order_id uuid,p_reason text,p_description text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $fn$
DECLARE o public.orders%ROWTYPE; d public.disputes%ROWTYPE; payid uuid; ref text;
 reason text:=lower(btrim(coalesce(p_reason,''))); details text:=btrim(coalesce(p_description,''));
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'backend_only' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR p_order_id IS NULL OR reason NOT IN ('not_received','damaged','wrong_item','not_as_described','other')
    OR length(details) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'invalid_dispute_details' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND buyer_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR o.seller_id IS NULL OR o.seller_id=p_user_id THEN RAISE EXCEPTION 'order_not_found_or_not_owned' USING ERRCODE='42501'; END IF;
 -- Serialize customer cases on the order. Reuse the existing active case on retries.
 SELECT * INTO d FROM public.disputes x
 WHERE x.order_id=o.id AND x.buyer_id=o.buyer_id AND x.seller_id=o.seller_id
 AND x.customer_dispute_reference IS NOT NULL AND x.external_payment_dispute=false
 AND x.resolved_at IS NULL AND x.dispute_status NOT IN ('resolved','closed','cancelled','canceled')
 ORDER BY x.created_at DESC,x.id LIMIT 1;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',true,'dispute_id',d.id,'dispute_reference',d.customer_dispute_reference,'status','existing_case','duplicate',true);
 END IF;
 IF o.payment_status IS DISTINCT FROM 'paid' OR o.order_status IN ('cancelled','canceled','refunded') THEN
  RAISE EXCEPTION 'paid_order_required_for_dispute' USING ERRCODE='23514';
 END IF;
 SELECT p.id INTO payid FROM public.payments p
 WHERE p.order_id=o.id AND p.buyer_id=o.buyer_id AND p.seller_id=o.seller_id
 AND p.currency=o.currency AND p.payment_status='paid' AND p.paid_at IS NOT NULL
 AND p.total_paid>0
 ORDER BY p.paid_at DESC,p.id LIMIT 1;
 IF payid IS NULL THEN RAISE EXCEPTION 'paid_order_required_for_dispute' USING ERRCODE='23514'; END IF;
 ref:=public.generate_shopdrop_reference('SD-DSP');
 INSERT INTO public.disputes(order_id,buyer_id,seller_id,dispute_reason,dispute_details,customer_dispute_reference)
 VALUES(o.id,o.buyer_id,o.seller_id,reason,details,ref) RETURNING * INTO d;
 -- Keep the existing customer-support queue and link it to the same case atomically.
 INSERT INTO public.integration_events(event_type,entity_type,entity_id,external_reference,idempotency_key,payload,status)
 VALUES('payment_dispute_opened','dispute',d.id,ref,'customer-dispute:'||d.id::text,
 jsonb_build_object('user_id',o.buyer_id,'dispute_reference',ref,'dispute_id',d.id,'order_id',o.id,
 'payment_id',payid,'transaction_reference',o.order_reference,'reason',reason,'description',details,'created_at',now()),'received');
 RETURN jsonb_build_object('ok',true,'dispute_id',d.id,'dispute_reference',ref,'status','submitted','duplicate',false);
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_open_product_dispute_199gb(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_open_product_dispute_199gb(uuid,uuid,text,text) TO service_role;

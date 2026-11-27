-- Fix 199F-A: read-only administrator reconciliation across all marketplace categories.
-- Do not aggregate payments, allocations, release requests and payouts as revenue.
-- Never infer settlement or change payment, refund, release, or payout status.
CREATE FUNCTION public.shopdrop_admin_financial_records_199fa(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(category text,record_type text,record_id uuid,order_id uuid,booking_id uuid,shipment_id uuid,
 transaction_reference text,advertisement_references text,record_reference text,provider_reference text,
 recorded_status text,currency text,recorded_amount numeric,customer_payment numeric,sale_service_amount numeric,
 shopdrop_fee numeric,courier_amount numeric,refund_amount numeric,provider_proceeds numeric,payout_amount numeric,
 release_request_amount numeric,recorded_event_at timestamptz,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.shopdrop_is_active_admin() THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN
  RAISE EXCEPTION 'Invalid financial record page' USING ERRCODE='22023';
 END IF;
 RETURN QUERY
 WITH records AS (
  SELECT 'product'::text cat,'payment'::text kind,p.id rid,p.order_id oid,NULL::uuid bid,NULL::uuid sid,
   p.payment_reference ref,p.provider_payment_reference pref,p.payment_status st,p.currency cur,p.total_paid amt,
   p.total_paid customer,p.product_amount sale,p.shopdrop_commission fee,p.courier_amount courier,
   NULL::numeric refund,p.seller_payout_amount proceeds,NULL::numeric payout,NULL::numeric release,p.paid_at event_at,p.created_at ts
  FROM public.payments p
  UNION ALL
  SELECT 'product','allocation:'||a.allocation_type,a.id,a.order_id,NULL,NULL,
   NULL,a.provider_settlement_reference,a.status,a.currency,a.amount,
   NULL,NULL,CASE WHEN a.allocation_type='shopdrop_commission' THEN a.amount END,
   CASE WHEN a.allocation_type='courier' THEN a.amount END,NULL,
   CASE WHEN a.allocation_type='seller' THEN a.amount END,NULL,NULL,a.settled_at,a.created_at
  FROM public.payment_allocations a
  UNION ALL
  SELECT 'product','refund',r.id,r.order_id,NULL,NULL,r.refund_reference,r.provider_refund_reference,r.refund_status,
   p.currency,r.refund_amount,NULL,NULL,NULL,NULL,r.refund_amount,NULL,NULL,NULL,r.processed_at,r.created_at
  FROM public.refunds r LEFT JOIN public.payments p ON p.id=r.payment_id AND p.order_id=r.order_id
  UNION ALL
  SELECT 'product','seller_payout',s.id,s.order_id,NULL,NULL,s.payout_reference,NULL,s.payout_status,o.currency,s.payout_amount,
   NULL,NULL,NULL,NULL,NULL,NULL,s.payout_amount,NULL,s.paid_at,s.created_at
  FROM public.seller_payouts s LEFT JOIN public.orders o ON o.id=s.order_id
  UNION ALL
  SELECT 'service','payment',p.id,NULL,p.booking_id,NULL,p.payment_reference,NULL,p.payment_status,NULL,p.gross_amount,
   p.gross_amount,p.provider_amount,p.commission_amount,NULL,NULL,p.provider_amount,NULL,NULL,p.paid_at,p.created_at
  FROM public.service_payments p
  UNION ALL
  SELECT 'service','refund',r.id,NULL,r.booking_id,NULL,r.refund_reference,NULL,r.refund_status,NULL,r.refund_amount,
   NULL,NULL,NULL,NULL,r.refund_amount,NULL,NULL,NULL,r.processed_at,r.created_at
  FROM public.service_refunds r
  UNION ALL
  SELECT 'service','provider_payout',s.id,NULL,s.booking_id,NULL,s.payout_reference,NULL,s.payout_status,NULL,s.payout_amount,
   NULL,NULL,NULL,NULL,NULL,NULL,s.payout_amount,NULL,s.paid_at,s.created_at
  FROM public.service_provider_payouts s
  UNION ALL
  SELECT 'dispatch','payment',p.id,NULL,p.booking_id,NULL,p.payment_reference,NULL,p.payment_status,p.currency,p.gross_amount,
   p.gross_amount,p.provider_amount,p.commission_amount,NULL,NULL,p.provider_amount,NULL,NULL,p.paid_at,p.created_at
  FROM public.dispatch_payments p
  UNION ALL
  SELECT r.booking_type,'release_request',r.id,
   CASE WHEN r.booking_type='product' THEN sh.order_id END,
   CASE WHEN r.booking_type IN ('service','dispatch') THEN r.booking_id END,
   CASE WHEN r.booking_type='product' THEN sh.id END,
   r.payment_reference,r.provider_release_reference,r.release_status,r.currency,r.amount,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,r.amount,NULL,r.created_at
  FROM public.shopdrop_provider_release_requests r
  LEFT JOIN public.shipments sh ON r.booking_type='product' AND sh.id=r.booking_id AND sh.seller_id=r.payee_id
  WHERE r.booking_type IN ('product','service','dispatch')
 ), page AS (
  SELECT x.* FROM records x ORDER BY x.ts DESC NULLS LAST,x.kind,x.rid DESC LIMIT p_limit OFFSET p_offset
 )
 SELECT x.cat,x.kind,x.rid,x.oid,x.bid,x.sid,
  CASE WHEN x.cat='product' THEN o.order_reference ELSE x.bid::text END,
  CASE WHEN x.cat='product' THEN
    (SELECT string_agg(DISTINCT i.listing_reference_snapshot,', ' ORDER BY i.listing_reference_snapshot)
     FROM public.order_items i WHERE i.order_id=x.oid)
   WHEN x.cat='service' THEN sb.advertisement_reference_snapshot
   WHEN x.cat='dispatch' THEN coalesce(db.advertisement_reference_snapshot,db.offer_reference_snapshot)
  END,
  x.ref,x.pref,x.st,x.cur,x.amt,x.customer,x.sale,x.fee,x.courier,x.refund,x.proceeds,x.payout,x.release,x.event_at,x.ts
 FROM page x
 LEFT JOIN public.orders o ON x.cat='product' AND o.id=x.oid
 LEFT JOIN public.service_bookings sb ON x.cat='service' AND sb.id=x.bid
 LEFT JOIN public.dispatch_bookings db ON x.cat='dispatch' AND db.id=x.bid
 ORDER BY x.ts DESC NULLS LAST,x.kind,x.rid DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_admin_financial_records_199fa(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_admin_financial_records_199fa(integer,integer) TO authenticated;

-- Fix 199D-C3: read-only reference connections. No new transaction or payment path.
CREATE FUNCTION public.shopdrop_my_advert_references_199dc3(p_kind text,p_ids uuid[])
RETURNS TABLE(record_id uuid,advertisement_reference text,offer_reference text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='28000'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('service_bag','transport_bag','service_booking','dispatch_booking') THEN
  RAISE EXCEPTION 'Invalid record type' USING ERRCODE='22023';
 END IF;
 IF p_ids IS NULL OR cardinality(p_ids)=0 THEN RETURN; END IF;
 IF cardinality(p_ids)>60 THEN RAISE EXCEPTION 'Too many references' USING ERRCODE='22023'; END IF;
 IF p_kind='service_bag' THEN
  RETURN QUERY SELECT b.id,b.advertisement_reference_snapshot,NULL::text
  FROM shopdrop_service_193c.bag b WHERE b.id=ANY(p_ids) AND b.buyer_id=u;
 ELSIF p_kind='transport_bag' THEN
  RETURN QUERY SELECT b.id,b.advertisement_reference_snapshot,d.offer_reference_snapshot
  FROM shopdrop_transport_192dc.bag b LEFT JOIN public.dispatch_bookings d
   ON d.id=b.dispatch_booking_id AND d.customer_id=u AND d.provider_id=b.provider_id
  WHERE b.id=ANY(p_ids) AND b.customer_id=u;
 ELSIF p_kind='service_booking' THEN
  RETURN QUERY SELECT b.id,b.advertisement_reference_snapshot,NULL::text
  FROM public.service_bookings b WHERE b.id=ANY(p_ids) AND u IN(b.buyer_id,b.provider_id);
 ELSE
  RETURN QUERY SELECT b.id,b.advertisement_reference_snapshot,b.offer_reference_snapshot
  FROM public.dispatch_bookings b WHERE b.id=ANY(p_ids) AND u IN(b.customer_id,b.provider_id);
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_my_advert_references_199dc3(text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_my_advert_references_199dc3(text,uuid[]) TO authenticated,service_role;

-- Extend the existing public identity function only for approved transport ads.
-- Preserve every existing product, service and dispatch offer branch.
DO $patch$
DECLARE
 src text:=pg_get_functiondef('public.shopdrop_public_listing_identity(text,uuid[])'::regprocedure);
 a text:=$a$'product','service','dispatch_offer'$a$;
 b text:=$a$  ELSE
    IF (select auth.uid()) IS NULL THEN RETURN; END IF;$a$;
BEGIN
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 OR
    (length(src)-length(replace(src,b,'')))/length(b)<>1 THEN RAISE EXCEPTION 'identity source changed'; END IF;
 src:=replace(src,a,$a$'product','service','dispatch_offer','vehicle_advert'$a$);
 src:=replace(src,b,$a$  ELSIF p_kind='vehicle_advert' THEN
    RETURN QUERY
    SELECT v.id, NULLIF(btrim(pr.seller_public_alias),''),
           'SD-ADV-'||lpad(pr.advertiser_public_number::text,8,'0'),
           'SD-TRN-AD-'||lpad(v.listing_public_number::text,greatest(8,length(v.listing_public_number::text)),'0')
    FROM public.shopdrop_vehicle_adverts v
    JOIN public.profiles pr ON pr.id=v.provider_id
    WHERE v.id=ANY(v_ids) AND v.listing_status='approved';
  ELSE
    IF (select auth.uid()) IS NULL THEN RETURN; END IF;$a$);
 EXECUTE src;
END $patch$;

-- Existing complaints can resolve the new transport number or the legacy UUID.
DO $patch$
DECLARE
 src text:=pg_get_functiondef('public.shopdrop_resolve_listing_report_199b(uuid,text,text)'::regprocedure);
 a text:=$a$select 'vehicle_advert',v.id,v.id::text from public.shopdrop_vehicle_adverts v$a$;
 b text:=$a$and v.listing_status='approved' and upper(v.id::text)=r$a$;
BEGIN
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 OR
    (length(src)-length(replace(src,b,'')))/length(b)<>1 THEN RAISE EXCEPTION 'report resolver source changed'; END IF;
 src:=replace(src,a,$a$select 'vehicle_advert',v.id,'SD-TRN-AD-'||lpad(v.listing_public_number::text,greatest(8,length(v.listing_public_number::text)),'0') from public.shopdrop_vehicle_adverts v$a$);
 src:=replace(src,b,$a$and v.listing_status='approved' and (upper(v.id::text)=r or 'SD-TRN-AD-'||lpad(v.listing_public_number::text,greatest(8,length(v.listing_public_number::text)),'0')=r)$a$);
 EXECUTE src;
END $patch$;

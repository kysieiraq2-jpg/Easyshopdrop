-- Fix 199H-B: read-only links from support submissions to their exact dispute evidence.
CREATE FUNCTION public.shopdrop_admin_submission_evidence_199hb(p_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE e public.integration_events%ROWTYPE; k text; linked uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.shopdrop_is_active_admin() THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO e FROM public.integration_events
 WHERE id=p_case_id AND event_type='payment_dispute_opened';
 IF NOT FOUND OR e.entity_id IS NULL THEN RETURN NULL; END IF;
 k:=shopdrop_service_193c.evidence_case_kind_199gc(e.entity_id);
 IF k='product' AND e.entity_type='dispute' THEN
  SELECT d.id INTO linked FROM public.disputes d
  WHERE d.id=e.entity_id AND d.customer_dispute_reference=e.external_reference
   AND d.buyer_id::text=e.payload->>'user_id' AND d.order_id::text=e.payload->>'order_id';
 ELSIF k='service' AND e.entity_type='service_dispute' THEN
  SELECT d.id INTO linked FROM public.service_disputes d
  WHERE d.id=e.entity_id AND d.customer_dispute_reference=e.external_reference
   AND d.buyer_id::text=e.payload->>'user_id' AND d.booking_id::text=e.payload->>'booking_id';
 ELSIF k='dispatch' AND e.entity_type='dispatch_dispute' THEN
  SELECT d.id INTO linked FROM public.shopdrop_dispatch_disputes_199gc d
  WHERE d.id=e.entity_id AND d.customer_dispute_reference=e.external_reference
   AND d.customer_id::text=e.payload->>'user_id' AND d.booking_id::text=e.payload->>'booking_id';
 END IF;
 IF linked IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('dispute_id',linked,'dispute_kind',k,'dispute_reference',e.external_reference);
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_admin_submission_evidence_199hb(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_admin_submission_evidence_199hb(uuid) TO authenticated;

CREATE FUNCTION public.shopdrop_admin_evidence_for_case_199hb(p_dispute_id uuid)
RETURNS TABLE(evidence_id uuid, dispute_id uuid, evidence_type text, description text, mime_type text, file_size_bytes bigint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE k text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.shopdrop_is_active_admin() THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 k:=shopdrop_service_193c.evidence_case_kind_199gc(p_dispute_id);
 IF k IS NULL THEN RAISE EXCEPTION 'Dispute unavailable' USING ERRCODE='P0002'; END IF;
 RETURN QUERY SELECT e.id,p_dispute_id,e.evidence_type,e.description,e.mime_type,e.file_size_bytes,e.created_at
 FROM public.dispute_evidence e
 WHERE (k='product' AND e.dispute_id=p_dispute_id)
 OR (k='service' AND e.service_dispute_id=p_dispute_id)
 OR (k='dispatch' AND e.dispatch_dispute_id=p_dispute_id)
 ORDER BY e.created_at DESC,e.id DESC LIMIT 100;
END $fn$;
REVOKE ALL ON FUNCTION public.shopdrop_admin_evidence_for_case_199hb(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_admin_evidence_for_case_199hb(uuid) TO authenticated;

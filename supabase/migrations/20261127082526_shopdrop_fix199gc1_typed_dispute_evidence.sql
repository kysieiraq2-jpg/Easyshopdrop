-- Fix 199G-C1: typed, private case evidence for products, services and transport.
-- Does not create customer disputes, change booking status, or initiate financial actions.
ALTER TABLE public.service_disputes ADD COLUMN customer_dispute_reference text;
CREATE UNIQUE INDEX shopdrop_service_dispute_reference_199gc
 ON public.service_disputes(customer_dispute_reference) WHERE customer_dispute_reference IS NOT NULL;
CREATE TABLE public.shopdrop_dispatch_disputes_199gc(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.dispatch_bookings(id),
 customer_id uuid NOT NULL REFERENCES auth.users(id),
 provider_id uuid NOT NULL REFERENCES auth.users(id),
 customer_dispute_reference text NOT NULL UNIQUE,
 dispute_reason text NOT NULL,
 dispute_details text NOT NULL,
 dispute_status text NOT NULL DEFAULT 'open',
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 CHECK(customer_id<>provider_id),
 CHECK(length(btrim(dispute_details)) BETWEEN 1 AND 5000)
);
ALTER TABLE public.shopdrop_dispatch_disputes_199gc ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shopdrop_dispatch_disputes_199gc FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.shopdrop_dispatch_disputes_199gc TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.shopdrop_dispatch_disputes_199gc TO service_role;
CREATE POLICY shopdrop_dispatch_dispute_participants_199gc
 ON public.shopdrop_dispatch_disputes_199gc FOR SELECT TO authenticated
 USING ((select auth.uid()) IN (customer_id,provider_id));
CREATE INDEX shopdrop_dispatch_dispute_booking_199gc ON public.shopdrop_dispatch_disputes_199gc(booking_id);
ALTER TABLE public.dispute_evidence ALTER COLUMN dispute_id DROP NOT NULL,
 ADD COLUMN service_dispute_id uuid REFERENCES public.service_disputes(id) ON DELETE RESTRICT,
 ADD COLUMN dispatch_dispute_id uuid REFERENCES public.shopdrop_dispatch_disputes_199gc(id) ON DELETE RESTRICT,
 ADD CONSTRAINT shopdrop_evidence_one_case_199gc CHECK(num_nonnulls(dispute_id,service_dispute_id,dispatch_dispute_id)=1);
CREATE INDEX shopdrop_evidence_service_case_199gc ON public.dispute_evidence(service_dispute_id);
CREATE INDEX shopdrop_evidence_dispatch_case_199gc ON public.dispute_evidence(dispatch_dispute_id);
-- Resolve a case only if exactly one typed case exists and the account participates,
-- or is an active administrator. Check booking identities as well as dispute identities.
CREATE FUNCTION shopdrop_service_193c.evidence_case_kind_199gc(p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT CASE WHEN count(*)=1 AND bool_and(c.permitted) THEN min(c.kind) END
 FROM (
  SELECT 'product'::text kind,(auth.uid() IN(d.buyer_id,d.seller_id) OR public.shopdrop_is_active_admin()) permitted
  FROM public.disputes d WHERE d.id=p_id
  UNION ALL
  SELECT 'service',(auth.uid() IN(d.buyer_id,d.provider_id) OR public.shopdrop_is_active_admin())
  FROM public.service_disputes d JOIN public.service_bookings b
    ON b.id=d.booking_id AND b.buyer_id=d.buyer_id AND b.provider_id=d.provider_id
  WHERE d.id=p_id
  UNION ALL
  SELECT 'dispatch',(auth.uid() IN(d.customer_id,d.provider_id) OR public.shopdrop_is_active_admin())
  FROM public.shopdrop_dispatch_disputes_199gc d JOIN public.dispatch_bookings b
    ON b.id=d.booking_id AND b.customer_id=d.customer_id AND b.provider_id=d.provider_id
  WHERE d.id=p_id
 ) c
 WHERE auth.uid() IS NOT NULL
$fn$;
REVOKE ALL ON FUNCTION shopdrop_service_193c.evidence_case_kind_199gc(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.shopdrop_can_upload_dispute_evidence(p_dispute_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT shopdrop_service_193c.evidence_case_kind_199gc(p_dispute_id) IS NOT NULL
$fn$;
CREATE OR REPLACE FUNCTION public.shopdrop_register_dispute_evidence(p_dispute_id uuid, p_storage_path text, p_evidence_type text, p_description text, p_original_filename text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_object storage.objects%rowtype; v_id uuid; v_mime text; v_size bigint; v_kind text;
begin
 if auth.uid() is null or p_dispute_id is null
  or not public.shopdrop_can_upload_dispute_evidence(p_dispute_id) then
  raise exception 'Dispute participant authorization required' using errcode='42501';
 end if;
 v_kind:=shopdrop_service_193c.evidence_case_kind_199gc(p_dispute_id);
 if v_kind IS NULL THEN RAISE EXCEPTION 'Dispute unavailable' USING ERRCODE='42501'; END IF;
 if p_storage_path is null
  or p_storage_path not like p_dispute_id::text||'/'||auth.uid()::text||'/%'
  or length(p_storage_path)>500
  or length(btrim(coalesce(p_evidence_type,''))) not between 2 and 80
  or length(coalesce(p_description,''))>2000
  or length(btrim(coalesce(p_original_filename,''))) not between 1 and 255 then
  raise exception 'Invalid evidence details' using errcode='22023';
 end if;
 select * into v_object from storage.objects
 where bucket_id='dispute-evidence' and name=p_storage_path
 and owner_id=auth.uid()::text;
 if not found then raise exception 'Uploaded evidence object not found or not owned by account' using errcode='P0002'; end if;
 v_mime:=v_object.metadata->>'mimetype';
 v_size:=nullif(v_object.metadata->>'size','')::bigint;
 if v_mime not in ('image/jpeg','image/png','image/webp','application/pdf')
  or v_size is null or v_size<1 or v_size>20971520 then
  raise exception 'Evidence file type or size invalid' using errcode='23514';
 end if;
 if exists(select 1 from public.dispute_evidence where storage_bucket='dispute-evidence' and storage_path=p_storage_path) then
  raise exception 'Evidence already registered' using errcode='23505';
 end if;
 insert into public.dispute_evidence
 (dispute_id,service_dispute_id,dispatch_dispute_id,submitted_by,storage_bucket,storage_path,evidence_type,description,original_filename,mime_type,file_size_bytes)
 values(CASE WHEN v_kind='product' THEN p_dispute_id END,CASE WHEN v_kind='service' THEN p_dispute_id END,CASE WHEN v_kind='dispatch' THEN p_dispute_id END,auth.uid(),'dispute-evidence',p_storage_path,btrim(p_evidence_type),
 nullif(btrim(coalesce(p_description,'')),''),btrim(p_original_filename),v_mime,v_size)
 returning id into v_id;
 return jsonb_build_object('evidence_id',v_id,'dispute_id',p_dispute_id,'registered',true);
end;
$function$;
CREATE OR REPLACE FUNCTION public.shopdrop_admin_dispute_evidence_overview()
 RETURNS TABLE(evidence_id uuid, dispute_id uuid, evidence_type text, description text, mime_type text, file_size_bytes bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.shopdrop_is_active_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 return query
 select e.id,coalesce(e.dispute_id,e.service_dispute_id,e.dispatch_dispute_id),e.evidence_type,e.description,e.mime_type,e.file_size_bytes,e.created_at
 from public.dispute_evidence e
 order by e.created_at desc,e.id desc
 limit 100;
end;
$function$;
CREATE OR REPLACE FUNCTION public.shopdrop_dispute_storage_read_allowed(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE parts text[]; u uuid:=auth.uid();
 pattern constant text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
 IF u IS NULL OR p_path IS NULL THEN RETURN false; END IF;
 parts:=storage.foldername(p_path);
 IF array_length(parts,1) IS DISTINCT FROM 2 OR parts[1] !~* pattern THEN RETURN false; END IF;
 IF parts[2] ~* pattern AND public.shopdrop_can_upload_dispute_evidence(parts[1]::uuid) THEN
  IF parts[2]=u::text THEN RETURN true; END IF;
  IF public.shopdrop_is_active_admin() THEN
   RETURN EXISTS(SELECT 1 FROM public.dispute_evidence e
    WHERE coalesce(e.dispute_id,e.service_dispute_id,e.dispatch_dispute_id)=parts[1]::uuid AND e.submitted_by=parts[2]::uuid
      AND e.storage_bucket='dispute-evidence' AND e.storage_path=p_path);
  END IF;
  RETURN false;
 END IF;
 -- Retain the existing owner-only legacy signed-upload layout.
 RETURN parts[1]=u::text AND parts[2] ~ '^[A-Za-z0-9_-]{1,120}$';
END $function$;
-- Existing owner-only metadata RLS, private storage bucket, cleanup checks,
-- admin-only file path, completion PIN and all payout functions remain unchanged.

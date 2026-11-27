-- Fix 199G-A: protect private evidence without changing financial or delivery procedures.
-- The current proof-of-delivery page reads the existing buyer-only tracking snapshot.
-- Raw POD is backend-only, including recipient names, notes and storage paths.
DROP POLICY "V26 POD authenticated select" ON public.proof_of_delivery;
DROP POLICY "V26 POD authenticated insert" ON public.proof_of_delivery;
REVOKE ALL ON TABLE public.proof_of_delivery FROM PUBLIC,anon,authenticated;
-- The authorized courier/backend continues to use its existing service-role access.
DROP POLICY "V26 proof of delivery authenticated upload" ON storage.objects;

-- Evidence registration must go through the existing protected RPC, which checks
-- the dispute participant, actual owned storage object, MIME and file size.
DROP POLICY "V26 dispute evidence own insert" ON public.dispute_evidence;
DROP POLICY "V26 dispute evidence own delete" ON public.dispute_evidence;
DROP POLICY "ShopDrop dispute evidence participant metadata insert" ON public.dispute_evidence;
REVOKE ALL ON TABLE public.dispute_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.dispute_evidence TO authenticated;
CREATE UNIQUE INDEX shopdrop_dispute_evidence_object_199ga
ON public.dispute_evidence(storage_bucket,storage_path);

-- Preserve participant uploads, but never expose another participant's private
-- photographs or documents through Storage listing. The existing administrators
-- can review registered case evidence. Legacy personal uploads stay owner-only.
CREATE OR REPLACE FUNCTION public.shopdrop_dispute_storage_read_allowed(p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
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
    WHERE e.dispute_id=parts[1]::uuid AND e.submitted_by=parts[2]::uuid
      AND e.storage_bucket='dispute-evidence' AND e.storage_path=p_path);
  END IF;
  RETURN false;
 END IF;
 -- Retain the existing owner-only legacy signed-upload layout.
 RETURN parts[1]=u::text AND parts[2] ~ '^[A-Za-z0-9_-]{1,120}$';
END $fn$;
-- Do not allow a client to invent an object owner.
DROP POLICY "ShopDrop dispute evidence participant upload" ON storage.objects;
CREATE POLICY "ShopDrop dispute evidence participant upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='dispute-evidence' AND owner_id=auth.uid()::text
 AND public.shopdrop_dispute_storage_upload_allowed(name));
-- Only unregistered objects remain eligible for existing cleanup.
-- All transaction, courier, payout and verification functions remain unchanged.

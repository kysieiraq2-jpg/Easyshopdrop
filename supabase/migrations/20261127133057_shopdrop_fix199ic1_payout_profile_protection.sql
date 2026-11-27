-- Fix 199I-C1: provider-verified payout profiles are backend-managed.
-- Preserve private owner read access; no change to payout execution.
DROP POLICY IF EXISTS "V26 own payout profile delete" ON public.payout_profiles;
DROP POLICY IF EXISTS "V26 own payout profile insert" ON public.payout_profiles;
DROP POLICY IF EXISTS "V26 own payout profile update" ON public.payout_profiles;
REVOKE ALL ON public.payout_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payout_profiles TO authenticated;

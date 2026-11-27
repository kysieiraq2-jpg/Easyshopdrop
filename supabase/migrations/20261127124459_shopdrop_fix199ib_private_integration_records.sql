-- Fix 199I-B: remove legacy permissive access without altering transaction procedures.
REVOKE ALL ON public.shopdrop_public_vehicle_adverts, public.shopdrop_public_vehicle_ad_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shopdrop_public_vehicle_adverts, public.shopdrop_public_vehicle_ad_photos TO anon, authenticated;

DROP POLICY IF EXISTS "V26 integration events authenticated insert" ON public.integration_events;
DROP POLICY IF EXISTS "V26 integration events authenticated select" ON public.integration_events;
DROP POLICY IF EXISTS shopdrop_support_events_private_read_199b ON public.integration_events;
DROP POLICY IF EXISTS shopdrop_support_events_server_insert_199b ON public.integration_events;
DROP POLICY IF EXISTS "V26 integration logs authenticated select" ON public.integration_logs;
DROP POLICY IF EXISTS "V26 webhook events authenticated select" ON public.webhook_events;

REVOKE ALL ON public.integration_events, public.integration_logs, public.webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.integration_events, public.integration_logs, public.webhook_events TO authenticated;
CREATE POLICY shopdrop_integration_events_private_read_199ib ON public.integration_events FOR SELECT TO authenticated
USING ((SELECT public.shopdrop_is_active_admin()) OR (
event_type IN ('platform_feedback','payment_dispute_opened','cancellation_requested','listing_report_submitted')
AND (payload->>'user_id')=(SELECT auth.uid())::text));
CREATE POLICY shopdrop_integration_logs_admin_read_199ib ON public.integration_logs FOR SELECT TO authenticated
USING ((SELECT public.shopdrop_is_active_admin()));
CREATE POLICY shopdrop_webhook_events_admin_read_199ib ON public.webhook_events FOR SELECT TO authenticated
USING ((SELECT public.shopdrop_is_active_admin()));

CREATE SCHEMA shopdrop_transport_public_199ie;
REVOKE ALL ON SCHEMA shopdrop_transport_public_199ie FROM PUBLIC;
GRANT USAGE ON SCHEMA shopdrop_transport_public_199ie TO anon, authenticated, service_role;
CREATE FUNCTION shopdrop_transport_public_199ie.adverts()
RETURNS TABLE (id uuid, vehicle_title text, vehicle_description text, vehicle_type text, base_town text, base_province text, coverage_mode text, covered_areas text[], created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT v.id,v.vehicle_title,v.vehicle_description,v.vehicle_type,v.base_town,v.base_province,v.coverage_mode,v.covered_areas,v.created_at FROM public.shopdrop_vehicle_adverts v WHERE v.listing_status = 'approved' $$;
CREATE FUNCTION shopdrop_transport_public_199ie.photos()
RETURNS TABLE (vehicle_advert_id uuid, photo_position integer, storage_bucket text, storage_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT p.vehicle_advert_id,p.photo_position,p.storage_bucket,p.storage_path FROM public.shopdrop_vehicle_ad_photos p JOIN public.shopdrop_vehicle_adverts v ON v.id=p.vehicle_advert_id WHERE v.listing_status = 'approved' AND p.storage_bucket = 'shopdrop-vehicle-ad-gallery' $$;
REVOKE ALL ON FUNCTION shopdrop_transport_public_199ie.adverts(), shopdrop_transport_public_199ie.photos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shopdrop_transport_public_199ie.adverts(), shopdrop_transport_public_199ie.photos() TO anon, authenticated, service_role;
CREATE OR REPLACE VIEW public.shopdrop_public_vehicle_adverts WITH (security_invoker=true, security_barrier=true) AS SELECT id,vehicle_title,vehicle_description,vehicle_type,base_town,base_province,coverage_mode,covered_areas,created_at FROM shopdrop_transport_public_199ie.adverts();
CREATE OR REPLACE VIEW public.shopdrop_public_vehicle_ad_photos WITH (security_invoker=true, security_barrier=true) AS SELECT vehicle_advert_id,photo_position,storage_bucket,storage_path FROM shopdrop_transport_public_199ie.photos();

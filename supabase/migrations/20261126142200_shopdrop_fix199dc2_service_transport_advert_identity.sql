-- Fix 199D-C2: preserve original service and transport advertisement identities.
-- Existing SD-SVC, SD-TRN offer and transaction references remain unchanged.
-- There are no existing service/transport records to backfill at this installation.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.services) OR EXISTS(SELECT 1 FROM public.shopdrop_vehicle_adverts)
 OR EXISTS(SELECT 1 FROM public.service_bookings) OR EXISTS(SELECT 1 FROM public.dispatch_bookings)
 OR EXISTS(SELECT 1 FROM public.dispatch_offers) OR EXISTS(SELECT 1 FROM shopdrop_service_193c.bag)
 OR EXISTS(SELECT 1 FROM shopdrop_transport_192dc.bag) OR EXISTS(SELECT 1 FROM public.shopdrop_booking_rate_selections)
 THEN RAISE EXCEPTION '199dc2 existing records require separate verified backfill'; END IF;
END $$;
ALTER TABLE public.services ADD CONSTRAINT shopdrop_services_public_number_199dc2 UNIQUE(listing_public_number);
ALTER TABLE public.dispatch_offers ADD CONSTRAINT shopdrop_offers_public_number_199dc2 UNIQUE(listing_public_number);
ALTER TABLE public.shopdrop_vehicle_adverts ADD COLUMN listing_public_number bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.shopdrop_vehicle_adverts ADD CONSTRAINT shopdrop_transport_advert_number_199dc2 UNIQUE(listing_public_number);

CREATE FUNCTION public.shopdrop_guard_listing_number_199dc2()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 IF NEW.listing_public_number IS DISTINCT FROM OLD.listing_public_number THEN
  RAISE EXCEPTION 'listing_public_number_immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shopdrop_guard_listing_number_199dc2() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shopdrop_guard_listing_number_199dc2 BEFORE UPDATE OF listing_public_number ON public.services FOR EACH ROW EXECUTE FUNCTION public.shopdrop_guard_listing_number_199dc2();
CREATE TRIGGER shopdrop_guard_listing_number_199dc2 BEFORE UPDATE OF listing_public_number ON public.dispatch_offers FOR EACH ROW EXECUTE FUNCTION public.shopdrop_guard_listing_number_199dc2();
CREATE TRIGGER shopdrop_guard_listing_number_199dc2 BEFORE UPDATE OF listing_public_number ON public.shopdrop_vehicle_adverts FOR EACH ROW EXECUTE FUNCTION public.shopdrop_guard_listing_number_199dc2();

ALTER TABLE shopdrop_service_193c.bag ADD COLUMN advertisement_reference_snapshot text;
ALTER TABLE shopdrop_transport_192dc.bag ADD COLUMN advertisement_reference_snapshot text;
ALTER TABLE public.service_bookings ADD COLUMN advertisement_reference_snapshot text;
ALTER TABLE public.dispatch_bookings ADD COLUMN advertisement_reference_snapshot text, ADD COLUMN offer_reference_snapshot text;

-- Service bags and bookings use the existing service number. Transport bags use
-- the original advert number, with a distinct prefix from individual offers.
CREATE FUNCTION public.shopdrop_advert_snapshot_199dc2()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE ref text;
BEGIN
 IF TG_OP='INSERT' THEN
  IF TG_TABLE_NAME='bag' AND TG_TABLE_SCHEMA='shopdrop_transport_192dc' THEN
   SELECT 'SD-TRN-AD-'||lpad(a.listing_public_number::text,greatest(8,length(a.listing_public_number::text)),'0')
   INTO ref FROM public.shopdrop_vehicle_adverts a WHERE a.id=NEW.advert_id AND a.provider_id=NEW.provider_id;
  ELSE
   SELECT 'SD-SVC-'||lpad(s.listing_public_number::text,greatest(8,length(s.listing_public_number::text)),'0')
   INTO ref FROM public.services s WHERE s.id=NEW.service_id AND s.provider_id=NEW.provider_id;
  END IF;
  IF ref IS NULL THEN RAISE EXCEPTION 'original_advertisement_reference_unavailable' USING ERRCODE='23514'; END IF;
  NEW.advertisement_reference_snapshot:=ref;
 ELSE
  IF NEW.advertisement_reference_snapshot IS DISTINCT FROM OLD.advertisement_reference_snapshot
     OR NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
   RAISE EXCEPTION 'advertisement_snapshot_immutable' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='bag' AND TG_TABLE_SCHEMA='shopdrop_transport_192dc' THEN
   IF NEW.advert_id IS DISTINCT FROM OLD.advert_id THEN RAISE EXCEPTION 'advertisement_snapshot_immutable'; END IF;
  ELSE
   IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN RAISE EXCEPTION 'advertisement_snapshot_immutable'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shopdrop_advert_snapshot_199dc2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_advert_snapshot_199dc2() TO service_role;
CREATE TRIGGER shopdrop_advert_snapshot_199dc2 BEFORE INSERT OR UPDATE ON shopdrop_service_193c.bag FOR EACH ROW EXECUTE FUNCTION public.shopdrop_advert_snapshot_199dc2();
CREATE TRIGGER shopdrop_advert_snapshot_199dc2 BEFORE INSERT OR UPDATE ON shopdrop_transport_192dc.bag FOR EACH ROW EXECUTE FUNCTION public.shopdrop_advert_snapshot_199dc2();
CREATE TRIGGER shopdrop_advert_snapshot_199dc2 BEFORE INSERT OR UPDATE ON public.service_bookings FOR EACH ROW EXECUTE FUNCTION public.shopdrop_advert_snapshot_199dc2();

-- Preserve the offer reference for every dispatch booking, even when the legacy
-- request has no original equipment advertisement. Only the exact rate binding
-- may establish the original advertisement reference for rated hire bookings.
CREATE FUNCTION public.shopdrop_dispatch_identity_199dc2()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE ref text;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT 'SD-TRN-'||lpad(o.listing_public_number::text,greatest(8,length(o.listing_public_number::text)),'0')
  INTO ref FROM public.dispatch_offers o WHERE o.id=NEW.offer_id AND o.provider_id=NEW.provider_id AND o.request_id=NEW.request_id;
  IF ref IS NULL THEN RAISE EXCEPTION 'original_offer_reference_unavailable'; END IF;
  NEW.offer_reference_snapshot:=ref;
  NEW.advertisement_reference_snapshot:=NULL;
 ELSE
  IF NEW.offer_reference_snapshot IS DISTINCT FROM OLD.offer_reference_snapshot
     OR NEW.offer_id IS DISTINCT FROM OLD.offer_id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id THEN RAISE EXCEPTION 'dispatch_identity_immutable'; END IF;
  IF NEW.advertisement_reference_snapshot IS DISTINCT FROM OLD.advertisement_reference_snapshot THEN
   IF OLD.advertisement_reference_snapshot IS NOT NULL THEN RAISE EXCEPTION 'dispatch_advertisement_reference_immutable'; END IF;
   SELECT 'SD-TRN-AD-'||lpad(a.listing_public_number::text,greatest(8,length(a.listing_public_number::text)),'0')
   INTO ref FROM public.shopdrop_booking_rate_selections b
   JOIN public.shopdrop_advert_service_rates r ON r.id=b.rate_id
   JOIN public.shopdrop_vehicle_adverts a ON a.id=r.dispatch_advert_id
   WHERE b.dispatch_booking_id=OLD.id AND a.provider_id=OLD.provider_id;
   IF ref IS NULL OR NEW.advertisement_reference_snapshot IS DISTINCT FROM ref
      OR OLD.payment_status<>'pending' THEN RAISE EXCEPTION 'dispatch_advertisement_binding_invalid'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shopdrop_dispatch_identity_199dc2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_dispatch_identity_199dc2() TO service_role;
CREATE TRIGGER shopdrop_dispatch_identity_199dc2 BEFORE INSERT OR UPDATE ON public.dispatch_bookings FOR EACH ROW EXECUTE FUNCTION public.shopdrop_dispatch_identity_199dc2();

CREATE FUNCTION public.shopdrop_bind_dispatch_identity_199dc2()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE ref text; saved text;
BEGIN
 IF NEW.dispatch_booking_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.dispatch_booking_id IS DISTINCT FROM NEW.dispatch_booking_id THEN
  RAISE EXCEPTION 'dispatch_booking_identity_immutable';
 END IF;
 SELECT 'SD-TRN-AD-'||lpad(a.listing_public_number::text,greatest(8,length(a.listing_public_number::text)),'0'),d.advertisement_reference_snapshot
 INTO ref,saved FROM public.dispatch_bookings d
 JOIN public.shopdrop_advert_service_rates r ON r.id=NEW.rate_id
 JOIN public.shopdrop_vehicle_adverts a ON a.id=r.dispatch_advert_id AND a.provider_id=d.provider_id
 WHERE d.id=NEW.dispatch_booking_id;
 IF ref IS NULL THEN RAISE EXCEPTION 'dispatch_advertisement_binding_invalid'; END IF;
 IF saved IS NULL THEN
  UPDATE public.dispatch_bookings SET advertisement_reference_snapshot=ref WHERE id=NEW.dispatch_booking_id;
 ELSIF saved IS DISTINCT FROM ref THEN
  RAISE EXCEPTION 'dispatch_advertisement_reference_immutable';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shopdrop_bind_dispatch_identity_199dc2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_bind_dispatch_identity_199dc2() TO service_role;
CREATE TRIGGER shopdrop_bind_dispatch_identity_199dc2 AFTER INSERT OR UPDATE OF rate_id,dispatch_booking_id ON public.shopdrop_booking_rate_selections FOR EACH ROW EXECUTE FUNCTION public.shopdrop_bind_dispatch_identity_199dc2();

-- Existing payment and release records continue to use their verified booking IDs.
-- No extra settlement trigger, payout release, role grants or RLS changes.

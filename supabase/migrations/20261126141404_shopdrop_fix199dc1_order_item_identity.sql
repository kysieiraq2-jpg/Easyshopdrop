-- Fix 199D-C1: immutable physical-product identity in historical orders.
-- Existing product references, payment logic and RLS are unchanged.
ALTER TABLE public.order_items
  ADD COLUMN listing_reference_snapshot text,
  ADD COLUMN seller_alias_snapshot text;

-- Only recover immutable listing references that still belong to the recorded seller.
-- The current alias is not proof of a historical alias.
UPDATE public.order_items AS i
SET listing_reference_snapshot = nullif(btrim(p.listing_reference),'')
FROM public.products AS p
WHERE p.id=i.product_id AND p.seller_id=i.seller_id
  AND nullif(btrim(p.listing_reference),'') IS NOT NULL;

CREATE FUNCTION public.shopdrop_order_item_identity_199dc1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    -- Ignore browser/caller-supplied snapshot values.
    NEW.listing_reference_snapshot := NULL;
    NEW.seller_alias_snapshot := NULL;
    IF NEW.product_id IS NOT NULL THEN
      SELECT nullif(btrim(p.listing_reference),''),
             nullif(btrim(pr.seller_public_alias),'')
      INTO NEW.listing_reference_snapshot, NEW.seller_alias_snapshot
      FROM public.products p
      LEFT JOIN public.profiles pr ON pr.id=p.seller_id
      WHERE p.id=NEW.product_id AND p.seller_id=NEW.seller_id;
      IF NOT FOUND OR NEW.listing_reference_snapshot IS NULL THEN
        RAISE EXCEPTION 'original_listing_reference_unavailable' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSE
    IF NEW.listing_reference_snapshot IS DISTINCT FROM OLD.listing_reference_snapshot
       OR NEW.seller_alias_snapshot IS DISTINCT FROM OLD.seller_alias_snapshot THEN
      RAISE EXCEPTION 'order_item_identity_snapshot_immutable' USING ERRCODE='23514';
    END IF;
    -- Preserve identity when the existing product foreign key becomes NULL on deletion.
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
       OR (NEW.product_id IS DISTINCT FROM OLD.product_id AND NEW.product_id IS NOT NULL) THEN
      RAISE EXCEPTION 'order_item_identity_immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.shopdrop_order_item_identity_199dc1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shopdrop_order_item_identity_199dc1() TO service_role;
CREATE TRIGGER shopdrop_order_item_identity_199dc1
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.shopdrop_order_item_identity_199dc1();

-- Keep the existing buyer-only tracking authorization and response shape.
DO $patch$
DECLARE
  src text := pg_get_functiondef('public.shopdrop_buyer_tracking_snapshot(text)'::regprocedure);
  original text := src;
  old_item text := $a$'listing_reference',p.listing_reference,
   'seller_alias',nullif(btrim(pr.seller_public_alias),'')$a$;
  old_joins text := $a$ LEFT JOIN public.products p ON p.id=i.product_id
 LEFT JOIN public.profiles pr ON pr.id=i.seller_id
$a$;
  old_shipment text := $a$'seller_alias',nullif(btrim(pr.seller_public_alias),''),
   'courier_name'$a$;
  old_shipment_join text := $a$ LEFT JOIN public.profiles pr ON pr.id=s.seller_id
$a$;
BEGIN
  IF (length(src)-length(replace(src,old_item,'')))/length(old_item)<>1
     OR (length(src)-length(replace(src,old_joins,'')))/length(old_joins)<>1
     OR (length(src)-length(replace(src,old_shipment,'')))/length(old_shipment)<>1
     OR (length(src)-length(replace(src,old_shipment_join,'')))/length(old_shipment_join)<>1 THEN
    RAISE EXCEPTION '199dc1 tracking source changed';
  END IF;
  src := replace(src,old_item,$a$'listing_reference',i.listing_reference_snapshot,
   'seller_alias',i.seller_alias_snapshot$a$);
  src := replace(src,old_joins,'');
  src := replace(src,old_shipment,$a$'seller_alias',(SELECT CASE WHEN count(DISTINCT i.seller_alias_snapshot)=1
                              THEN min(i.seller_alias_snapshot) ELSE NULL END
                      FROM public.order_items i
                      WHERE i.order_id=s.order_id AND i.seller_id=s.seller_id),
   'courier_name'$a$);
  src := replace(src,old_shipment_join,'');
  IF src=original THEN RAISE EXCEPTION '199dc1 tracking patch missing'; END IF;
  EXECUTE src;
END;
$patch$;

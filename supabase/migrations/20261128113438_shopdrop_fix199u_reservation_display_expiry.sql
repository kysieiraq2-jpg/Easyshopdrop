DO $fix199u$
DECLARE
  original text := pg_get_functiondef('public.shopdrop_a176_checkout_reservation_expiry(uuid)'::regprocedure);
  updated text;
  old_aggregate constant text := 'SELECT MAX(r.expires_at)';
  new_aggregate constant text := 'SELECT MIN(r.expires_at)';
  old_filter constant text := 'WHERE r.order_id = p_order_id;';
  new_filter constant text := 'WHERE r.order_id = p_order_id AND r.status = ''reserved'';';
BEGIN
  IF md5(original) <> 'a22bc8eff603a19b29c8a8e64190b818' THEN
    RAISE EXCEPTION 'Fix199U: unexpected reservation display source';
  END IF;
  IF (length(original)-length(replace(original,old_aggregate,'')))/length(old_aggregate) <> 1
     OR (length(original)-length(replace(original,old_filter,'')))/length(old_filter) <> 1 THEN
    RAISE EXCEPTION 'Fix199U: replacement anchors not unique';
  END IF;
  updated := replace(replace(original,old_aggregate,new_aggregate),old_filter,new_filter);
  IF replace(replace(updated,new_filter,old_filter),new_aggregate,old_aggregate) <> original THEN
    RAISE EXCEPTION 'Fix199U: unrelated code changed';
  END IF;
  EXECUTE updated;
  IF pg_get_functiondef('public.shopdrop_a176_checkout_reservation_expiry(uuid)'::regprocedure) <> updated THEN
    RAISE EXCEPTION 'Fix199U: verification failed';
  END IF;
END;
$fix199u$;

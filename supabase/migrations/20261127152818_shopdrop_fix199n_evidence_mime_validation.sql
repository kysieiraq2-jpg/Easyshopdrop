DO $fix199n$
DECLARE
  original text := pg_get_functiondef('public.shopdrop_register_dispute_evidence(uuid,text,text,text,text)'::regprocedure);
  anchor constant text := 'if v_mime not in (''image/jpeg'',''image/png'',''image/webp'',''application/pdf'')';
  replacement constant text := 'if v_mime is null or v_mime not in (''image/jpeg'',''image/png'',''image/webp'',''application/pdf'')';
  updated text;
BEGIN
  IF md5(original) <> '5401ec4a515781972aae424c66618a36' THEN
    RAISE EXCEPTION 'Fix199N: unexpected evidence registration source';
  END IF;
  IF (length(original)-length(replace(original,anchor,'')))/length(anchor) <> 1 THEN
    RAISE EXCEPTION 'Fix199N: expected MIME condition not unique';
  END IF;
  updated := replace(original,anchor,replacement);
  IF replace(updated,replacement,anchor) <> original THEN
    RAISE EXCEPTION 'Fix199N: unrelated code changed';
  END IF;
  EXECUTE updated;
  IF pg_get_functiondef('public.shopdrop_register_dispute_evidence(uuid,text,text,text,text)'::regprocedure) <> updated THEN
    RAISE EXCEPTION 'Fix199N: verification failed';
  END IF;
END;
$fix199n$;

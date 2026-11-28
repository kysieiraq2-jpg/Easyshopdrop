DO $fix200f$
DECLARE
  f record;
  original text;
  updated text;
  anchor constant text := E'  v_user_id := auth.uid();\n\n  IF v_user_id IS NULL THEN\n    RAISE EXCEPTION ''Authentication required'';\n  END IF;';
  gate text;
BEGIN
  IF md5(pg_get_functiondef('public.shopdrop_completion_state_193g(text,uuid)'::regprocedure)) <> 'c39f12f8ebd052911c29e34f11b2e017' THEN
    RAISE EXCEPTION 'Fix200F: completion-state source changed';
  END IF;
  FOR f IN SELECT * FROM (VALUES
    ('public.shopdrop_get_my_service_arrival_pin(uuid)','service','3a106224f52e358db2a7ba41ff8586f1'),
    ('public.shopdrop_get_my_dispatch_arrival_pin(uuid)','dispatch','b02db773610ed2d39771addcdba60930')
  ) AS v(signature,kind,expected_md5)
  LOOP
    original := pg_get_functiondef(f.signature::regprocedure);
    IF md5(original) <> f.expected_md5 THEN
      RAISE EXCEPTION 'Fix200F: unexpected PIN getter source: %', f.signature;
    END IF;
    IF (length(original)-length(replace(original,anchor,'')))/length(anchor) <> 1 THEN
      RAISE EXCEPTION 'Fix200F: nonunique insertion anchor';
    END IF;
    gate := format(E'\n\n  -- Fix 200F: legacy account retrieval must satisfy the existing completion-state gate.\n  IF (public.shopdrop_completion_state_193g(%L,p_booking_id)->>''pin_available'') IS DISTINCT FROM ''true'' THEN\n    RAISE EXCEPTION ''Customer completion PIN unavailable'' USING ERRCODE=''42501'';\n  END IF;', f.kind);
    updated := replace(original,anchor,anchor||gate);
    IF replace(updated,anchor||gate,anchor) <> original THEN
      RAISE EXCEPTION 'Fix200F: unrelated code changed';
    END IF;
    EXECUTE updated;
    IF pg_get_functiondef(f.signature::regprocedure) <> updated THEN
      RAISE EXCEPTION 'Fix200F: installed source mismatch';
    END IF;
    IF has_function_privilege('anon',f.signature,'execute') OR NOT has_function_privilege('authenticated',f.signature,'execute') OR NOT has_function_privilege('service_role',f.signature,'execute') THEN
      RAISE EXCEPTION 'Fix200F: existing grants changed';
    END IF;
  END LOOP;
END;
$fix200f$;

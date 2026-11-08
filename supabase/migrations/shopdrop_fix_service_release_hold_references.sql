
-- Shop&Drop: Repair missing service payout table references.
-- Preserves existing function bodies and other safeguards.
-- Fail-closed provider-wide hold check.
-- No payment or payout activation.

DO $repair$
DECLARE
  v_function regprocedure;
  v_definition text;
  v_updated text;
  v_pattern text :=
    'FROM public[.]service_provider_payouts[[:space:]]+' ||
    '[a-z]+[[:space:]]+' ||
    'JOIN public[.]service_provider_payout_holds h' ||
    '[[:space:]]+ON h[.]service_provider_payout_id' ||
    '[[:space:]]*=[[:space:]]*[a-z]+[.]id' ||
    '[[:space:]]+WHERE [a-z]+[.]booking_id' ||
    '[[:space:]]*=[[:space:]]*(b[.]id|NEW[.]booking_id)' ||
    '[[:space:]]+AND [a-z]+[.]provider_id' ||
    '[[:space:]]*=[[:space:]]*(b[.]provider_id|NEW[.]provider_id)' ||
    '[[:space:]]+AND h[.]status' ||
    '[[:space:]]*=[[:space:]]*''active''';
  v_replacement text :=
    'FROM public.service_provider_payout_holds h ' ||
    'WHERE h.provider_id = ';
  v_target text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.shopdrop_stage_arrival_provider_releases(integer)'::regprocedure,
    'public.shopdrop_claim_arrival_provider_release(uuid)'::regprocedure,
    'public.shopdrop_guard_service_release_disputes()'::regprocedure
  ]
  LOOP
    v_definition := pg_get_functiondef(v_function);

    IF v_definition !~ v_pattern THEN
      RAISE EXCEPTION
        'Expected original code not found in %',
        v_function;
    END IF;

    IF v_function::text LIKE
       '%shopdrop_guard_service_release_disputes%' THEN
      v_target := 'NEW.provider_id';
    ELSE
      v_target := 'b.provider_id';
    END IF;

    v_updated := regexp_replace(
      v_definition,
      v_pattern,
      v_replacement || v_target ||
        ' AND h.status = ''active'''
    );

    IF v_updated = v_definition
       OR v_updated LIKE
          '%FROM public.service_provider_payouts %'
    THEN
      RAISE EXCEPTION
        'Unsafe or incomplete repair: %',
        v_function;
    END IF;

    EXECUTE v_updated;
  END LOOP;
END;
$repair$;


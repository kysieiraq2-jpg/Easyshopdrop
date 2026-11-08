
-- Shop&Drop: Automatic arrival-release staging.
-- Services and dispatching.
-- Five-minute scheduler.
-- Existing jobs and functions preserved.
-- No live payment or payout activation.

DO $shopdrop$
DECLARE
  v_job_id bigint;
BEGIN
  -- Required credentials must already exist.
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'shopdrop_scheduler_anon_key'
      AND decrypted_secret IS NOT NULL
      AND length(decrypted_secret) > 100
  ) THEN
    RAISE EXCEPTION
      'Scheduler JWT credential unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name =
      'shopdrop_arrival_release_worker_secret'
      AND decrypted_secret IS NOT NULL
      AND length(decrypted_secret) >= 32
  ) THEN
    RAISE EXCEPTION
      'Arrival worker secret unavailable';
  END IF;

  -- Never create a duplicate scheduled job.
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname =
      'shopdrop-arrival-release-staging-5min'
  ) THEN
    RAISE NOTICE
      'Arrival release scheduler already exists';
    RETURN;
  END IF;

  SELECT cron.schedule(
    'shopdrop-arrival-release-staging-5min',
    '*/5 * * * *',
    $command$
    SELECT net.http_post(
      url :=
        'https://dtkdvvxpwonywtsgqmdx.supabase.co/functions/v1/shopdrop-arrival-release-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
          'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'shopdrop_scheduler_anon_key'
          ),
        'apikey', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'shopdrop_scheduler_anon_key'
        ),
        'x-shopdrop-arrival-worker-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name =
            'shopdrop_arrival_release_worker_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
    $command$
  )
  INTO v_job_id;

  RAISE NOTICE
    'Arrival staging scheduler created: %',
    v_job_id;
END;
$shopdrop$;


-- Schedule operational retention cleanup daily and reduce false-positive cooldown
-- blocks for office-wide campaigns that share a public IP.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'cron'
  ) THEN
    FOR v_job_id IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'cleanup-operational-history-daily'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;

    PERFORM cron.schedule(
      'cleanup-operational-history-daily',
      '17 2 * * *',
      $cron$SELECT public.cleanup_operational_history();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron schema is not available; operational cleanup schedule was not created.';
  END IF;
END;
$$;

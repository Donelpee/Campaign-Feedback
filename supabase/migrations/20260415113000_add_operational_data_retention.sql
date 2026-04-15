-- Keep high-volume operational tables bounded so anti-abuse and monitoring data
-- remain useful without growing unbounded under sustained traffic.

CREATE OR REPLACE FUNCTION public.cleanup_operational_history()
RETURNS TABLE (
  table_name TEXT,
  deleted_rows BIGINT,
  retention_days INTEGER,
  cutoff TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_attempts_cutoff TIMESTAMP WITH TIME ZONE := now() - INTERVAL '14 days';
  v_email_events_cutoff TIMESTAMP WITH TIME ZONE := now() - INTERVAL '180 days';
  v_system_health_cutoff TIMESTAMP WITH TIME ZONE := now() - INTERVAL '45 days';
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.feedback_submission_attempts
  WHERE attempted_at < v_submission_attempts_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  table_name := 'feedback_submission_attempts';
  deleted_rows := v_deleted;
  retention_days := 14;
  cutoff := v_submission_attempts_cutoff;
  RETURN NEXT;

  DELETE FROM public.feedback_response_email_events
  WHERE COALESCE(processed_at, created_at) < v_email_events_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  table_name := 'feedback_response_email_events';
  deleted_rows := v_deleted;
  retention_days := 180;
  cutoff := v_email_events_cutoff;
  RETURN NEXT;

  DELETE FROM public.system_health_events
  WHERE created_at < v_system_health_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  table_name := 'system_health_events';
  deleted_rows := v_deleted;
  retention_days := 45;
  cutoff := v_system_health_cutoff;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.cleanup_operational_history()
IS 'Purges expired rate-limit, notification, and health-event rows. Retention: attempts 14d, email events 180d, system health events 45d.';

REVOKE ALL ON FUNCTION public.cleanup_operational_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_operational_history() TO service_role;

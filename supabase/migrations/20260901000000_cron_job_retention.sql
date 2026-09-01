-- Migration: Automated Retention & Cleanup for pg_cron logs
-- Prevents cron.job_run_details from accumulating thousands of rows and bloating database disk space.

-- 1. Unschedule old cleanup job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-run-details') THEN
    PERFORM cron.unschedule('cleanup-cron-run-details');
  END IF;
END $$;

-- 2. Schedule automated daily maintenance to prune logs older than 3 days
SELECT cron.schedule(
  'cleanup-cron-run-details',
  '0 0 * * *', -- Daily at midnight (00:00 UTC)
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - INTERVAL '3 days'$$
);

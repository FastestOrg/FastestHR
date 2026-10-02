-- Migration: 20260924030000_harden_senddesk_cron_job.sql
-- Description: Harden senddesk scheduled emails cron job with vault secret checks and error prevention

DO $$
BEGIN
  -- Alter job 1 command to safeguard against null vault secrets and redundant HTTP calls
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 1) THEN
    PERFORM cron.alter_job(
      job_id := 1,
      command := $cmd$
        SELECT net.http_post(
          url := (SELECT CONCAT('https://', decrypted_secret) FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/send-document',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
          ),
          body := jsonb_build_object('process_scheduled', true)
        ) AS request_id
        FROM public.senddesk_emails
        WHERE status = 'scheduled' 
          AND scheduled_at <= now()
          AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
        LIMIT 1;
      $cmd$
    );
  END IF;
END $$;

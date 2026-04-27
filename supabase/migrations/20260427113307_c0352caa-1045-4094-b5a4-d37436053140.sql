CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing job with same name
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'dispatch-notifications-every-minute';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'dispatch-notifications-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdnVleHRsZWN6ZHNxeG9ndXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzkxNTMsImV4cCI6MjA5MTkxNTE1M30.i-W8LjuHwwfnMdC3-wqAoeo5Mcm97EETGcbbtsc-Czg'
    ),
    body := '{}'::jsonb
  );
  $$
);
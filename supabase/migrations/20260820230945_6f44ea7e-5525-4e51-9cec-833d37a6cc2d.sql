DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'terrain-push-watchdog';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'terrain-push-watchdog',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/cron-terrain-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
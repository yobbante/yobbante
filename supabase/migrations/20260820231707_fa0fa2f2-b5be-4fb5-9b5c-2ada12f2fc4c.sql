create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;
create table if not exists internal.config (key text primary key, value text not null);
revoke all on table internal.config from public, anon, authenticated;
insert into internal.config(key, value) values ('internal_notify_token','d4i5ifBkSZnezUwjYRH57tKdGb4k95F0THAkeRXAomaZKZtJ')
  on conflict (key) do update set value = excluded.value;

create or replace function public.notify_admin_http(
  p_notification_type text,
  p_message text,
  p_dossier_id uuid default null,
  p_dedup_key text default null,
  p_window_minutes integer default 240
) returns void
language plpgsql
security definer
set search_path = public, internal
as $$
DECLARE
  v_url TEXT := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/admin-notify';
  v_token TEXT;
BEGIN
  SELECT value INTO v_token FROM internal.config WHERE key = 'internal_notify_token';
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-token', COALESCE(v_token, '')
      ),
      body := jsonb_build_object(
        'notification_type', p_notification_type,
        'message', p_message,
        'dossier_id', p_dossier_id,
        'dedup_key', COALESCE(p_dedup_key, p_notification_type || ':' || COALESCE(p_dossier_id::text, 'g')),
        'window_minutes', p_window_minutes
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;
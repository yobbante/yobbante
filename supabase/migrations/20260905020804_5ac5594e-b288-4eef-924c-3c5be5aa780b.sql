CREATE TABLE public.internal_cron_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_cron_tokens TO service_role;

ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_internal_cron_tokens_updated_at
BEFORE UPDATE ON public.internal_cron_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.internal_cron_tokens (name, token)
VALUES ('intern_weekly', encode(gen_random_bytes(32), 'hex'));
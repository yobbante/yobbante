CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  bucket text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, subject, window_start)
);

GRANT ALL ON public.ai_rate_limits TO service_role;

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages ai rate limits"
ON public.ai_rate_limits FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.ai_rate_limit_hit(
  _bucket text,
  _subject text,
  _max integer,
  _window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws timestamptz;
  n integer;
BEGIN
  ws := to_timestamp(floor(extract(epoch from now()) / GREATEST(_window_seconds, 1)) * GREATEST(_window_seconds, 1));

  INSERT INTO public.ai_rate_limits (bucket, subject, window_start, hits)
  VALUES (_bucket, COALESCE(NULLIF(_subject, ''), 'anon'), ws, 1)
  ON CONFLICT (bucket, subject, window_start)
  DO UPDATE SET hits = public.ai_rate_limits.hits + 1, updated_at = now()
  RETURNING hits INTO n;

  DELETE FROM public.ai_rate_limits WHERE window_start < now() - interval '1 day';

  RETURN jsonb_build_object(
    'allowed', n <= _max,
    'hits', n,
    'max', _max,
    'retry_after', GREATEST(1, CEIL(EXTRACT(epoch FROM (ws + make_interval(secs => _window_seconds)) - now()))::int)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_hit(text, text, integer, integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.gp_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  phone text NOT NULL,
  ref_gp text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.gp_auth_tokens TO service_role;

ALTER TABLE public.gp_auth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no direct access" ON public.gp_auth_tokens FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS gp_auth_tokens_token_idx ON public.gp_auth_tokens(token);
CREATE INDEX IF NOT EXISTS gp_auth_tokens_expires_idx ON public.gp_auth_tokens(expires_at);

-- Request auth: lookup transporteur by phone (last 9 digits), issue token
CREATE OR REPLACE FUNCTION public.gp_request_auth(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_last9 text;
  v_t record;
  v_token text;
BEGIN
  IF p_phone IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_digits) < 9 THEN RETURN jsonb_build_object('found', false); END IF;
  v_last9 := right(v_digits, 9);

  SELECT reference, telephone_1, prenom
    INTO v_t
    FROM public.transporteurs
   WHERE right(regexp_replace(coalesce(telephone_1,''), '\D', '', 'g'), 9) = v_last9
      OR right(regexp_replace(coalesce(telephone_2,''), '\D', '', 'g'), 9) = v_last9
   ORDER BY actif DESC NULLS LAST, updated_at DESC
   LIMIT 1;

  IF v_t IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gp_auth_tokens (token, phone, ref_gp, expires_at)
  VALUES (v_token, '+' || v_digits, v_t.reference, now() + interval '15 minutes');

  RETURN jsonb_build_object(
    'found', true,
    'token', v_token,
    'ref_gp', v_t.reference,
    'prenom', v_t.prenom
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gp_request_auth(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gp_request_auth(text) TO anon, authenticated;

-- Consume token: validate, mark used, return session info
CREATE OR REPLACE FUNCTION public.gp_consume_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_row FROM public.gp_auth_tokens WHERE token = p_token FOR UPDATE;
  IF v_row IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF v_row.used THEN RETURN jsonb_build_object('ok', false, 'reason', 'used'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;

  UPDATE public.gp_auth_tokens SET used = true, used_at = now() WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'ref_gp', v_row.ref_gp,
    'phone', v_row.phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gp_consume_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gp_consume_token(text) TO anon, authenticated;

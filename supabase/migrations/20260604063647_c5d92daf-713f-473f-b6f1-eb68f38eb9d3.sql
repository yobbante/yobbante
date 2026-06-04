CREATE OR REPLACE FUNCTION public.admin_apply_gp_fix(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  n int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows) LOOP
    UPDATE transporteurs SET
      reference   = NULLIF(r->>'reference',''),
      prenom      = NULLIF(r->>'prenom',''),
      nom         = NULLIF(r->>'nom',''),
      telephone_1 = NULLIF(r->>'telephone_1',''),
      telephone_2 = NULLIF(r->>'telephone_2',''),
      whatsapp    = NULLIF(r->>'whatsapp',''),
      adresse_1   = NULLIF(r->>'adresse_1',''),
      adresse_2   = NULLIF(r->>'adresse_2',''),
      ville       = NULLIF(r->>'ville',''),
      zone        = NULLIF(r->>'zone',''),
      notes       = NULLIF(r->>'notes',''),
      updated_at  = now()
    WHERE id = (r->>'id')::uuid;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_gp_fix(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_gp_fix(jsonb) TO service_role;
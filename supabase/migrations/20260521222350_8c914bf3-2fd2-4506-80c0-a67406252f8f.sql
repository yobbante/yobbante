CREATE OR REPLACE FUNCTION public.set_dossier_cod_public(p_tracking text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.dossiers
   WHERE (tracking_id = p_tracking OR reference = p_tracking)
     AND payment_status IN ('pending','pending_delivery')
   LIMIT 1;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.dossiers
     SET cash_on_delivery = true,
         payment_status = 'pending_delivery'
   WHERE id = v_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_dossier_cod_public(text) TO anon, authenticated;
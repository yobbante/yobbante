
ALTER TABLE public.dekk_orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS promo_id uuid REFERENCES public.dekk_promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_eur integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.dekk_consume_promo(
  p_code text,
  p_order_id uuid,
  p_subtotal_eur integer
)
RETURNS TABLE(promo_id uuid, discount_eur integer, total_eur integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pc record;
  v_discount integer := 0;
BEGIN
  SELECT * INTO pc FROM public.dekk_promo_codes
   WHERE upper(code) = upper(p_code) AND active = true
   FOR UPDATE;
  IF pc IS NULL THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;
  IF pc.expires_at IS NOT NULL AND pc.expires_at < now() THEN
    RAISE EXCEPTION 'expired' USING ERRCODE = 'P0001';
  END IF;
  IF pc.max_uses IS NOT NULL AND pc.used_count >= pc.max_uses THEN
    RAISE EXCEPTION 'exhausted' USING ERRCODE = 'P0001';
  END IF;
  IF p_subtotal_eur < pc.min_subtotal_eur THEN
    RAISE EXCEPTION 'below_min' USING ERRCODE = 'P0001';
  END IF;

  IF pc.discount_type = 'percent' THEN
    v_discount := floor(p_subtotal_eur * pc.discount_value / 100.0);
  ELSE
    v_discount := pc.discount_value;
  END IF;
  v_discount := LEAST(v_discount, p_subtotal_eur);

  UPDATE public.dekk_promo_codes
     SET used_count = used_count + 1, updated_at = now()
   WHERE id = pc.id;

  INSERT INTO public.dekk_promo_redemptions (promo_id, order_id, discount_eur)
  VALUES (pc.id, p_order_id, v_discount);

  UPDATE public.dekk_orders
     SET promo_code = pc.code,
         promo_id = pc.id,
         discount_eur = v_discount,
         total_eur = GREATEST(0, p_subtotal_eur - v_discount),
         total_fcfa = GREATEST(0, p_subtotal_eur - v_discount) * 655,
         updated_at = now()
   WHERE id = p_order_id;

  promo_id := pc.id;
  discount_eur := v_discount;
  total_eur := GREATEST(0, p_subtotal_eur - v_discount);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dekk_consume_promo(text, uuid, integer) TO anon, authenticated;

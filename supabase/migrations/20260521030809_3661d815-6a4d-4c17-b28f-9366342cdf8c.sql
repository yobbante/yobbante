
-- Stock quantitatif (NULL = illimité, 0 = rupture)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER;

-- Codes promo
CREATE TABLE IF NOT EXISTS public.dekk_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','amount_eur')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_subtotal_eur INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dekk_promo_codes_active ON public.dekk_promo_codes(active);

ALTER TABLE public.dekk_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active promos" ON public.dekk_promo_codes;
CREATE POLICY "Public read active promos"
  ON public.dekk_promo_codes FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff manage promos" ON public.dekk_promo_codes;
CREATE POLICY "Staff manage promos"
  ON public.dekk_promo_codes FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_dekk_promo_codes_updated_at
  BEFORE UPDATE ON public.dekk_promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Redemptions (trace par commande)
CREATE TABLE IF NOT EXISTS public.dekk_promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES public.dekk_promo_codes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.dekk_orders(id) ON DELETE SET NULL,
  discount_eur INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dekk_promo_redemptions_promo ON public.dekk_promo_redemptions(promo_id);

ALTER TABLE public.dekk_promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read redemptions" ON public.dekk_promo_redemptions;
CREATE POLICY "Staff read redemptions"
  ON public.dekk_promo_redemptions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Anyone insert redemption" ON public.dekk_promo_redemptions;
CREATE POLICY "Anyone insert redemption"
  ON public.dekk_promo_redemptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

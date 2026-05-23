
-- =========================================
-- 1) TABLE route_default_rates
-- =========================================
CREATE TABLE IF NOT EXISTS public.route_default_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone TEXT NOT NULL UNIQUE,
  zone_label TEXT,
  countries TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  cities TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  default_rate_per_kg NUMERIC NOT NULL,
  express_coefficient NUMERIC NOT NULL DEFAULT 1.45,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.route_default_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_default_rates readable by all" ON public.route_default_rates;
CREATE POLICY "route_default_rates readable by all"
  ON public.route_default_rates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "route_default_rates admin write" ON public.route_default_rates;
CREATE POLICY "route_default_rates admin write"
  ON public.route_default_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS route_default_rates_updated_at ON public.route_default_rates;
CREATE TRIGGER route_default_rates_updated_at
  BEFORE UPDATE ON public.route_default_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial data
INSERT INTO public.route_default_rates (zone, zone_label, countries, cities, default_rate_per_kg, express_coefficient)
VALUES
  ('europe_ouest', 'Europe de l''Ouest',
   ARRAY['FR','ES','IT','PT','BE','NL','CH','AT','DE','LU'],
   ARRAY['Paris','Lyon','Marseille','Madrid','Barcelone','Milan','Rome','Bruxelles','Amsterdam','Berlin','Geneve','Lisbonne'],
   6000, 1.45),
  ('europe_nord', 'Europe du Nord',
   ARRAY['GB','IE','SE','NO','DK','FI'],
   ARRAY['Londres','Manchester','Dublin','Stockholm','Oslo','Copenhague','Helsinki'],
   6500, 1.45),
  ('amerique_nord', 'Amerique du Nord (USA)',
   ARRAY['US'],
   ARRAY['New York','Washington','Miami','Los Angeles','Chicago','Houston','Atlanta','Boston'],
   8000, 1.45),
  ('amerique_nord_canada', 'Canada',
   ARRAY['CA'],
   ARRAY['Montreal','Toronto','Vancouver','Ottawa','Calgary'],
   7500, 1.45),
  ('afrique_ouest', 'Afrique de l''Ouest',
   ARRAY['CI','GN','ML','SN','GW','SL','BF','TG','BJ','NE'],
   ARRAY['Abidjan','Conakry','Bamako','Bissau','Lome','Cotonou','Ouagadougou','Niamey','Freetown'],
   3500, 1.45),
  ('afrique_centrale', 'Afrique Centrale',
   ARRAY['CM','GA','CG','CD','CF','TD'],
   ARRAY['Douala','Yaounde','Libreville','Brazzaville','Kinshasa'],
   4000, 1.45),
  ('moyen_orient', 'Moyen-Orient',
   ARRAY['AE','SA','QA','KW','BH','OM'],
   ARRAY['Dubai','Abu Dhabi','Riyad','Doha','Koweit'],
   7000, 1.45),
  ('asie', 'Asie',
   ARRAY['CN','JP','KR','SG','HK','TH','MY','VN'],
   ARRAY['Pekin','Shanghai','Hong Kong','Tokyo','Seoul','Singapour','Bangkok'],
   9000, 1.45)
ON CONFLICT (zone) DO NOTHING;

-- =========================================
-- 2) Extend transporteurs : rates_per_city
-- =========================================
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS rates_per_city JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rates_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rates_reminder_sent_at TIMESTAMPTZ;

-- =========================================
-- 3) Extend dossiers : pricing decomposition
-- =========================================
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS gp_rate_per_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS yobbante_margin_pct NUMERIC NOT NULL DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS enlevement_amount NUMERIC NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS hors_dakar_surcharge NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_carrier_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS displayed_price_per_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS total_displayed_price NUMERIC,
  ADD COLUMN IF NOT EXISTS total_cost_price NUMERIC,
  ADD COLUMN IF NOT EXISTS yobbante_gross_margin NUMERIC,
  ADD COLUMN IF NOT EXISTS price_is_estimate BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_express BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_outside_dakar BOOLEAN NOT NULL DEFAULT false;

-- =========================================
-- 4) Helper: lookup default rate per country/city
-- =========================================
CREATE OR REPLACE FUNCTION public.lookup_default_rate(p_country TEXT, p_city TEXT DEFAULT NULL)
RETURNS TABLE(rate_per_kg NUMERIC, express_coeff NUMERIC, zone TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_city TEXT;
BEGIN
  v_norm_city := lower(btrim(coalesce(p_city,'')));
  -- Try city match first
  IF v_norm_city <> '' THEN
    RETURN QUERY
      SELECT r.default_rate_per_kg, r.express_coefficient, r.zone
      FROM public.route_default_rates r
      WHERE r.active = true
        AND EXISTS (
          SELECT 1 FROM unnest(r.cities) c
          WHERE lower(btrim(c)) = v_norm_city
        )
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
  -- Fallback country
  IF p_country IS NOT NULL THEN
    RETURN QUERY
      SELECT r.default_rate_per_kg, r.express_coefficient, r.zone
      FROM public.route_default_rates r
      WHERE r.active = true
        AND upper(p_country) = ANY (SELECT upper(c) FROM unnest(r.countries) c)
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
  -- Final fallback
  RETURN QUERY SELECT 6000::numeric, 1.45::numeric, 'europe_ouest'::text;
END;
$$;

-- =========================================
-- 5) Helper: is address in Dakar metro
-- =========================================
CREATE OR REPLACE FUNCTION public.is_dakar_zone(p_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v TEXT;
  z TEXT;
  dakar_zones TEXT[] := ARRAY['dakar','pikine','guediawaye','rufisque','bargny','sebikotane','diamniadio'];
BEGIN
  IF p_address IS NULL OR length(btrim(p_address)) = 0 THEN
    RETURN true; -- default assume Dakar if no info
  END IF;
  v := lower(translate(p_address, 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc'));
  FOREACH z IN ARRAY dakar_zones LOOP
    IF position(z IN v) > 0 THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- =========================================
-- 6) calculate_dossier_pricing
-- =========================================
CREATE OR REPLACE FUNCTION public.calculate_dossier_pricing(p_dossier_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  v_gp RECORD;
  v_default RECORD;
  v_gp_rate NUMERIC;
  v_express_coeff NUMERIC := 1.45;
  v_weight NUMERIC;
  v_displayed_rate NUMERIC;
  v_total NUMERIC;
  v_total_cost NUMERIC;
  v_is_estimate BOOLEAN := true;
  v_outside_dakar BOOLEAN;
  v_dest_city TEXT;
  v_norm_city TEXT;
BEGIN
  SELECT * INTO d FROM public.dossiers WHERE id = p_dossier_id;
  IF d IS NULL THEN RETURN; END IF;

  v_weight := GREATEST(COALESCE(d.estimated_weight, 1), 0.5);
  v_dest_city := COALESCE(d.recipient_address, d.destination_country);
  v_norm_city := lower(btrim(coalesce(d.recipient_address,'')));
  v_outside_dakar := NOT public.is_dakar_zone(COALESCE(d.sender_address, ''));

  -- Lookup zone defaults
  SELECT * INTO v_default FROM public.lookup_default_rate(d.destination_country, NULL) LIMIT 1;
  IF v_default.express_coeff IS NOT NULL THEN
    v_express_coeff := v_default.express_coeff;
  END IF;

  -- Lookup GP rate if assigned
  v_gp_rate := NULL;
  IF d.assigned_transporteur_ref IS NOT NULL THEN
    SELECT * INTO v_gp FROM public.transporteurs WHERE reference = d.assigned_transporteur_ref LIMIT 1;
    IF v_gp IS NOT NULL THEN
      -- Try city-specific rate, then country
      IF v_gp.rates_per_city ? d.destination_country THEN
        v_gp_rate := (v_gp.rates_per_city ->> d.destination_country)::numeric;
      END IF;
      -- Try looking up any city in the rates_per_city map that matches destination
      IF v_gp_rate IS NULL THEN
        SELECT (value::text)::numeric INTO v_gp_rate
        FROM jsonb_each_text(v_gp.rates_per_city) AS kv(key, value)
        WHERE lower(translate(kv.key, 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc')) = ANY (
          SELECT lower(translate(c, 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc'))
          FROM unnest(COALESCE(v_default.zone::text, '')::text[]) c
        )
        LIMIT 1;
      END IF;
      IF v_gp_rate IS NOT NULL THEN
        v_is_estimate := false;
      END IF;
    END IF;
  END IF;

  -- Fallback to zone default
  IF v_gp_rate IS NULL THEN
    v_gp_rate := COALESCE(v_default.rate_per_kg, 6000);
    v_is_estimate := true;
  END IF;

  -- Compute displayed price per kg (with 20% margin)
  v_displayed_rate := v_gp_rate * (1 + COALESCE(d.yobbante_margin_pct, 0.20));
  IF d.is_express THEN
    v_displayed_rate := v_displayed_rate * v_express_coeff;
  END IF;

  v_total := (v_displayed_rate * v_weight)
           + COALESCE(d.enlevement_amount, 5000)
           + (CASE WHEN v_outside_dakar THEN 5000 ELSE 0 END)
           + COALESCE(d.delivery_carrier_cost, 0);

  v_total_cost := (v_gp_rate * v_weight) + COALESCE(d.enlevement_amount, 5000);

  UPDATE public.dossiers
     SET gp_rate_per_kg = v_gp_rate,
         displayed_price_per_kg = round(v_displayed_rate),
         total_displayed_price = round(v_total),
         total_cost_price = round(v_total_cost),
         yobbante_gross_margin = round(v_total - v_total_cost - (CASE WHEN v_outside_dakar THEN 5000 ELSE 0 END) - COALESCE(d.delivery_carrier_cost, 0)),
         price_is_estimate = v_is_estimate,
         is_outside_dakar = v_outside_dakar,
         hors_dakar_surcharge = CASE WHEN v_outside_dakar THEN 5000 ELSE 0 END
   WHERE id = p_dossier_id;
END;
$$;

-- =========================================
-- 7) Trigger: auto recompute on insert/relevant updates
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_dossier_recompute_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.calculate_dossier_pricing(NEW.id);
    RETURN NEW;
  END IF;

  IF NEW.assigned_transporteur_ref IS DISTINCT FROM OLD.assigned_transporteur_ref
     OR NEW.estimated_weight IS DISTINCT FROM OLD.estimated_weight
     OR NEW.destination_country IS DISTINCT FROM OLD.destination_country
     OR NEW.sender_address IS DISTINCT FROM OLD.sender_address
     OR NEW.is_express IS DISTINCT FROM OLD.is_express
     OR NEW.yobbante_margin_pct IS DISTINCT FROM OLD.yobbante_margin_pct
     OR NEW.delivery_carrier_cost IS DISTINCT FROM OLD.delivery_carrier_cost THEN
    PERFORM public.calculate_dossier_pricing(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dossier_recompute_pricing ON public.dossiers;
CREATE TRIGGER dossier_recompute_pricing
  AFTER INSERT OR UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_recompute_pricing();

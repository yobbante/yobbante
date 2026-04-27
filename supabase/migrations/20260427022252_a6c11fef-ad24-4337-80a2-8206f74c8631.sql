-- Express (AIR): 2-7 days
UPDATE public.routes_pricing
   SET eta_min_days = 2, eta_max_days = 7, updated_at = now()
 WHERE transport_type = 'AIR'
   AND destination_country = 'SN'
   AND origin_country IN ('FR','CN','US');

-- Volume (SEA): 14-28 days
UPDATE public.routes_pricing
   SET eta_min_days = 14, eta_max_days = 28, updated_at = now()
 WHERE transport_type = 'SEA'
   AND destination_country = 'SN'
   AND origin_country IN ('FR','CN','US');

-- Économique (ROAD): insert 7-14 days for the same lanes (idempotent)
INSERT INTO public.routes_pricing (origin_country, destination_country, transport_type, base_price_eur, price_per_kg_eur, eta_min_days, eta_max_days, active)
VALUES
  ('FR','SN','ROAD', 25, 4.5, 7, 14, true),
  ('CN','SN','ROAD', 40, 6.0, 7, 14, true),
  ('US','SN','ROAD', 50, 6.5, 7, 14, true)
ON CONFLICT DO NOTHING;
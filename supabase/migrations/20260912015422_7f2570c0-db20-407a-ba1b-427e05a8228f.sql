-- 1. app_settings : configuration interne réservée au staff
DROP POLICY IF EXISTS "app_settings_read_all" ON public.app_settings;
CREATE POLICY "app_settings_staff_read"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
REVOKE ALL ON public.app_settings FROM anon;

-- 2. dekk_promo_redemptions : insertion uniquement via dekk_consume_promo (SECURITY DEFINER)
DROP POLICY IF EXISTS "Anyone insert redemption" ON public.dekk_promo_redemptions;
REVOKE INSERT, UPDATE, DELETE ON public.dekk_promo_redemptions FROM anon, authenticated;
REVOKE ALL ON public.dekk_promo_redemptions FROM anon;

-- 3. manual_departures : les visiteurs anonymes n'accèdent qu'aux colonnes publiques
REVOKE ALL ON public.manual_departures FROM anon;
GRANT SELECT (
  id, origin_country, origin_city, destination_country, destination_city,
  transport_mode, departure_date, arrival_estimate, total_capacity_kg,
  available_capacity_kg, status, transporteur_ref, short_ref,
  carrier_name, carrier_company, flight_or_vessel, port_origin, port_destination,
  cutoff_date, container_type, capacity_cbm, price_per_kg_xof, price_per_cbm_xof,
  transit_days
) ON public.manual_departures TO anon;

-- 4. Vue publique : droits de l'appelant (security invoker) et sans contact transporteur
ALTER VIEW public.public_active_departures SET (security_invoker = true);
GRANT SELECT ON public.public_active_departures TO anon, authenticated;
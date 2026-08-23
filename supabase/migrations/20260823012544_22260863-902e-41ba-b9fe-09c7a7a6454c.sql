CREATE POLICY "Public can read active departures" ON public.manual_departures FOR SELECT TO anon USING (status = 'active');
GRANT SELECT ON public.manual_departures TO anon;
GRANT SELECT ON public.public_active_departures TO anon, authenticated;
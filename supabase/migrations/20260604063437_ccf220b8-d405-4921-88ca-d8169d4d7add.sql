ALTER TABLE public.manual_departures DROP CONSTRAINT manual_departures_transporteur_ref_fkey;
ALTER TABLE public.manual_departures ADD CONSTRAINT manual_departures_transporteur_ref_fkey
  FOREIGN KEY (transporteur_ref) REFERENCES public.transporteurs(reference) ON UPDATE CASCADE ON DELETE SET NULL;
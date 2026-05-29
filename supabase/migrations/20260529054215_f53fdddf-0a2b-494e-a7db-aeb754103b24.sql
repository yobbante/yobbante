
-- Enum delivery mode
DO $$ BEGIN
  CREATE TYPE public.delivery_mode_type AS ENUM ('partner_pickup', 'relay_point', 'home_delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Relay points table
CREATE TABLE IF NOT EXISTS public.relay_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  contact_phone text NOT NULL,
  contact_name text,
  quartier text NOT NULL,
  opening_hours text,
  notes text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.relay_points TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.relay_points TO authenticated;
GRANT ALL ON public.relay_points TO service_role;

ALTER TABLE public.relay_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active relay points"
  ON public.relay_points FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage relay points insert"
  ON public.relay_points FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage relay points update"
  ON public.relay_points FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage relay points delete"
  ON public.relay_points FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_relay_points_updated_at
  BEFORE UPDATE ON public.relay_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Delivery partners table (per destination country)
CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_country text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  opening_hours text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_partners_country_unique
  ON public.delivery_partners (upper(destination_country)) WHERE is_active = true;

GRANT SELECT ON public.delivery_partners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_partners TO authenticated;
GRANT ALL ON public.delivery_partners TO service_role;

ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active delivery partners"
  ON public.delivery_partners FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage delivery partners insert"
  ON public.delivery_partners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage delivery partners update"
  ON public.delivery_partners FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage delivery partners delete"
  ON public.delivery_partners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_delivery_partners_updated_at
  BEFORE UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS delivery_mode public.delivery_mode_type DEFAULT 'partner_pickup',
  ADD COLUMN IF NOT EXISTS relay_point_id uuid REFERENCES public.relay_points(id) ON DELETE SET NULL;

-- Seed: 2 relay points (disabled by default)
INSERT INTO public.relay_points (name, address, contact_phone, contact_name, quartier, is_active)
SELECT 'Relais Liberté 6', '45 rue Moussé Diop', '+221770000001', 'Responsable Liberté 6', 'Liberté 6', false
WHERE NOT EXISTS (SELECT 1 FROM public.relay_points WHERE name = 'Relais Liberté 6');

INSERT INTO public.relay_points (name, address, contact_phone, contact_name, quartier, is_active)
SELECT 'Relais Mermoz', 'VDN Mermoz', '+221770000002', 'Responsable Mermoz', 'Mermoz', false
WHERE NOT EXISTS (SELECT 1 FROM public.relay_points WHERE name = 'Relais Mermoz');

-- Trigger: on dossiers.status -> ARRIVED_HUB and partner_pickup, fire WhatsApp notif
CREATE OR REPLACE FUNCTION public.trg_dossier_partner_pickup_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/notify-partner-pickup';
BEGIN
  IF NEW.status::text = 'ARRIVED_HUB'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND COALESCE(NEW.delivery_mode, 'partner_pickup') = 'partner_pickup' THEN
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('dossier_id', NEW.id),
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_partner_pickup_notify ON public.dossiers;
CREATE TRIGGER trg_dossier_partner_pickup_notify
  AFTER UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_partner_pickup_notify();

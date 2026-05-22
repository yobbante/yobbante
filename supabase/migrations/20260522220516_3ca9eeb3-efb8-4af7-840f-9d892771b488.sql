
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'pickup_gp',
  ADD COLUMN IF NOT EXISTS relay_point_address TEXT,
  ADD COLUMN IF NOT EXISTS relay_point_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_appointment TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by_client BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_carrier TEXT,
  ADD COLUMN IF NOT EXISTS delivery_cost_xof INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_reminder_count INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.dossiers
    ADD CONSTRAINT dossiers_delivery_mode_check
    CHECK (delivery_mode IN ('pickup_gp','relay_point','home_delivery'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dossiers_delivery_dispatch
  ON public.dossiers (status, delivery_mode, delivery_notified_at);

-- Edge function dispatcher trigger
CREATE OR REPLACE FUNCTION public.trg_dossier_delivery_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/delivery-dispatch';
BEGIN
  IF NEW.status::text = 'ARRIVED_HUB'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.delivery_notified_at IS NULL THEN
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

DROP TRIGGER IF EXISTS trg_dossier_delivery_dispatch ON public.dossiers;
CREATE TRIGGER trg_dossier_delivery_dispatch
AFTER UPDATE ON public.dossiers
FOR EACH ROW
EXECUTE FUNCTION public.trg_dossier_delivery_dispatch();

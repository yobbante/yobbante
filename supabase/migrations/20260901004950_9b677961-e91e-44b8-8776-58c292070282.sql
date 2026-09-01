
CREATE TABLE IF NOT EXISTS public.sourcing_items (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  site text not null,
  relay_country text not null default 'FR',
  url text not null,
  qty integer not null default 1,
  note text,
  price_amount numeric,
  price_currency text default 'EUR',
  weight_kg numeric,
  confirmed boolean not null default false,
  reception_order_id uuid references public.reception_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_items TO authenticated;
GRANT ALL ON public.sourcing_items TO service_role;
ALTER TABLE public.sourcing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sourcing_items_owner_select" ON public.sourcing_items;
CREATE POLICY "sourcing_items_owner_select" ON public.sourcing_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dossiers d WHERE d.id = dossier_id AND d.user_id = auth.uid()));

DROP POLICY IF EXISTS "sourcing_items_owner_insert" ON public.sourcing_items;
CREATE POLICY "sourcing_items_owner_insert" ON public.sourcing_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.dossiers d WHERE d.id = dossier_id AND d.user_id = auth.uid()));

DROP POLICY IF EXISTS "sourcing_items_staff_all" ON public.sourcing_items;
CREATE POLICY "sourcing_items_staff_all" ON public.sourcing_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sourcing_items_dossier ON public.sourcing_items(dossier_id);

ALTER TABLE public.reception_orders
  ADD COLUMN IF NOT EXISTS sourcing_dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reception_orders_sourcing ON public.reception_orders(sourcing_dossier_id);

-- Sync : colis reçu au relais -> reflète dans le dossier sourcing
CREATE OR REPLACE FUNCTION public.trg_sourcing_reception_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_received int;
  v_ref text;
BEGIN
  IF NEW.sourcing_dossier_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT count(*), count(*) FILTER (WHERE status IN ('received','inspected','consolidated','in_transit','delivered'))
    INTO v_total, v_received
  FROM public.reception_orders WHERE sourcing_dossier_id = NEW.sourcing_dossier_id;

  SELECT COALESCE(tracking_id, reference) INTO v_ref FROM public.dossiers WHERE id = NEW.sourcing_dossier_id;

  UPDATE public.dossiers
     SET admin_notes = COALESCE(admin_notes, '') || E'\n[Relais D] ' || to_char(now(), 'DD/MM HH24:MI')
         || ' — colis ' || COALESCE(NEW.reference, '') || ' : ' || NEW.status
         || ' (' || v_received || '/' || v_total || ' reçus)',
         updated_at = now()
   WHERE id = NEW.sourcing_dossier_id;

  IF v_total > 0 AND v_received = v_total AND NEW.status IN ('received','inspected','consolidated') THEN
    PERFORM public.enqueue_admin_notification(
      'sourcing_all_received',
      COALESCE(v_ref, '') || ' — tous les colis reçus au relais, prêt à consolider/expédier.',
      NEW.sourcing_dossier_id,
      jsonb_build_object('received', v_received, 'total', v_total)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sourcing_reception_sync ON public.reception_orders;
CREATE TRIGGER sourcing_reception_sync
AFTER INSERT OR UPDATE OF status ON public.reception_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_sourcing_reception_sync();

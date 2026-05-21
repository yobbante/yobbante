
-- 1. Add columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weighed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS weigh_location TEXT,
  ADD COLUMN IF NOT EXISTS payment_reminders_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at TIMESTAMPTZ;

-- 2. Extend payment_status CHECK
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.dossiers'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%payment_status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.dossiers DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.dossiers
  ADD CONSTRAINT dossiers_payment_status_check
  CHECK (payment_status IN ('not_required','pending','paid','refunded','failed'));

-- 3. weight_logs
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0),
  measured_by UUID REFERENCES auth.users(id),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_weight_logs_dossier ON public.weight_logs(dossier_id);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage weight_logs" ON public.weight_logs;
CREATE POLICY "Staff manage weight_logs" ON public.weight_logs
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Client reads own weight_logs" ON public.weight_logs;
CREATE POLICY "Client reads own weight_logs" ON public.weight_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dossiers d WHERE d.id = weight_logs.dossier_id AND d.user_id = auth.uid()));

-- 4. Update lookup_dossier_public
DROP FUNCTION IF EXISTS public.lookup_dossier_public(text);
CREATE FUNCTION public.lookup_dossier_public(p_tracking text)
 RETURNS TABLE(
   tracking_id text, reference text, status dossier_status, payment_status text,
   origin_country text, destination_country text,
   estimated_weight numeric, estimated_delivery_date date, estimated_cost numeric,
   actual_weight_kg numeric, final_amount_xof numeric, cash_on_delivery boolean,
   assigned_transporteur_ref text, weighed_at timestamptz, paid_at timestamptz,
   created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    d.tracking_id, d.reference, d.status, d.payment_status,
    d.origin_country::text, d.destination_country,
    d.estimated_weight, d.estimated_delivery_date, d.estimated_cost,
    d.actual_weight_kg, d.final_amount_xof, d.cash_on_delivery,
    d.assigned_transporteur_ref, d.weighed_at, d.paid_at,
    d.created_at
  FROM public.dossiers d
  WHERE d.tracking_id = p_tracking OR d.reference = p_tracking
  LIMIT 1;
$function$;

-- 5. Block IN_TRANSIT if unpaid
CREATE OR REPLACE FUNCTION public.block_in_transit_if_unpaid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'IN_TRANSIT' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF COALESCE(NEW.payment_status, 'pending') = 'pending'
       AND COALESCE(NEW.cash_on_delivery, false) = false THEN
      RAISE EXCEPTION 'Paiement non recu — impossible de passer en transit (dossier %).', COALESCE(NEW.tracking_id, NEW.reference)
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_in_transit_if_unpaid ON public.dossiers;
CREATE TRIGGER trg_block_in_transit_if_unpaid
  BEFORE UPDATE ON public.dossiers
  FOR EACH ROW
  EXECUTE FUNCTION public.block_in_transit_if_unpaid();

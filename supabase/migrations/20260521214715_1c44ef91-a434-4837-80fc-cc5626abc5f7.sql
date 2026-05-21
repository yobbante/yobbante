-- =========================================
-- 1) Colonnes financières sur dossiers
-- =========================================
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS gp_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gp_amount_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gp_amount_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gp_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gp_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gp_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS gp_payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS gp_payment_note TEXT,
  ADD COLUMN IF NOT EXISTS gp_receipt_path TEXT;

-- Generated margin (uses COALESCE to handle nullable final_amount_xof)
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS yobbante_margin NUMERIC
  GENERATED ALWAYS AS (COALESCE(final_amount_xof, 0) - COALESCE(gp_amount, 0)) STORED;

CREATE INDEX IF NOT EXISTS idx_dossiers_gp_unpaid
  ON public.dossiers (assigned_transporteur_ref, gp_paid)
  WHERE gp_paid = false AND status = 'DELIVERED';

-- =========================================
-- 2) Colonnes tarifs sur transporteurs
-- =========================================
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS default_rate_per_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS default_routes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- =========================================
-- 3) Storage bucket pour les reçus GP (privé)
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('gp-receipts', 'gp-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Policies (drop+recreate idempotent)
DROP POLICY IF EXISTS "Staff read gp receipts" ON storage.objects;
CREATE POLICY "Staff read gp receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'gp-receipts' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff write gp receipts" ON storage.objects;
CREATE POLICY "Staff write gp receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gp-receipts' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update gp receipts" ON storage.objects;
CREATE POLICY "Staff update gp receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gp-receipts' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete gp receipts" ON storage.objects;
CREATE POLICY "Staff delete gp receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gp-receipts' AND public.is_staff(auth.uid()));
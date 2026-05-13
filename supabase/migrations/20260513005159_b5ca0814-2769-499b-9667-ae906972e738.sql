
-- Extend transporteurs with new optional fields used by GP Excel import
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS prenom text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS modes_transport text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS destinations text[] DEFAULT '{}'::text[];

-- Import logs table
CREATE TABLE IF NOT EXISTS public.gp_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gp_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read gp_import_logs"
  ON public.gp_import_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert gp_import_logs"
  ON public.gp_import_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

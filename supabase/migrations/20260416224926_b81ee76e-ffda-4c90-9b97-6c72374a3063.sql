-- 1. Add dossier_id to packages for explicit linkage
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packages_dossier_id ON public.packages(dossier_id);

-- Allow staff to update packages (needed to attach/detach to a dossier)
DROP POLICY IF EXISTS "Staff update all packages" ON public.packages;
CREATE POLICY "Staff update all packages" ON public.packages
  FOR UPDATE USING (public.is_staff(auth.uid()));

-- 2. Documents douane table
CREATE TABLE IF NOT EXISTS public.dossier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text NOT NULL DEFAULT 'other',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_documents_dossier_id ON public.dossier_documents(dossier_id);

ALTER TABLE public.dossier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read dossier documents"
  ON public.dossier_documents FOR SELECT
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = dossier_documents.dossier_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Insert dossier documents"
  ON public.dossier_documents FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.dossiers d
        WHERE d.id = dossier_documents.dossier_id AND d.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Delete dossier documents"
  ON public.dossier_documents FOR DELETE
  USING (
    public.is_staff(auth.uid())
    OR uploaded_by = auth.uid()
  );

-- 3. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dossier-documents', 'dossier-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — path convention: <dossier_id>/<filename>
CREATE POLICY "Staff or owner can read dossier docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dossier-documents'
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.dossiers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff or owner can upload dossier docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dossier-documents'
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.dossiers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff or uploader can delete dossier docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dossier-documents'
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.dossiers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.user_id = auth.uid()
      )
    )
  );
-- Enums
CREATE TYPE public.dossier_type AS ENUM ('individual', 'business_import', 'business_export', 'business_sourcing');
CREATE TYPE public.customs_document_kind AS ENUM ('proforma_invoice', 'packing_list', 'bill_of_lading', 'customs_declaration', 'commercial_invoice', 'certificate_of_origin');

-- Extend dossiers
ALTER TABLE public.dossiers
  ADD COLUMN business_id uuid REFERENCES public.business_accounts(id) ON DELETE SET NULL,
  ADD COLUMN dossier_type public.dossier_type NOT NULL DEFAULT 'individual',
  ADD COLUMN incoterm text,
  ADD COLUMN hs_code text,
  ADD COLUMN currency text DEFAULT 'EUR',
  ADD COLUMN declared_value numeric,
  ADD COLUMN supplier_name text,
  ADD COLUMN supplier_country text,
  ADD COLUMN supplier_contact text,
  ADD COLUMN buyer_name text,
  ADD COLUMN buyer_country text,
  ADD COLUMN buyer_contact text,
  ADD COLUMN quantity numeric,
  ADD COLUMN unit text;

CREATE INDEX idx_dossiers_business ON public.dossiers(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX idx_dossiers_type ON public.dossiers(dossier_type);

-- Customs documents
CREATE TABLE public.dossier_customs_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  kind public.customs_document_kind NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  reference text NOT NULL,
  generated_by uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dossier_customs_documents ENABLE ROW LEVEL SECURITY;

-- Policies on dossiers — extend for business members
CREATE POLICY "Business members view dossiers" ON public.dossiers
  FOR SELECT USING (
    business_id IS NOT NULL AND public.is_business_member(business_id, auth.uid())
  );

CREATE POLICY "Business members insert dossiers" ON public.dossiers
  FOR INSERT WITH CHECK (
    business_id IS NOT NULL
    AND public.is_business_member(business_id, auth.uid())
    AND auth.uid() = user_id
  );

CREATE POLICY "Business members update dossiers" ON public.dossiers
  FOR UPDATE USING (
    business_id IS NOT NULL AND public.is_business_member(business_id, auth.uid())
  );

-- Policies on customs documents
CREATE POLICY "Read customs documents" ON public.dossier_customs_documents
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = dossier_id
        AND (d.user_id = auth.uid() OR (d.business_id IS NOT NULL AND public.is_business_member(d.business_id, auth.uid())))
    )
  );

CREATE POLICY "Insert customs documents" ON public.dossier_customs_documents
  FOR INSERT WITH CHECK (
    auth.uid() = generated_by
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.dossiers d
        WHERE d.id = dossier_id
          AND (d.user_id = auth.uid() OR (d.business_id IS NOT NULL AND public.is_business_member(d.business_id, auth.uid())))
      )
    )
  );

CREATE POLICY "Delete customs documents" ON public.dossier_customs_documents
  FOR DELETE USING (
    public.is_staff(auth.uid()) OR generated_by = auth.uid()
  );

-- Storage policies for dossier-documents bucket (business members)
CREATE POLICY "Business members read dossier files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'dossier-documents'
    AND EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.business_id IS NOT NULL
        AND public.is_business_member(d.business_id, auth.uid())
        AND (storage.foldername(name))[1] = d.id::text
    )
  );

CREATE POLICY "Business members upload dossier files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'dossier-documents'
    AND EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.business_id IS NOT NULL
        AND public.is_business_member(d.business_id, auth.uid())
        AND (storage.foldername(name))[1] = d.id::text
    )
  );

CREATE INDEX idx_customs_docs_dossier ON public.dossier_customs_documents(dossier_id);
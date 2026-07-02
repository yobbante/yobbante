
DROP POLICY IF EXISTS "Public read anonymous quote dossier" ON public.dossiers;

DROP POLICY IF EXISTS "Users read own invoices" ON storage.objects;
CREATE POLICY "Users read own invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Deny non-staff access to legacy dossiers" ON public.legacy_dossiers;
CREATE POLICY "Deny non-staff access to legacy dossiers"
  ON public.legacy_dossiers AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.client_cancel_dossier(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_update_pickup(uuid, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_decide_departure(uuid, text, date, text) FROM anon;

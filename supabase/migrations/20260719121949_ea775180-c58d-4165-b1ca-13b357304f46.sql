DROP POLICY IF EXISTS "Anyone insert quote request dossier" ON public.dossiers;

CREATE POLICY "Anyone insert quote request dossier"
ON public.dossiers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'QUOTE_REQUESTED'::dossier_status
  AND (user_id IS NULL OR user_id = auth.uid())
  AND contact_phone IS NOT NULL
  AND length(btrim(contact_phone)) >= 6
);
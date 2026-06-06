-- Permettre user_id NULL (devis anonymes)
ALTER TABLE public.dossiers ALTER COLUMN user_id DROP NOT NULL;

-- Insertion anonyme limitée aux QUOTE_REQUESTED sans user_id
DROP POLICY IF EXISTS "Anyone insert quote request dossier" ON public.dossiers;
CREATE POLICY "Anyone insert quote request dossier"
ON public.dossiers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'QUOTE_REQUESTED'::dossier_status
  AND user_id IS NULL
  AND contact_phone IS NOT NULL
  AND length(btrim(contact_phone)) >= 6
);

-- Lecture publique d'un dossier QUOTE_REQUESTED anonyme
DROP POLICY IF EXISTS "Public read anonymous quote dossier" ON public.dossiers;
CREATE POLICY "Public read anonymous quote dossier"
ON public.dossiers
FOR SELECT
TO anon, authenticated
USING (
  status = 'QUOTE_REQUESTED'::dossier_status
  AND user_id IS NULL
);

-- Grants pour anon (les policies ci-dessus en dépendent)
GRANT INSERT ON public.dossiers TO anon;
GRANT SELECT ON public.dossiers TO anon;
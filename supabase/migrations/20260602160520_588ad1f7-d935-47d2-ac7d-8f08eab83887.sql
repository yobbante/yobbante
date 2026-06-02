-- 1) Audit table for transporteur cleanups
CREATE TABLE IF NOT EXISTS public.transporteur_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,
  transporteur_id uuid,
  reference text,
  prenom text,
  nom text,
  telephone_1 text,
  payload jsonb,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transporteur_cleanup_log TO authenticated;
GRANT ALL ON public.transporteur_cleanup_log TO service_role;

ALTER TABLE public.transporteur_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cleanup log"
ON public.transporteur_cleanup_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Log + delete duplicate phones (keep the newest, drop the older)
WITH dups AS (
  SELECT id, reference, prenom, nom, telephone_1, created_at,
         row_number() OVER (PARTITION BY telephone_1 ORDER BY created_at DESC) AS rn
  FROM public.transporteurs
  WHERE telephone_1 IS NOT NULL AND length(btrim(telephone_1)) > 0
), to_drop AS (
  SELECT * FROM dups WHERE rn > 1
), logged AS (
  INSERT INTO public.transporteur_cleanup_log
    (reason, transporteur_id, reference, prenom, nom, telephone_1, payload)
  SELECT 'duplicate_phone', id, reference, prenom, nom, telephone_1,
         jsonb_build_object('created_at', created_at)
  FROM to_drop
  RETURNING transporteur_id
)
DELETE FROM public.transporteurs t
USING logged
WHERE t.id = logged.transporteur_id;

-- 3) Log + delete test data
WITH to_drop AS (
  SELECT id, reference, prenom, nom, telephone_1
  FROM public.transporteurs
  WHERE prenom ILIKE '%test%'
     OR nom ILIKE '%test%'
     OR (prenom ILIKE '%test%' AND nom ILIKE '%maman%')
), logged AS (
  INSERT INTO public.transporteur_cleanup_log
    (reason, transporteur_id, reference, prenom, nom, telephone_1)
  SELECT 'test_data', id, reference, prenom, nom, telephone_1 FROM to_drop
  RETURNING transporteur_id
)
DELETE FROM public.transporteurs t USING logged
WHERE t.id = logged.transporteur_id;
-- New columns (all nullable for soft migration)
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS adresse_dakar_2 text,
  ADD COLUMN IF NOT EXISTS creneau_dakar text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS navettes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Comment legacy column
COMMENT ON COLUMN public.transporteurs.adresses_remise IS 'DEPRECATED: utiliser navettes. Conservé pour rétro-compatibilité de lecture.';

-- Backfill navettes from adresses_remise (one shuttle, one stop per city key)
UPDATE public.transporteurs t
SET navettes = sub.nav
FROM (
  SELECT id,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'nav_legacy',
        'villes', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'ville', key,
                'adresse', COALESCE(value::text, ''),
                'creneau', ''
              )
            )
            FROM jsonb_each_text(adresses_remise)
          ),
          '[]'::jsonb
        )
      )
    ) AS nav
  FROM public.transporteurs
  WHERE navettes = '[]'::jsonb
    AND adresses_remise IS NOT NULL
    AND adresses_remise <> '{}'::jsonb
) sub
WHERE t.id = sub.id;

-- profile_complete generated column
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS profile_complete boolean
  GENERATED ALWAYS AS (
    telephone_1 IS NOT NULL
    AND length(btrim(telephone_1)) > 0
    AND adresse_collecte_dakar IS NOT NULL
    AND length(btrim(adresse_collecte_dakar)) > 0
    AND zone IS NOT NULL
    AND length(btrim(zone)) > 0
    AND jsonb_typeof(navettes) = 'array'
    AND jsonb_array_length(navettes) > 0
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_transporteurs_profile_complete ON public.transporteurs(profile_complete);
CREATE INDEX IF NOT EXISTS idx_transporteurs_navettes_gin ON public.transporteurs USING gin (navettes);

-- Helper: does a transporteur serve a given city (or country fallback)?
CREATE OR REPLACE FUNCTION public.transporteur_serves_city(p_transporteur_id uuid, p_city text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.transporteurs t,
         jsonb_array_elements(COALESCE(t.navettes, '[]'::jsonb)) nav,
         jsonb_array_elements(COALESCE(nav->'villes', '[]'::jsonb)) v
    WHERE t.id = p_transporteur_id
      AND lower(btrim(v->>'ville')) = lower(btrim(p_city))
  );
$$;

-- Storage bucket for transporteur photos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('transporteur-photos', 'transporteur-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read on transporteur-photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Transporteur photos are public'
  ) THEN
    CREATE POLICY "Transporteur photos are public"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'transporteur-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Staff upload transporteur photos'
  ) THEN
    CREATE POLICY "Staff upload transporteur photos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'transporteur-photos' AND public.is_staff(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Staff update transporteur photos'
  ) THEN
    CREATE POLICY "Staff update transporteur photos"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'transporteur-photos' AND public.is_staff(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Staff delete transporteur photos'
  ) THEN
    CREATE POLICY "Staff delete transporteur photos"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'transporteur-photos' AND public.is_staff(auth.uid()));
  END IF;
END $$;
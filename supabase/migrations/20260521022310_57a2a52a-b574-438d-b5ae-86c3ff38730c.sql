-- 1. Add tracking_id columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS tracking_id_format TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

-- 2. Generator function (YBT-XXXXXX, 32-char alphabet without I, O, 0, 1)
CREATE OR REPLACE FUNCTION public.generate_tracking_id_v2()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  candidate TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substring(chars FROM (1 + floor(random() * length(chars)))::int FOR 1);
    END LOOP;
    candidate := 'YBT-' || result;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.dossiers WHERE tracking_id = candidate);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique tracking id';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Trigger to autofill tracking_id on new dossiers
CREATE OR REPLACE FUNCTION public.set_dossier_tracking_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := public.generate_tracking_id_v2();
    NEW.tracking_id_format := 'v2';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_dossier_tracking_id ON public.dossiers;
CREATE TRIGGER trg_set_dossier_tracking_id
  BEFORE INSERT ON public.dossiers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dossier_tracking_id();

CREATE INDEX IF NOT EXISTS idx_dossiers_tracking_id ON public.dossiers(tracking_id);

-- 4. Public lookup function (limited fields, safe for unauthenticated)
CREATE OR REPLACE FUNCTION public.lookup_dossier_public(p_tracking TEXT)
RETURNS TABLE(
  tracking_id TEXT,
  reference TEXT,
  status dossier_status,
  payment_status TEXT,
  origin_country TEXT,
  destination_country TEXT,
  estimated_weight NUMERIC,
  estimated_delivery_date DATE,
  estimated_cost NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.tracking_id,
    d.reference,
    d.status,
    d.payment_status,
    d.origin_country::text,
    d.destination_country,
    d.estimated_weight,
    d.estimated_delivery_date,
    d.estimated_cost,
    d.created_at
  FROM public.dossiers d
  WHERE d.tracking_id = p_tracking OR d.reference = p_tracking
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_dossier_public(TEXT) TO anon, authenticated;

-- 5. customer_reviews table
CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  would_recommend BOOLEAN,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_review_per_dossier UNIQUE (dossier_id)
);

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a review for a DELIVERED dossier (lookup by tracking)
CREATE POLICY "Public insert review for delivered dossier"
  ON public.customer_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = customer_reviews.dossier_id
        AND d.status = 'DELIVERED'
    )
  );

CREATE POLICY "Staff view all reviews"
  ON public.customer_reviews
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Owner view own review"
  ON public.customer_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = customer_reviews.dossier_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage reviews"
  ON public.customer_reviews
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 6. Public review check function (lets the /avis page know if a review already exists, without exposing other data)
CREATE OR REPLACE FUNCTION public.review_exists_for_tracking(p_tracking TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_reviews r
    JOIN public.dossiers d ON d.id = r.dossier_id
    WHERE d.tracking_id = p_tracking OR d.reference = p_tracking
  );
$$;

GRANT EXECUTE ON FUNCTION public.review_exists_for_tracking(TEXT) TO anon, authenticated;
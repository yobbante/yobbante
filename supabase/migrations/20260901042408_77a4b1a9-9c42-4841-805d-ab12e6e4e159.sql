CREATE TABLE public.shop_trending_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  title text NOT NULL,
  image_url text,
  product_url text NOT NULL,
  price_label text,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_trending_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_trending_products TO authenticated;
GRANT ALL ON public.shop_trending_products TO service_role;

ALTER TABLE public.shop_trending_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trending products are publicly readable when active"
ON public.shop_trending_products FOR SELECT
USING (active = true);

CREATE POLICY "Staff can read all trending products"
ON public.shop_trending_products FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert trending products"
ON public.shop_trending_products FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can update trending products"
ON public.shop_trending_products FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can delete trending products"
ON public.shop_trending_products FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_shop_trending_site ON public.shop_trending_products (site_id, active, position);
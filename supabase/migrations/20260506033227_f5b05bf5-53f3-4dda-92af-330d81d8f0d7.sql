CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  price_eur integer NOT NULL DEFAULT 0,
  price_fcfa integer NOT NULL DEFAULT 0,
  origin_country text NOT NULL DEFAULT 'OTHER',
  stock_mode text NOT NULL DEFAULT 'stock',
  delivery_days integer,
  status text NOT NULL DEFAULT 'draft',
  image_url text,
  source_type text NOT NULL DEFAULT 'reception',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR public.is_staff(auth.uid()));

CREATE POLICY "Staff manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_category ON public.products(category);
-- Drop dependent default if needed
ALTER TABLE public.products ALTER COLUMN source_type SET DEFAULT 'manual';

-- NOT NULL constraints (no existing rows so safe)
ALTER TABLE public.products ALTER COLUMN description SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN image_url SET NOT NULL;

-- CHECK constraints
ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('electronique','mode','maison','auto','tech','beaute','autre'));

ALTER TABLE public.products
  ADD CONSTRAINT products_origin_country_check
  CHECK (origin_country IN ('CN','US','FR','OTHER'));

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_mode_check
  CHECK (stock_mode IN ('stock','commande'));

ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft','published','archived'));

ALTER TABLE public.products
  ADD CONSTRAINT products_source_type_check
  CHECK (source_type IN ('manual','reception','sourcing'));

-- Auto-compute price_fcfa = price_eur * 655
CREATE OR REPLACE FUNCTION public.products_set_price_fcfa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.price_fcfa := NEW.price_eur * 655;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_set_price_fcfa ON public.products;
CREATE TRIGGER trg_products_set_price_fcfa
BEFORE INSERT OR UPDATE OF price_eur ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.products_set_price_fcfa();
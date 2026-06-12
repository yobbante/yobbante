
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS en_vente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delai_drop text,
  ADD COLUMN IF NOT EXISTS prix_achat integer;

CREATE UNIQUE INDEX IF NOT EXISTS products_ref_unique ON public.products(ref) WHERE ref IS NOT NULL;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check CHECK (
  category IN (
    'electronique','mode','maison','auto','tech','beaute','autre',
    'cachettes','gaming','rc-gadgets','pro','packs','lifestyle','bien-etre'
  )
);

-- Sequence for reception order references
CREATE SEQUENCE IF NOT EXISTS public.reception_order_seq START 1;

-- Reference generator
CREATE OR REPLACE FUNCTION public.generate_reception_reference()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  n  bigint := nextval('public.reception_order_seq');
BEGIN
  RETURN 'YOB-REC-' || yr || '-' || lpad((n % 100000)::text, 5, '0');
END;
$$;

-- ============ relay_addresses ============
CREATE TABLE public.relay_addresses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country         text NOT NULL,
  country_code    text NOT NULL,
  city            text NOT NULL,
  address_line1   text NOT NULL,
  address_line2   text,
  postal_code     text,
  phone           text,
  contact_name    text,
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relay_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active relays"
  ON public.relay_addresses FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_staff(auth.uid()));

CREATE POLICY "Staff manage relays"
  ON public.relay_addresses FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_relay_addresses_updated_at
  BEFORE UPDATE ON public.relay_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ reception_orders ============
CREATE TABLE public.reception_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             text NOT NULL UNIQUE DEFAULT public.generate_reception_reference(),
  user_id               uuid NOT NULL,
  relay_address_id      uuid NOT NULL REFERENCES public.relay_addresses(id),

  merchant_name         text NOT NULL,
  merchant_url          text,
  order_reference       text,
  order_description     text NOT NULL,
  estimated_value_eur   numeric,
  estimated_weight_kg   numeric,
  expected_packages     integer NOT NULL DEFAULT 1,

  goods_type            text NOT NULL DEFAULT 'standard',
  transport_mode        text NOT NULL DEFAULT 'air',
  priority              text NOT NULL DEFAULT 'standard',

  status                text NOT NULL DEFAULT 'pending_arrival',
  actual_weight_kg      numeric,
  actual_dimensions_cm  jsonb,
  final_price_xof       integer,
  final_price_eur       numeric,
  payment_status        text NOT NULL DEFAULT 'pending',

  shipment_id           uuid,
  internal_note         text,
  client_note           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reception_orders_user ON public.reception_orders(user_id);
CREATE INDEX idx_reception_orders_status ON public.reception_orders(status);
CREATE INDEX idx_reception_orders_relay ON public.reception_orders(relay_address_id);

ALTER TABLE public.reception_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reception orders"
  ON public.reception_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own reception orders"
  ON public.reception_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users update own reception orders"
  ON public.reception_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage reception orders"
  ON public.reception_orders FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_reception_orders_updated_at
  BEFORE UPDATE ON public.reception_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ reception_packages ============
CREATE TABLE public.reception_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.reception_orders(id) ON DELETE CASCADE,
  package_number  integer NOT NULL DEFAULT 1,
  weight_kg       numeric,
  dimensions_cm   jsonb,
  photo_url       text,
  received_at     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reception_packages_order ON public.reception_packages(order_id);

ALTER TABLE public.reception_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reception packages"
  ON public.reception_packages FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.reception_orders o
      WHERE o.id = reception_packages.order_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage reception packages"
  ON public.reception_packages FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ============ Seed relay addresses (placeholders) ============
INSERT INTO public.relay_addresses (country, country_code, city, address_line1, address_line2, postal_code, phone, contact_name, active, notes) VALUES
  ('États-Unis', 'US', 'Miami', '[À renseigner — adresse Miami]', 'Suite TBD', '33101', '+1 305 000 0000', 'Yobbanté Relay USA', true, 'Placeholder — à mettre à jour dans l''admin'),
  ('France', 'FR', 'Paris', '[À renseigner — adresse Paris]', NULL, '75000', '+33 1 00 00 00 00', 'Yobbanté Relay France', true, 'Placeholder — à mettre à jour dans l''admin'),
  ('Chine', 'CN', 'Guangzhou', '[À renseigner — adresse Guangzhou]', NULL, '510000', '+86 20 0000 0000', 'Yobbanté Relay China', true, 'Placeholder — à mettre à jour dans l''admin'),
  ('Royaume-Uni', 'GB', 'Londres', '[À renseigner — adresse Londres]', NULL, 'SW1A 1AA', '+44 20 0000 0000', 'Yobbanté Relay UK', true, 'Placeholder — à mettre à jour dans l''admin'),
  ('Émirats arabes unis', 'AE', 'Dubaï', '[À renseigner — adresse Dubaï]', NULL, '00000', '+971 4 000 0000', 'Yobbanté Relay UAE', true, 'Placeholder — à mettre à jour dans l''admin');
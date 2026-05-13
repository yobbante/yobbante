
CREATE TABLE IF NOT EXISTS public.dekk_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  city text NOT NULL,
  address text NOT NULL,
  note text,
  payment_method text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_eur integer NOT NULL DEFAULT 0,
  total_eur integer NOT NULL DEFAULT 0,
  total_fcfa integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'awaiting_payment',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dekk_orders_created_idx ON public.dekk_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS dekk_orders_status_idx ON public.dekk_orders (status);

CREATE TABLE IF NOT EXISTS public.dekk_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.dekk_orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dekk_order_events_order_idx ON public.dekk_order_events (order_id, created_at DESC);

ALTER TABLE public.dekk_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dekk_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_insert_order" ON public.dekk_orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone_select_order" ON public.dekk_orders
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_update_order" ON public.dekk_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff_delete_order" ON public.dekk_orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "anyone_select_event" ON public.dekk_order_events
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_insert_event" ON public.dekk_order_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE OR REPLACE FUNCTION public.dekk_orders_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS dekk_orders_touch_trg ON public.dekk_orders;
CREATE TRIGGER dekk_orders_touch_trg BEFORE UPDATE ON public.dekk_orders
  FOR EACH ROW EXECUTE FUNCTION public.dekk_orders_touch();

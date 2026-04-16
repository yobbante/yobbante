
-- Enums
CREATE TYPE public.warehouse_country AS ENUM ('FR', 'CN', 'US');
CREATE TYPE public.package_status AS ENUM ('CREATED', 'RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED');
CREATE TYPE public.shipment_status AS ENUM ('PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED');

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  default_delivery_country TEXT DEFAULT 'SN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Addresses
CREATE TABLE public.addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country warehouse_country NOT NULL,
  address_line TEXT NOT NULL,
  identifier_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, country)
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own addresses" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Shipments
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status shipment_status NOT NULL DEFAULT 'PENDING',
  total_cost NUMERIC(10,2),
  eta TIMESTAMPTZ,
  transport_type TEXT,
  konnekt_id TEXT,
  origin_country warehouse_country NOT NULL,
  destination_country TEXT NOT NULL DEFAULT 'SN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shipments" ON public.shipments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shipments" ON public.shipments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shipments" ON public.shipments FOR UPDATE USING (auth.uid() = user_id);

-- Packages
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warehouse_country warehouse_country NOT NULL,
  status package_status NOT NULL DEFAULT 'CREATED',
  weight NUMERIC(10,2),
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own packages" ON public.packages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own packages" ON public.packages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own packages" ON public.packages FOR UPDATE USING (auth.uid() = user_id);

-- Timeline events
CREATE TABLE public.timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  related_package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  related_shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.timeline_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.timeline_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_packages_user ON public.packages(user_id);
CREATE INDEX idx_packages_status ON public.packages(status);
CREATE INDEX idx_shipments_user ON public.shipments(user_id);
CREATE INDEX idx_timeline_user ON public.timeline_events(user_id);
CREATE INDEX idx_timeline_created ON public.timeline_events(created_at DESC);
CREATE INDEX idx_addresses_user ON public.addresses(user_id);
CREATE INDEX idx_addresses_identifier ON public.addresses(identifier_code);

-- Generate unique identifier code
CREATE OR REPLACE FUNCTION public.generate_identifier_code(p_country warehouse_country)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN UPPER(p_country::text) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
END;
$$;

-- Auto-create profile + addresses on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  addr_fr TEXT;
  addr_cn TEXT;
  addr_us TEXT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  addr_fr := generate_identifier_code('FR');
  addr_cn := generate_identifier_code('CN');
  addr_us := generate_identifier_code('US');

  INSERT INTO public.addresses (user_id, country, address_line, identifier_code) VALUES
    (NEW.id, 'FR', '12 Rue de la Logistique, 93200 Saint-Denis, France', addr_fr),
    (NEW.id, 'CN', 'Room 501, Building 3, Nanshan District, Shenzhen 518000, China', addr_cn),
    (NEW.id, 'US', '1200 NW 78th Ave, Suite 200, Miami, FL 33126, USA', addr_us);

  INSERT INTO public.timeline_events (user_id, event_type, title, description)
  VALUES (NEW.id, 'WELCOME', 'Welcome to Yobbanté', 'Your warehouse addresses are ready. Start shopping worldwide!');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

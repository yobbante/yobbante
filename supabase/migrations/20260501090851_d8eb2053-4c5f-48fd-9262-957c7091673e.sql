-- Enums
CREATE TYPE public.business_member_role AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE public.business_invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE public.business_invoice_status AS ENUM ('draft', 'unpaid', 'paid', 'overdue', 'cancelled');

-- Members
CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.business_member_role NOT NULL DEFAULT 'operator',
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- Invitations
CREATE TABLE public.business_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.business_member_role NOT NULL DEFAULT 'operator',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.business_invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;

-- Invoices
CREATE TABLE public.business_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  amount_eur numeric NOT NULL DEFAULT 0,
  amount_xof integer,
  status public.business_invoice_status NOT NULL DEFAULT 'unpaid',
  issued_at date NOT NULL DEFAULT current_date,
  due_at date NOT NULL DEFAULT (current_date + interval '30 days'),
  paid_at timestamptz,
  description text,
  shipment_id uuid,
  dossier_id uuid,
  last_reminder_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_invoices ENABLE ROW LEVEL SECURITY;

-- Account managers
CREATE TABLE public.business_account_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  manager_user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  whatsapp text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_account_managers ENABLE ROW LEVEL SECURITY;

-- Helper: membership check (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE id = _business_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE id = _business_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = _user_id AND role = 'admin'
  );
$$;

-- Invoice reference generator
CREATE SEQUENCE IF NOT EXISTS public.business_invoice_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_business_invoice_reference()
RETURNS text LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE yr text := to_char(now(), 'YYYY'); n bigint := nextval('public.business_invoice_seq');
BEGIN RETURN 'YOB-INV-' || yr || '-' || lpad((n % 100000)::text, 5, '0'); END;
$$;

ALTER TABLE public.business_invoices ALTER COLUMN reference SET DEFAULT public.generate_business_invoice_reference();

-- Updated_at triggers
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.business_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_managers_updated BEFORE UPDATE ON public.business_account_managers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-mark overdue invoices
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  WITH upd AS (
    UPDATE public.business_invoices
       SET status = 'overdue'
     WHERE status = 'unpaid' AND due_at < current_date
     RETURNING id
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;

-- RLS: business_members
CREATE POLICY "Members view own business members" ON public.business_members
  FOR SELECT USING (public.is_business_member(business_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Admins insert members" ON public.business_members
  FOR INSERT WITH CHECK (public.is_business_admin(business_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Admins update members" ON public.business_members
  FOR UPDATE USING (public.is_business_admin(business_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Admins delete members" ON public.business_members
  FOR DELETE USING (public.is_business_admin(business_id, auth.uid()) OR public.is_staff(auth.uid()));

-- RLS: invitations
CREATE POLICY "Admins view invitations" ON public.business_invitations
  FOR SELECT USING (public.is_business_admin(business_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Admins create invitations" ON public.business_invitations
  FOR INSERT WITH CHECK ((public.is_business_admin(business_id, auth.uid()) OR public.is_staff(auth.uid())) AND invited_by = auth.uid());
CREATE POLICY "Admins update invitations" ON public.business_invitations
  FOR UPDATE USING (public.is_business_admin(business_id, auth.uid()) OR public.is_staff(auth.uid()));

-- RLS: invoices
CREATE POLICY "Members view invoices" ON public.business_invoices
  FOR SELECT USING (public.is_business_member(business_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage invoices" ON public.business_invoices
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- RLS: account managers
CREATE POLICY "Members view account manager" ON public.business_account_managers
  FOR SELECT USING (public.is_business_member(business_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage account managers" ON public.business_account_managers
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Indexes
CREATE INDEX idx_business_members_user ON public.business_members(user_id);
CREATE INDEX idx_business_members_business ON public.business_members(business_id);
CREATE INDEX idx_business_invitations_email ON public.business_invitations(email);
CREATE INDEX idx_business_invitations_token ON public.business_invitations(token);
CREATE INDEX idx_business_invoices_business ON public.business_invoices(business_id);
CREATE INDEX idx_business_invoices_status ON public.business_invoices(status);
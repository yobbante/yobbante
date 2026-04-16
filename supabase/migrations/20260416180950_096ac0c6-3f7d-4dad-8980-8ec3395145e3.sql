-- 1. Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'staff')
  )
$$;

-- RLS for user_roles: users see own, admins see all
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Dossier messages (client <-> staff conversation)
CREATE TABLE public.dossier_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('client', 'staff')),
  body text NOT NULL,
  internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dossier_messages_dossier ON public.dossier_messages(dossier_id, created_at DESC);

ALTER TABLE public.dossier_messages ENABLE ROW LEVEL SECURITY;

-- Client sees non-internal messages on own dossiers; staff sees all
CREATE POLICY "Read dossier messages" ON public.dossier_messages
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR (
      NOT internal_note
      AND EXISTS (SELECT 1 FROM public.dossiers d WHERE d.id = dossier_id AND d.user_id = auth.uid())
    )
  );

CREATE POLICY "Insert dossier messages" ON public.dossier_messages
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_staff(auth.uid())
      OR (
        author_role = 'client'
        AND internal_note = false
        AND EXISTS (SELECT 1 FROM public.dossiers d WHERE d.id = dossier_id AND d.user_id = auth.uid())
      )
    )
  );

-- 3. Staff RLS on dossiers / packages / timeline_events / profiles
CREATE POLICY "Staff view all dossiers" ON public.dossiers
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff update all dossiers" ON public.dossiers
  FOR UPDATE USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff view all packages" ON public.packages
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff view all timeline" ON public.timeline_events
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert timeline" ON public.timeline_events
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = user_id IS NOT NULL);

CREATE POLICY "Staff view profiles" ON public.profiles
  FOR SELECT USING (public.is_staff(auth.uid()));

-- 4. Admin notes on dossiers (internal field, only staff can see/write)
ALTER TABLE public.dossiers ADD COLUMN admin_notes text;

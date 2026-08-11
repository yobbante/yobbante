CREATE TABLE IF NOT EXISTS public.bot_global_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.bot_global_settings TO authenticated;
GRANT ALL ON public.bot_global_settings TO service_role;

ALTER TABLE public.bot_global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read bot settings" ON public.bot_global_settings;
CREATE POLICY "Staff can read bot settings" ON public.bot_global_settings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "Staff can update bot settings" ON public.bot_global_settings;
CREATE POLICY "Staff can update bot settings" ON public.bot_global_settings
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

INSERT INTO public.bot_global_settings (id, paused) VALUES (true, false) ON CONFLICT (id) DO NOTHING;
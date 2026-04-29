-- Grant admin role to workbasse@outlook.fr (now if account exists, otherwise on signup)

-- 1. If the account already exists, insert the admin role immediately
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'workbasse@outlook.fr'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Auto-grant admin on signup for this specific email
CREATE OR REPLACE FUNCTION public.grant_super_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'workbasse@outlook.fr' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_super_admin_on_signup_trg ON auth.users;
CREATE TRIGGER grant_super_admin_on_signup_trg
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.grant_super_admin_on_signup();
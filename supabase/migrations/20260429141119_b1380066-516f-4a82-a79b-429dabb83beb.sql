-- Re-affirme le rôle super-admin pour workbasse@outlook.fr (idempotent).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'workbasse@outlook.fr'
ON CONFLICT (user_id, role) DO NOTHING;
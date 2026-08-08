GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT INSERT ON public.dekk_orders TO anon, authenticated;
GRANT ALL ON public.dekk_orders TO service_role;

CREATE OR REPLACE FUNCTION public.dekk_order_id_by_ref(p_reference text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.dekk_orders
   WHERE reference = p_reference
     AND created_at > now() - interval '30 minutes'
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.dekk_order_id_by_ref(text) TO anon, authenticated;
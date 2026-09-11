REVOKE ALL ON FUNCTION public.recompute_parent_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_child_status_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_child_tracking_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_parent_status(uuid) TO service_role;
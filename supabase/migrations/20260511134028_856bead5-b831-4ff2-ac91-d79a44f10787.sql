-- Audit fixes — missing pieces from the 6-bloc audit

-- 1) BLOC 3 — Block deletion of manual_departures if confirmed shipments exist
CREATE OR REPLACE FUNCTION public.block_delete_manual_departure_with_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
    FROM public.shipments
   WHERE manual_departure_id = OLD.id
     AND status NOT IN ('CANCELLED','DELIVERED');
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Impossible de supprimer ce départ : % envois confirmés y sont rattachés. Annulez-les d''abord.', cnt
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delete_manual_dep ON public.manual_departures;
CREATE TRIGGER trg_block_delete_manual_dep
BEFORE DELETE ON public.manual_departures
FOR EACH ROW EXECUTE FUNCTION public.block_delete_manual_departure_with_bookings();

-- 2) BLOC 3 — Auto-expire past manual departures (still 'active' or 'draft' but date passed)
CREATE OR REPLACE FUNCTION public.expire_past_manual_departures()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  WITH upd AS (
    UPDATE public.manual_departures
       SET status = 'cancelled', updated_at = now()
     WHERE status IN ('active','draft')
       AND departure_date < current_date - interval '1 day'
     RETURNING id
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_past_manual_departures() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.block_delete_manual_departure_with_bookings() FROM anon, public;
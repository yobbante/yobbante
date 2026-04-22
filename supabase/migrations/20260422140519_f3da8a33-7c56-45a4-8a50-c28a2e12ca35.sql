-- Forward-only state machine for package status.
-- Order: CREATED → RECEIVED → IN_STORAGE → READY_TO_SHIP → SHIPPED → DELIVERED.
-- Any update that moves a package backward (or to the same step) is rejected
-- at the database level so no client, edge function, or admin tool can corrupt history.

CREATE OR REPLACE FUNCTION public.enforce_package_status_forward()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ranks CONSTANT text[] := ARRAY['CREATED','RECEIVED','IN_STORAGE','READY_TO_SHIP','SHIPPED','DELIVERED'];
  old_rank int;
  new_rank int;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  old_rank := array_position(ranks, OLD.status::text);
  new_rank := array_position(ranks, NEW.status::text);

  IF new_rank IS NULL OR old_rank IS NULL THEN
    RAISE EXCEPTION 'Statut de colis inconnu (% → %)', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF new_rank <= old_rank THEN
    RAISE EXCEPTION 'Transition invalide : un colis « % » ne peut pas revenir à « % ».', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_packages_status_forward ON public.packages;
CREATE TRIGGER trg_packages_status_forward
BEFORE UPDATE OF status ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_package_status_forward();

-- Make sure realtime delivers the FULL row (incl. updated status) so the
-- front-end can render in-order timeline events without an extra round-trip.
ALTER TABLE public.packages REPLICA IDENTITY FULL;
ALTER TABLE public.shipments REPLICA IDENTITY FULL;
ALTER TABLE public.timeline_events REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication (idempotent).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) New enum values (idempotent)
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'RETURN_IN_PROGRESS';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'RETURNED';

-- 2) New columns
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS return_reason_category TEXT,
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_source TEXT;

-- 3) Timestamp + auto-release trigger when a dossier is cancelled or returned
CREATE OR REPLACE FUNCTION public.trg_dossier_lifecycle_side_effects()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Cancellation entering
  IF NEW.status = 'CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED' THEN
    IF NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
    NEW.assigned_departure_id := NULL;
  END IF;

  -- Return requested
  IF NEW.status = 'RETURN_REQUESTED' AND OLD.status IS DISTINCT FROM 'RETURN_REQUESTED' THEN
    IF NEW.return_requested_at IS NULL THEN NEW.return_requested_at := now(); END IF;
  END IF;

  -- Return completed
  IF NEW.status = 'RETURNED' AND OLD.status IS DISTINCT FROM 'RETURNED' THEN
    IF NEW.return_completed_at IS NULL THEN NEW.return_completed_at := now(); END IF;
    NEW.assigned_departure_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_lifecycle_side_effects ON public.dossiers;
CREATE TRIGGER trg_dossier_lifecycle_side_effects
  BEFORE UPDATE OF status ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_lifecycle_side_effects();

-- 4) Refund request auto-creation on cancellation/return if paid
CREATE OR REPLACE FUNCTION public.trg_dossier_autorefund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount NUMERIC;
BEGIN
  IF NEW.status IN ('CANCELLED', 'RETURNED')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(NEW.payment_status, '') = 'paid' THEN
    v_amount := COALESCE(NEW.final_amount_xof, NEW.estimated_cost, 0);
    IF v_amount > 0 THEN
      INSERT INTO public.refund_requests (dossier_id, user_id, amount_eur, reason, status)
      SELECT NEW.id, NEW.user_id, v_amount,
             CASE WHEN NEW.status = 'CANCELLED'
                  THEN COALESCE(NEW.cancellation_reason, 'Dossier annulé')
                  ELSE COALESCE(NEW.return_reason, 'Colis retourné') END,
             'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.refund_requests r
        WHERE r.dossier_id = NEW.id AND r.status IN ('pending','processing','sent')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_autorefund ON public.dossiers;
CREATE TRIGGER trg_dossier_autorefund
  AFTER UPDATE OF status ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_autorefund();

-- 5) Extend admin cancellation notification (currently only when cancelled_by='client')
CREATE OR REPLACE FUNCTION public.trg_notify_admin_dossier_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg TEXT; v_who TEXT;
BEGIN
  IF NEW.status = 'CANCELLED'
     AND OLD.status IS DISTINCT FROM 'CANCELLED' THEN
    v_who := COALESCE(NULLIF(NEW.cancelled_by, ''), NULLIF(NEW.cancellation_source, ''), 'admin');
    v_msg :=
      E'DOSSIER ANNULE (' || v_who || E')\n'
      || COALESCE(NEW.tracking_id, NEW.reference) || ' . ' || COALESCE(NEW.sender_name, 'Client') || E'\n'
      || 'Raison : ' || COALESCE(NEW.cancellation_reason, 'non precisee') || E'\n'
      || 'Paiement : ' || COALESCE(NEW.payment_status, 'pending') || E'\n'
      || CASE WHEN NEW.payment_status = 'paid'
              THEN 'Si paye -> rembourser via Wave' ELSE '' END;
    PERFORM public.notify_admin_http('dossier_cancelled', v_msg, NEW.id,
      'dossier_cancelled:' || NEW.id::text, 240);
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Return notification
CREATE OR REPLACE FUNCTION public.trg_notify_admin_dossier_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg TEXT;
BEGIN
  IF NEW.status IN ('RETURN_REQUESTED','RETURNED')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_msg :=
      CASE WHEN NEW.status = 'RETURN_REQUESTED' THEN E'RETOUR DEMANDE\n' ELSE E'COLIS RETOURNE\n' END
      || COALESCE(NEW.tracking_id, NEW.reference) || ' . ' || COALESCE(NEW.sender_name, 'Client') || E'\n'
      || 'Categorie : ' || COALESCE(NEW.return_reason_category, 'autre') || E'\n'
      || 'Raison : ' || COALESCE(NEW.return_reason, 'non precisee');
    PERFORM public.notify_admin_http('dossier_return', v_msg, NEW.id,
      'dossier_return:' || NEW.id::text || ':' || NEW.status::text, 240);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_dossier_return ON public.dossiers;
CREATE TRIGGER trg_admin_dossier_return
  AFTER UPDATE OF status ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_dossier_return();

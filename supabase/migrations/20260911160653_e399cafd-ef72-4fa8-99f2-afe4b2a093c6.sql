-- 1. Rang de progression d'un statut de dossier (pour agréger les colis)
CREATE OR REPLACE FUNCTION public.dossier_status_rank(s public.dossier_status)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE s
    WHEN 'SUBMITTED' THEN 10
    WHEN 'QUOTE_REQUESTED' THEN 11
    WHEN 'QUOTE_SENT' THEN 12
    WHEN 'QUOTE_ACCEPTED' THEN 13
    WHEN 'QUOTE_REFUSED' THEN 13
    WHEN 'IN_REVIEW' THEN 15
    WHEN 'AWAITING_CLIENT' THEN 16
    WHEN 'STALE' THEN 16
    WHEN 'CONFIRMED' THEN 20
    WHEN 'EN_RECHERCHE_DEPART' THEN 22
    WHEN 'ASSIGNED' THEN 24
    WHEN 'DEPARTURE_CONFIRMED' THEN 26
    WHEN 'SOURCING' THEN 28
    WHEN 'PROCURED' THEN 29
    WHEN 'COLLECTING' THEN 30
    WHEN 'COLLECTED' THEN 32
    WHEN 'WEIGHED' THEN 34
    WHEN 'IN_TRANSIT' THEN 40
    WHEN 'CUSTOMS' THEN 45
    WHEN 'ARRIVED_HUB' THEN 50
    WHEN 'OUT_FOR_DELIVERY' THEN 55
    WHEN 'DELIVERED' THEN 60
    WHEN 'CLOSED' THEN 65
    WHEN 'RETURN_REQUESTED' THEN 70
    WHEN 'RETURN_IN_PROGRESS' THEN 71
    WHEN 'RETURNED' THEN 72
    WHEN 'CANCELLED' THEN 90
    WHEN 'ARCHIVED' THEN 95
    ELSE 35
  END;
$$;

-- 2. Recalcul du statut du dossier parent a partir de ses colis
CREATE OR REPLACE FUNCTION public.recompute_parent_status(p_parent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.dossier_status;
  v_active int;
  v_total int;
BEGIN
  IF p_parent_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_total FROM public.dossiers WHERE parent_dossier_id = p_parent_id;
  IF v_total = 0 THEN RETURN; END IF;

  SELECT count(*) INTO v_active
    FROM public.dossiers
   WHERE parent_dossier_id = p_parent_id
     AND status NOT IN ('CANCELLED','ARCHIVED');

  IF v_active = 0 THEN
    v_status := 'CANCELLED';
  ELSE
    SELECT status INTO v_status
      FROM public.dossiers
     WHERE parent_dossier_id = p_parent_id
       AND status NOT IN ('CANCELLED','ARCHIVED')
     ORDER BY public.dossier_status_rank(status) ASC, split_index ASC
     LIMIT 1;
  END IF;

  UPDATE public.dossiers
     SET status = v_status,
         split_count = v_total,
         updated_at = now()
   WHERE id = p_parent_id
     AND status IS DISTINCT FROM v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_child_status_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_parent_status(OLD.parent_dossier_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_parent_status(NEW.parent_dossier_id);
  IF TG_OP = 'UPDATE' AND OLD.parent_dossier_id IS DISTINCT FROM NEW.parent_dossier_id THEN
    PERFORM public.recompute_parent_status(OLD.parent_dossier_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_child_status_sync ON public.dossiers;
CREATE TRIGGER trg_dossier_child_status_sync
AFTER INSERT OR DELETE OR UPDATE OF status, parent_dossier_id ON public.dossiers
FOR EACH ROW
WHEN (pg_trigger_depth() < 3)
EXECUTE FUNCTION public.trg_child_status_sync();

-- 3. Numero de suivi propre a chaque colis (retro-actif)
UPDATE public.dossiers c
   SET tracking_id = COALESCE(p.tracking_id, p.reference) || '-' || COALESCE(c.split_index, 1)
  FROM public.dossiers p
 WHERE c.parent_dossier_id = p.id
   AND (c.tracking_id IS NULL OR c.tracking_id = p.tracking_id);

-- 4. Table des paiements de dossier (encaissements client + reversements)
CREATE TABLE IF NOT EXISTS public.dossier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('client','carrier')),
  amount_xof numeric NOT NULL,
  method text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  payee text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_payments_dossier ON public.dossier_payments(dossier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossier_payments TO authenticated;
GRANT ALL ON public.dossier_payments TO service_role;

ALTER TABLE public.dossier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage dossier payments"
ON public.dossier_payments FOR ALL TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients read their own client payments"
ON public.dossier_payments FOR SELECT TO authenticated
USING (
  direction = 'client'
  AND EXISTS (
    SELECT 1 FROM public.dossiers d
     WHERE d.id = dossier_payments.dossier_id
       AND d.user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS trg_dossier_payments_updated_at ON public.dossier_payments;
CREATE TRIGGER trg_dossier_payments_updated_at
BEFORE UPDATE ON public.dossier_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Ajouter un colis a un envoi existant
CREATE OR REPLACE FUNCTION public.add_dossier_parcel(p_dossier_id uuid, p_part jsonb)
RETURNS SETOF public.dossiers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_parent public.dossiers%ROWTYPE;
  v_children int;
  v_i int;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Non autorise';
  END IF;

  SELECT * INTO v_parent FROM public.dossiers WHERE id = p_dossier_id;
  IF v_parent.id IS NULL THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF v_parent.parent_dossier_id IS NOT NULL THEN RAISE EXCEPTION 'Ce dossier est deja un colis'; END IF;

  SELECT count(*) INTO v_children FROM public.dossiers WHERE parent_dossier_id = p_dossier_id;

  IF v_children = 0 THEN
    RETURN QUERY SELECT * FROM public.split_dossier(
      p_dossier_id,
      jsonb_build_array(
        jsonb_build_object(
          'description', v_parent.product_description,
          'weight', COALESCE(v_parent.actual_weight_kg, v_parent.estimated_weight),
          'transporteur_ref', v_parent.assigned_transporteur_ref,
          'status', v_parent.status::text
        ),
        p_part
      )
    );
    RETURN;
  END IF;

  SELECT COALESCE(MAX(split_index), 0) + 1 INTO v_i
    FROM public.dossiers WHERE parent_dossier_id = p_dossier_id;

  INSERT INTO public.dossiers (
    user_id, business_id, dossier_type, status, app_source, source, intake_method,
    origin_country, origin_city, destination_country, destination_city,
    product_description, estimated_weight, actual_weight_kg, quantity, unit,
    declared_value, currency, transport_mode, delivery_mode,
    sender_name, sender_phone, sender_address,
    recipient_name, recipient_phone, recipient_address,
    contact_phone, contact_email,
    pickup_zone, pickup_quartier, pickup_date, is_outside_dakar,
    relay_point_id, relay_point_name, relay_point_address,
    assigned_transporteur_ref, assigned_departure_id, gp_id,
    final_amount_xof, notes, admin_notes,
    reference, tracking_id, parent_dossier_id, split_index, split_count,
    skip_whatsapp_trigger
  ) VALUES (
    v_parent.user_id, v_parent.business_id, v_parent.dossier_type,
    COALESCE(NULLIF(p_part->>'status','')::public.dossier_status, v_parent.status),
    v_parent.app_source, v_parent.source, v_parent.intake_method,
    v_parent.origin_country, v_parent.origin_city, v_parent.destination_country, v_parent.destination_city,
    COALESCE(NULLIF(p_part->>'description',''), v_parent.product_description),
    NULLIF(p_part->>'weight','')::numeric,
    NULLIF(p_part->>'weight','')::numeric,
    v_parent.quantity, v_parent.unit,
    v_parent.declared_value, v_parent.currency,
    COALESCE(NULLIF(p_part->>'transport_mode',''), v_parent.transport_mode),
    v_parent.delivery_mode,
    v_parent.sender_name, v_parent.sender_phone, v_parent.sender_address,
    v_parent.recipient_name, v_parent.recipient_phone, v_parent.recipient_address,
    v_parent.contact_phone, v_parent.contact_email,
    v_parent.pickup_zone, v_parent.pickup_quartier, v_parent.pickup_date, v_parent.is_outside_dakar,
    v_parent.relay_point_id, v_parent.relay_point_name, v_parent.relay_point_address,
    NULLIF(p_part->>'transporteur_ref',''),
    NULLIF(p_part->>'departure_id','')::uuid,
    NULLIF(p_part->>'gp_id','')::uuid,
    NULLIF(p_part->>'amount','')::numeric,
    NULLIF(p_part->>'notes',''), v_parent.admin_notes,
    v_parent.reference || '-' || v_i,
    COALESCE(v_parent.tracking_id, v_parent.reference) || '-' || v_i,
    v_parent.id, v_i, v_children + 1,
    true
  );

  UPDATE public.dossiers SET split_count = v_children + 1, updated_at = now()
   WHERE parent_dossier_id = p_dossier_id OR id = p_dossier_id;

  RETURN QUERY
    SELECT * FROM public.dossiers WHERE parent_dossier_id = p_dossier_id ORDER BY split_index;
END;
$$;

REVOKE ALL ON FUNCTION public.add_dossier_parcel(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_dossier_parcel(uuid, jsonb) TO authenticated, service_role;

-- 6. Refusionner quand il ne reste qu'un colis actif
CREATE OR REPLACE FUNCTION public.merge_dossier_parcels(p_dossier_id uuid)
RETURNS public.dossiers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active public.dossiers%ROWTYPE;
  v_count int;
  v_result public.dossiers%ROWTYPE;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Non autorise';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.dossiers
   WHERE parent_dossier_id = p_dossier_id
     AND status NOT IN ('CANCELLED','ARCHIVED');

  IF v_count > 1 THEN
    RAISE EXCEPTION 'Il reste plusieurs colis actifs';
  END IF;

  SELECT * INTO v_active
    FROM public.dossiers
   WHERE parent_dossier_id = p_dossier_id
     AND status NOT IN ('CANCELLED','ARCHIVED')
   LIMIT 1;

  IF v_active.id IS NOT NULL THEN
    UPDATE public.dossiers p
       SET status = v_active.status,
           actual_weight_kg = COALESCE(v_active.actual_weight_kg, p.actual_weight_kg),
           assigned_transporteur_ref = COALESCE(v_active.assigned_transporteur_ref, p.assigned_transporteur_ref),
           assigned_departure_id = COALESCE(v_active.assigned_departure_id, p.assigned_departure_id),
           gp_id = COALESCE(v_active.gp_id, p.gp_id),
           updated_at = now()
     WHERE p.id = p_dossier_id;
  END IF;

  DELETE FROM public.dossiers WHERE parent_dossier_id = p_dossier_id;

  UPDATE public.dossiers SET split_count = NULL, split_index = NULL, updated_at = now()
   WHERE id = p_dossier_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_dossier_parcels(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_dossier_parcels(uuid) TO authenticated, service_role;

-- 7. Les nouveaux colis crees par split_dossier heritent aussi d'un tracking propre
CREATE OR REPLACE FUNCTION public.trg_child_tracking_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_parent_track text;
BEGIN
  IF NEW.parent_dossier_id IS NOT NULL AND NEW.tracking_id IS NULL THEN
    SELECT COALESCE(tracking_id, reference) INTO v_parent_track
      FROM public.dossiers WHERE id = NEW.parent_dossier_id;
    NEW.tracking_id := v_parent_track || '-' || COALESCE(NEW.split_index, 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_child_tracking ON public.dossiers;
CREATE TRIGGER trg_dossier_child_tracking
BEFORE INSERT ON public.dossiers
FOR EACH ROW EXECUTE FUNCTION public.trg_child_tracking_id();
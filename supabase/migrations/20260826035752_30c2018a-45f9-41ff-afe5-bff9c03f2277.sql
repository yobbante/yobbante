
CREATE OR REPLACE FUNCTION public.sync_dossier_to_fret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fret_courses fc
  SET total_fcfa = COALESCE(NEW.final_amount_xof, fc.total_fcfa),
      client_nom = COALESCE(NEW.recipient_name, fc.client_nom),
      client_phone = COALESCE(NEW.recipient_phone, fc.client_phone),
      expediteur_nom = COALESCE(NEW.sender_name, fc.expediteur_nom),
      expediteur_phone = COALESCE(NEW.sender_phone, fc.expediteur_phone),
      destination = COALESCE(NEW.destination_city, fc.destination),
      weight_kg = COALESCE(NEW.actual_weight_kg, NEW.estimated_weight, fc.weight_kg),
      pickup_zone = COALESCE(NEW.pickup_zone, fc.pickup_zone),
      colis_description = COALESCE(NEW.product_description, fc.colis_description),
      updated_at = now()
  WHERE fc.dossier_id = NEW.id
    AND fc.status <> 'ANNULE';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dossier_to_fret ON public.dossiers;
CREATE TRIGGER trg_sync_dossier_to_fret
AFTER UPDATE ON public.dossiers
FOR EACH ROW
WHEN (
  NEW.final_amount_xof IS DISTINCT FROM OLD.final_amount_xof
  OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
  OR NEW.recipient_phone IS DISTINCT FROM OLD.recipient_phone
  OR NEW.sender_name IS DISTINCT FROM OLD.sender_name
  OR NEW.sender_phone IS DISTINCT FROM OLD.sender_phone
  OR NEW.destination_city IS DISTINCT FROM OLD.destination_city
  OR NEW.actual_weight_kg IS DISTINCT FROM OLD.actual_weight_kg
  OR NEW.estimated_weight IS DISTINCT FROM OLD.estimated_weight
  OR NEW.pickup_zone IS DISTINCT FROM OLD.pickup_zone
  OR NEW.product_description IS DISTINCT FROM OLD.product_description
)
EXECUTE FUNCTION public.sync_dossier_to_fret();

CREATE OR REPLACE FUNCTION public.sync_fret_to_dossier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.dossier_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.dossiers d
  SET final_amount_xof = COALESCE(NEW.total_fcfa, d.final_amount_xof),
      actual_weight_kg = COALESCE(NEW.weight_kg, d.actual_weight_kg),
      pickup_zone = COALESCE(NEW.pickup_zone, d.pickup_zone)
  WHERE d.id = NEW.dossier_id
    AND (
      d.final_amount_xof IS DISTINCT FROM COALESCE(NEW.total_fcfa, d.final_amount_xof)
      OR d.actual_weight_kg IS DISTINCT FROM COALESCE(NEW.weight_kg, d.actual_weight_kg)
      OR d.pickup_zone IS DISTINCT FROM COALESCE(NEW.pickup_zone, d.pickup_zone)
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fret_to_dossier ON public.fret_courses;
CREATE TRIGGER trg_sync_fret_to_dossier
AFTER INSERT OR UPDATE ON public.fret_courses
FOR EACH ROW
EXECUTE FUNCTION public.sync_fret_to_dossier();

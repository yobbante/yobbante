CREATE OR REPLACE FUNCTION public.log_internal_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_label text;
  v_user uuid;
  v_entity uuid;
BEGIN
  IF TG_TABLE_NAME = 'internal_tasks' THEN
    IF TG_OP = 'INSERT' THEN v_action := 'task_created'; v_label := NEW.title;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := CASE WHEN NEW.status = 'termine' THEN 'task_completed' ELSE 'task_status_changed' END;
      v_label := NEW.title || ' → ' || NEW.status;
    ELSE v_action := 'task_updated'; v_label := NEW.title;
    END IF;
    v_user := COALESCE(auth.uid(), NEW.created_by);
    v_entity := NEW.id;
  ELSIF TG_TABLE_NAME = 'partenaires_logistique' THEN
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'partner_created' ELSE 'partner_updated' END;
    v_label := NEW.nom || ' (' || NEW.chantier || COALESCE(' · ' || NEW.zone_label, '') || ')';
    v_user := COALESCE(auth.uid(), NEW.updated_by, NEW.created_by);
    v_entity := NEW.id;
  ELSE
    v_action := 'task_comment';
    v_label := left(NEW.body, 120);
    v_user := COALESCE(auth.uid(), NEW.author_id);
    v_entity := NEW.task_id;
  END IF;

  INSERT INTO public.staff_activity_log (user_id, action, entity_type, entity_id, label)
  VALUES (v_user, v_action, TG_TABLE_NAME, v_entity, v_label);
  RETURN NEW;
END
$$;
REVOKE EXECUTE ON FUNCTION public.log_internal_activity() FROM PUBLIC, anon, authenticated;
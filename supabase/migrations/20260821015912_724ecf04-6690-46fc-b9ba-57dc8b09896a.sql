create or replace function public.admin_delete_dossier(_dossier_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff')) then
    raise exception 'Non autorisé';
  end if;

  delete from public.fret_course_events
    where course_id in (select id from public.fret_courses where dossier_id = _dossier_id);
  delete from public.fret_courses where dossier_id = _dossier_id;
  delete from public.devis where dossier_id = _dossier_id;
  delete from public.packages where dossier_id = _dossier_id;
  delete from public.admin_notifications where dossier_id = _dossier_id;
  delete from public.edit_tokens where entity_id = _dossier_id;

  delete from public.dossiers where id = _dossier_id;
end;
$$;
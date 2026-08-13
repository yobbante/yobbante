
CREATE POLICY "Staff can upload admin attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admin-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

CREATE POLICY "Staff can read admin attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admin-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

CREATE POLICY "Staff can delete admin attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'admin-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

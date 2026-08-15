
CREATE POLICY "staff read fret photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fret-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff upload fret photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fret-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff update fret photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fret-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff delete fret photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fret-photos' AND public.is_staff(auth.uid()));

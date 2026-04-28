-- Create public bucket for reception package photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('reception-photos', 'reception-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Public read reception photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'reception-photos');

-- Staff write
CREATE POLICY "Staff upload reception photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reception-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update reception photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reception-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete reception photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reception-photos' AND public.is_staff(auth.uid()));
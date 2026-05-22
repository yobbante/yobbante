INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read voice-messages" ON storage.objects;
CREATE POLICY "Public read voice-messages"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-messages');
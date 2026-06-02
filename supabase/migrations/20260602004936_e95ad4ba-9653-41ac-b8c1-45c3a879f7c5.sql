
INSERT INTO public.dossier_messages (dossier_id, author_id, author_role, body, internal_note, source, created_at)
SELECT
  w.dossier_id,
  NULL::uuid,
  'staff',
  '📲 WhatsApp → client' || E'\n\n' || w.message_body,
  false,
  'wa_out:' || w.id::text,
  w.created_at
FROM public.whatsapp_outbound_messages w
WHERE w.dossier_id IS NOT NULL
  AND w.recipient_type = 'client'
  AND w.status = 'sent'
  AND w.message_body IS NOT NULL
  AND length(btrim(w.message_body)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.dossier_messages m
    WHERE m.source = 'wa_out:' || w.id::text
  );

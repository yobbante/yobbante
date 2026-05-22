// webhook-whatsapp — receives Meta webhooks for BOTH numbers (607 + 122).
// Routes:
//   - 607 (clients) -> log inbound + notify admin
//   - 122 (GP)      -> delegate to gp-bot
//   - statuses      -> update whatsapp_outbound_messages
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function normalizePhone(input?: string | null): string {
  return (input || '').toString().replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  // -----  GET — Meta verification handshake -----
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && verifyToken && verifyToken === expected) {
      console.log('WA_WEBHOOK verified');
      return new Response(challenge ?? 'ok', { status: 200 });
    }
    console.error('WA_ERROR webhook verify failed');
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  // -----  POST — Meta event -----
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log('WA_WEBHOOK_IN', JSON.stringify(payload).slice(0, 500));

  try {
    const entries = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const metadata = value?.metadata ?? {};
        const displayPhone: string = metadata?.display_phone_number ?? '';
        const isGp = displayPhone.includes('122');
        const channel: 'client' | 'gp' = isGp ? 'gp' : 'client';

        // ---- Statuses (delivery updates) ----
        for (const st of value?.statuses ?? []) {
          try {
            await supa
              .from('whatsapp_outbound_messages')
              .update({ status: st.status })
              .eq('wamid', st.id);
          } catch (e) {
            console.error('WA_ERROR status update', e);
          }
        }

        // ---- Incoming messages ----
        const contacts = value?.contacts ?? [];
        const contactByWaId: Record<string, any> = {};
        for (const c of contacts) {
          if (c?.wa_id) contactByWaId[c.wa_id] = c;
        }

        for (const msg of value?.messages ?? []) {
          const fromPhone = normalizePhone(msg?.from);
          const fromName = contactByWaId[msg?.from]?.profile?.name ?? null;
          const wamid = msg?.id ?? null;
          let body: string | null = null;
          let mediaUrl: string | null = null;
          const messageType: string = msg?.type ?? 'text';

          if (messageType === 'text') {
            body = msg?.text?.body ?? null;
          } else if (messageType === 'button') {
            body = msg?.button?.text ?? null;
          } else if (messageType === 'interactive') {
            body =
              msg?.interactive?.button_reply?.title ??
              msg?.interactive?.list_reply?.title ??
              JSON.stringify(msg?.interactive ?? {});
          } else if (messageType === 'image' || messageType === 'document' || messageType === 'audio' || messageType === 'video') {
            body = msg?.[messageType]?.caption ?? `[${messageType}]`;
            const mediaId = msg?.[messageType]?.id ?? null;
            mediaUrl = mediaId;

            // For audio (voice notes), download and store in Supabase Storage so admin can play them
            if (messageType === 'audio' && mediaId && wamid) {
              try {
                const waToken = Deno.env.get('WHATSAPP_TOKEN');
                if (waToken) {
                  // 1. Resolve media URL
                  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
                    headers: { Authorization: `Bearer ${waToken}` },
                  });
                  if (metaRes.ok) {
                    const meta = await metaRes.json();
                    const mediaTempUrl = meta?.url;
                    const mimeType: string = meta?.mime_type ?? 'audio/ogg';
                    if (mediaTempUrl) {
                      // 2. Download the audio bytes
                      const audioRes = await fetch(mediaTempUrl, {
                        headers: { Authorization: `Bearer ${waToken}` },
                      });
                      if (audioRes.ok) {
                        const bytes = new Uint8Array(await audioRes.arrayBuffer());
                        const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : 'ogg';
                        const path = `${wamid}.${ext}`;
                        // 3. Upload to public bucket
                        const { error: upErr } = await supa.storage
                          .from('voice-messages')
                          .upload(path, bytes, { contentType: mimeType, upsert: true });
                        if (!upErr) {
                          const { data: pub } = supa.storage.from('voice-messages').getPublicUrl(path);
                          mediaUrl = pub?.publicUrl ?? mediaUrl;
                          console.log('WA_AUDIO stored', path);
                        } else {
                          console.error('WA_ERROR audio upload', upErr.message);
                        }
                      }
                    }
                  } else {
                    console.error('WA_ERROR audio meta', metaRes.status);
                  }
                }
              } catch (e) {
                console.error('WA_ERROR audio fetch', e instanceof Error ? e.message : String(e));
              }
            }
          } else {
            body = `[${messageType}]`;
          }

          // Look up dossier and transporteur for context
          let dossierId: string | null = null;
          let transporteurId: string | null = null;

          if (channel === 'client') {
            const { data: dossier } = await supa
              .from('dossiers')
              .select('id')
              .eq('contact_phone', fromPhone)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            dossierId = dossier?.id ?? null;
          } else {
            const { data: gp } = await supa
              .from('transporteurs')
              .select('id')
              .or(`telephone_1.ilike.%${fromPhone.slice(-9)}%,whatsapp.ilike.%${fromPhone.slice(-9)}%`)
              .limit(1)
              .maybeSingle();
            transporteurId = gp?.id ?? null;
          }

          // Insert inbound message (upsert to dedupe via wamid)
          let insertedRow: any = null;
          try {
            const { data, error } = await supa
              .from('whatsapp_inbound_messages')
              .upsert(
                {
                  from_phone: fromPhone,
                  from_name: fromName,
                  to_number: displayPhone,
                  message_body: body,
                  message_type: messageType,
                  media_url: mediaUrl,
                  dossier_id: dossierId,
                  transporteur_id: transporteurId,
                  channel,
                  wamid,
                },
                { onConflict: 'wamid', ignoreDuplicates: false },
              )
              .select()
              .maybeSingle();
            if (error) console.error('WA_ERROR insert inbound', error.message);
            insertedRow = data;
          } catch (e) {
            console.error('WA_ERROR insert inbound', e);
          }

          // Route to bot or notify admin
          if (channel === 'gp') {
            // Delegate to gp-bot
            try {
              const botRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gp-bot`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  inbound_id: insertedRow?.id,
                  from_phone: fromPhone,
                  from_name: fromName,
                  transporteur_id: transporteurId,
                  message: body,
                }),
              });
              if (!botRes.ok) console.error('WA_ERROR gp-bot', await botRes.text());
            } catch (e) {
              console.error('WA_ERROR gp-bot fetch', e);
            }
          } else {
            // Notify admin on 607 (free-text, requires admin to have messaged the bot in 24h)
            const adminPhone = Deno.env.get('ADMIN_WHATSAPP_NUMBER');
            if (adminPhone && fromPhone !== normalizePhone(adminPhone)) {
              const preview = (body ?? '').slice(0, 80);
              const adminMsg = `📩 Client ${fromName ?? fromPhone} (${fromPhone}) :
"${preview}${(body ?? '').length > 80 ? '…' : ''}"

→ yobbante.com/admin/messages`;
              try {
                await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    recipient_phone: adminPhone,
                    recipient_type: 'admin',
                    message: adminMsg,
                    trigger_type: 'admin_inbound_notification',
                  }),
                });
              } catch (e) {
                console.error('WA_ERROR admin notify', e);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('WA_ERROR webhook handler', e instanceof Error ? e.message : String(e));
    // Always 200 to Meta to avoid retries storms
  }

  return new Response('ok', { status: 200, headers: corsHeaders });
});

// webhook-whatsapp — receives Meta webhooks for BOTH numbers (607 + 122).
// Routes:
//   - 607 (clients) -> log inbound + notify admin
//   - 926 (GP)      -> delegate to gp-bot
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
        // GP bot tourne sur le nouveau numero +221 78 926 97 56 (ancien 122 supprime).
        const gpNumber = Deno.env.get('WHATSAPP_GP_BOT_NUMBER') ?? '221789269756';
        const gpDigits = gpNumber.replace(/\D/g, '').slice(-9);
        const displayDigits = displayPhone.replace(/\D/g, '');
        const isGp = displayDigits.endsWith(gpDigits) || displayPhone.includes('122') || displayPhone.includes('926');
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

          // ---- ANTI-DOUBLON : wamid deja traite recemment ? ----
          if (wamid) {
            try {
              const cutoff = new Date(Date.now() - 30_000).toISOString();
              const { data: dup } = await supa
                .from('whatsapp_inbound_messages')
                .select('id, created_at')
                .eq('wamid', wamid)
                .gte('created_at', cutoff)
                .limit(1)
                .maybeSingle();
              if (dup) {
                console.log('WA_DEDUP skip wamid', wamid);
                continue;
              }
            } catch (e) {
              console.error('WA_DEDUP check failed', e instanceof Error ? e.message : String(e));
            }
          }

          let body: string | null = null;
          let mediaUrl: string | null = null;
          const messageType: string = msg?.type ?? 'text';

          if (messageType === 'text') {
            body = msg?.text?.body ?? null;
          } else if (messageType === 'button') {
            body = msg?.button?.text ?? null;
          } else if (messageType === 'interactive') {
            // Préfère l'id (utilisé pour router vers une commande) ;
            // le title est gardé en mémoire dans body si pas d'id.
            const btn = msg?.interactive?.button_reply;
            const lst = msg?.interactive?.list_reply;
            body =
              btn?.id ??
              lst?.id ??
              btn?.title ??
              lst?.title ??
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
          let livreurId: string | null = null;
          let isLivreur = false;

          // Check if sender is a registered livreur (priority on GP channel)
          if (channel === 'gp') {
            const tail = fromPhone.slice(-9);
            const { data: liv } = await supa
              .from('livreurs')
              .select('id, is_active')
              .ilike('telephone', `%${tail}%`)
              .limit(1)
              .maybeSingle();
            if (liv?.id) { livreurId = liv.id; isLivreur = true; }
          }

          if (channel === 'client') {
            const { data: dossier } = await supa
              .from('dossiers')
              .select('id')
              .eq('contact_phone', fromPhone)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            dossierId = dossier?.id ?? null;
          } else if (!isLivreur) {
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

          // ---- SUPER ADMIN (+221784604003) priorite absolue ----
          // Ce numero n'est NI client NI GP. On le route directement vers
          // super-admin-bot, peu importe le channel (607 ou 926), et on
          // saute toute notification "MESSAGE CLIENT" / bot-client / gp-bot.
          const SUPER_ADMIN_PHONE = (
            Deno.env.get('SUPER_ADMIN_PHONE')
            || Deno.env.get('ADMIN_WHATSAPP_NUMBER')
            || '+221784604003'
          ).replace(/\D/g, '');
          const isSuperAdmin = !!SUPER_ADMIN_PHONE && (
            fromPhone === SUPER_ADMIN_PHONE
            || fromPhone.endsWith(SUPER_ADMIN_PHONE)
            || SUPER_ADMIN_PHONE.endsWith(fromPhone)
          );

          if (isSuperAdmin) {
            try {
              const botRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/super-admin-bot`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  inbound_id: insertedRow?.id,
                  from_phone: fromPhone,
                  from_name: fromName,
                  message: body,
                  channel,
                }),
              });
              if (!botRes.ok) console.error('WA_ERROR super-admin-bot', await botRes.text());
            } catch (e) {
              console.error('WA_ERROR super-admin-bot fetch', e);
            }
            continue; // skip client/gp routing for super admin
          }

          // Route to bot or notify admin
          if (channel === 'gp' && isLivreur) {
            // Delegate to livreur-bot
            try {
              const botRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/livreur-bot`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  inbound_id: insertedRow?.id,
                  from_phone: fromPhone,
                  from_name: fromName,
                  livreur_id: livreurId,
                  message: body,
                  message_type: messageType,
                  media_url: mediaUrl,
                }),
              });
              if (!botRes.ok) console.error('WA_ERROR livreur-bot', await botRes.text());
            } catch (e) {
              console.error('WA_ERROR livreur-bot fetch', e);
            }
          } else if (channel === 'gp') {
            // Auto-relance onboarding : si c'est le PREMIER message inbound du GP
            // (donc la fenetre Meta 24h vient de s'ouvrir) et qu'on a deja envoye
            // une invitation bot par le passe, on relance l'onboarding par API.
            if (transporteurId) {
              try {
                const { count } = await supa
                  .from('whatsapp_inbound_messages')
                  .select('id', { count: 'exact', head: true })
                  .eq('channel', 'gp')
                  .eq('transporteur_id', transporteurId);
                const isFirstInbound = (count ?? 0) <= 1;
                if (isFirstInbound) {
                  const { data: gp } = await supa
                    .from('transporteurs')
                    .select('id, reference, nom, prenom, telephone_1, invitation_bot_sent_at')
                    .eq('id', transporteurId)
                    .maybeSingle();
                  if (gp?.invitation_bot_sent_at) {
                    const prenom = (gp.prenom?.trim() || gp.nom?.split(' ')[0] || 'partenaire');
                    const ref = `GP${String(gp.reference ?? '').replace(/\D/g, '').padStart(4, '0')}`;
                    const onboardMsg =
                      `Salam ${prenom}, bienvenue ! Vous etes a present connecte au bot Yobbante GP (926). ` +
                      `Envoyez AIDE pour voir comment recevoir vos missions. Reference : ${ref}.`;
                    (async () => {
                      const SUPER_ADMIN_PHONE = '+221784604003';
                      const GP_LINE_DISPLAY = '+221 78 926 97 56';
                      const supaUrl = Deno.env.get('SUPABASE_URL')!;
                      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
                      const gpLabel = `${(gp.prenom ?? '').trim()} ${(gp.nom ?? '').trim()}`.trim() || 'GP';
                      const phoneDigits = String(gp.telephone_1 ?? '').replace(/\D/g, '');
                      const waLink = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(onboardMsg)}`;
                      try {
                        const r = await fetch(`${supaUrl}/functions/v1/gp-smart-invite`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${anonKey}`,
                          },
                          body: JSON.stringify({
                            phone: gp.telephone_1,
                            message: onboardMsg,
                            gp_name: gpLabel,
                            gp_ref: ref,
                            transporteur_id: gp.id,
                            kind: 'bot_onboard',
                            trigger_type: 'auto_relance_first_inbound',
                          }),
                        });
                        const json = await r.json().catch(() => ({} as any));
                        if (!r.ok || json?.ok === false) {
                          const cause = !r.ok
                            ? `HTTP ${r.status} ${json?.error ?? ''}`.trim()
                            : (json?.blocked_reason
                                ? `Echec gp-smart-invite : ${json.blocked_reason}`
                                : 'Echec gp-smart-invite');
                          const fallback = json?.wa_link ?? waLink;
                          const adminMsg = [
                            `Alerte auto-relance GP echouee :`,
                            `${gpLabel} (${ref}) - ${gp.telephone_1}`,
                            `Cause : ${cause}`,
                            ``,
                            `Envoyer manuellement depuis le compte ${GP_LINE_DISPLAY} (926) :`,
                            fallback,
                          ].join('\n');
                          await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
                            body: JSON.stringify({
                              recipient_phone: SUPER_ADMIN_PHONE,
                              recipient_type: 'admin',
                              message: adminMsg,
                              client_name: gpLabel,
                              trigger_type: 'auto_relance_failed_alert',
                            }),
                          }).catch((e) => console.error('WA_ERROR alert admin send', e));
                        }
                      } catch (e) {
                        console.error('WA_ERROR auto-relance', e);
                        const cause = e instanceof Error ? e.message : String(e);
                        const adminMsg = [
                          `Alerte auto-relance GP echouee (exception) :`,
                          `${gpLabel} (${ref}) - ${gp.telephone_1}`,
                          `Cause : ${cause}`,
                          ``,
                          `Envoyer manuellement depuis le compte ${GP_LINE_DISPLAY} (926) :`,
                          waLink,
                        ].join('\n');
                        await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
                          body: JSON.stringify({
                            recipient_phone: SUPER_ADMIN_PHONE,
                            recipient_type: 'admin',
                            message: adminMsg,
                            client_name: gpLabel,
                            trigger_type: 'auto_relance_failed_alert',
                          }),
                        }).catch((err) => console.error('WA_ERROR alert admin send', err));
                      }
                    })();
                  }
                }
              } catch (e) {
                console.error('WA_ERROR auto-relance check', e);
              }
            }

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
            // Channel = client (607). Super admin deja traite plus haut.
            // EVENT 8 — Notify admin of new client message (dedup 30 min per contact).
            try {
              const firstName = fromName ? fromName.split(' ')[0] : '';
              const adminMsg =
                `MESSAGE CLIENT\n` +
                `${firstName ? firstName + ' ' : ''}(${fromPhone})\n\n` +
                `Message : ${(body || '').slice(0, 240)}\n\n` +
                `Repondre :\nMSG ${fromPhone} [message]`;
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/admin-notify`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  notification_type: 'client_message',
                  message: adminMsg,
                  dedup_key: `client_message:${fromPhone}`,
                  window_minutes: 30,
                }),
              });
            } catch (e) {
              console.error('WA_ERROR admin-notify client_message', e);
            }

            // Delegate to bot-client
            try {
              const botRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/bot-client`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  inbound_id: insertedRow?.id,
                  from_phone: fromPhone,
                  from_name: fromName,
                  message: body,
                }),
              });
              if (!botRes.ok) console.error('WA_ERROR bot-client', await botRes.text());
            } catch (e) {
              console.error('WA_ERROR bot-client fetch', e);
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

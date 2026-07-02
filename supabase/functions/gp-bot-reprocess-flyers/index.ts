// gp-bot-reprocess-flyers — Re-run Claude Vision on past GP flyer images
// that were received but never analyzed (or failed). Triggered manually from
// the admin UI. Processes at most 10 images per run.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SINCE_DATE = '2026-06-09T00:00:00Z';
const MAX_PER_RUN = 10;
// bot_intent values that mean the image was already analyzed by Claude
const PROCESSED_INTENTS = new Set([
  'image_ia_propose',
  'image_ia_hors_zone',
  'image_ia_low_confidence',
  'image_ia_reprocessed',
  'photo_saved',
]);

interface ParsedFlyer {
  hors_zone?: boolean;
  ville_depart?: string;
  ville_arrivee?: string;
  destinations_secondaires?: string[] | null;
  date_depart?: string | null;
  date_depot_limite?: string | null;
  multi_trajets?: boolean;
  ville_retour?: string | null;
  date_retour?: string | null;
  confiance?: 'haute' | 'moyenne' | 'basse';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: service-role bearer OR authenticated user required ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  {
    let __ok = !!__SR && __auth === `Bearer ${__SR}`;
    if (!__ok && __auth.toLowerCase().startsWith('bearer ')) {
      try {
        const { createClient: __cc } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
        const __sb = __cc(Deno.env.get('SUPABASE_URL')!, __SR, {
          global: { headers: { Authorization: __auth } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: { user: __u } } = await __sb.auth.getUser();
        __ok = !!__u;
      } catch { /* ignore */ }
    }
    if (!__ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
      });
    }
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const waToken = Deno.env.get('WHATSAPP_TOKEN');
  if (!anthropicKey) {
    return json({ error: 'ANTHROPIC_API_KEY missing' }, 500);
  }

  // 1. Find candidate inbound images
  const { data: candidates, error: qErr } = await supa
    .from('whatsapp_inbound_messages')
    .select('id, from_phone, media_url, bot_intent, received_at')
    .eq('message_type', 'image')
    .gte('received_at', SINCE_DATE)
    .not('media_url', 'is', null)
    .order('received_at', { ascending: false })
    .limit(50);

  if (qErr) return json({ error: qErr.message }, 500);

  const pending = (candidates ?? []).filter(
    (m) => !m.bot_intent || !PROCESSED_INTENTS.has(m.bot_intent),
  ).slice(0, MAX_PER_RUN);

  const demain = new Date(Date.now() + 86400 * 1000);
  const ddmmyyyy = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const systemPrompt = `Tu analyses des flyers de GP (transporteurs voyageurs) qui transportent des colis entre des villes internationales.

Règles d'extraction :
- ville_depart : ville de départ explicite sur le flyer. Ne pas supposer Dakar par défaut.
- ville_arrivee : destination principale du trajet. Si plusieurs villes, prendre la première. Mettre les autres dans destinations_secondaires.
- FILTRE OBLIGATOIRE : si ni ville_depart ni ville_arrivee n'est Dakar ou une ville d'Afrique de l'Ouest → répondre {hors_zone: true}.
- date_depart : convertir en DD/MM/YYYY. Si 'demain' → ${ddmmyyyy(demain)}.
- Ne jamais extraire le prix/tarif du flyer.
- multi_trajets : true si flyer contient aller + retour.

Réponds UNIQUEMENT en JSON valide :
{"hors_zone":boolean,"ville_depart":string,"ville_arrivee":string,"destinations_secondaires":string[]|null,"date_depart":"DD/MM/YYYY"|null,"date_depot_limite":"DD/MM/YYYY"|null,"multi_trajets":boolean,"ville_retour":string|null,"date_retour":string|null,"telephone_gp":string|null,"confiance":"haute"|"moyenne"|"basse"}
Si ville_arrivee ET date_depart absents → {"confiance":"basse"}`;

  const results: any[] = [];

  for (const msg of pending) {
    const r: any = { id: msg.id, from_phone: msg.from_phone, status: 'pending' };
    try {
      // 2a. Resolve transporteur from phone (any tail-9 match, active)
      const tail = (msg.from_phone || '').replace(/\D/g, '').slice(-9);
      let transporteur: any = null;
      if (tail.length >= 8) {
        const { data: t } = await supa
          .from('transporteurs')
          .select('id, prenom, reference, telephone_1, whatsapp, actif')
          .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
          .eq('actif', true)
          .limit(1)
          .maybeSingle();
        transporteur = t;
      }
      if (!transporteur) {
        r.status = 'skipped_no_gp';
        await supa.from('whatsapp_inbound_messages')
          .update({ bot_intent: 'image_ia_skipped_no_gp' })
          .eq('id', msg.id);
        results.push(r);
        continue;
      }

      // 2b. Resolve media: stored value is either a full URL or a Meta media ID
      const stored = (msg.media_url || '').trim();
      let downloadUrl = stored;
      if (!/^https?:\/\//i.test(stored)) {
        // Meta media ID → resolve via Graph API
        if (!waToken) {
          r.status = 'no_wa_token';
          results.push(r);
          continue;
        }
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${stored}`, {
          headers: { Authorization: `Bearer ${waToken}` },
        });
        if (!metaRes.ok) {
          r.status = `meta_resolve_${metaRes.status}`;
          await supa.from('whatsapp_inbound_messages')
            .update({ bot_intent: 'image_ia_fetch_failed' })
            .eq('id', msg.id);
          results.push(r);
          continue;
        }
        const metaJson = await metaRes.json();
        downloadUrl = metaJson?.url;
        if (!downloadUrl) {
          r.status = 'meta_no_url';
          results.push(r);
          continue;
        }
      }

      // 2c. Download image bytes
      const imgRes = await fetch(downloadUrl, {
        headers: waToken ? { Authorization: `Bearer ${waToken}` } : {},
      });
      if (!imgRes.ok) {
        r.status = `fetch_failed_${imgRes.status}`;
        await supa.from('whatsapp_inbound_messages')
          .update({ bot_intent: 'image_ia_fetch_failed' })
          .eq('id', msg.id);
        results.push(r);
        continue;
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);

      // 2c. Claude Vision
      const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: contentType, data: b64 } },
              { type: 'text', text: 'Analyse ce flyer GP et réponds uniquement en JSON.' },
            ],
          }],
        }),
      });
      if (!anthRes.ok) {
        r.status = `anthropic_${anthRes.status}`;
        results.push(r);
        continue;
      }
      const anthJson = await anthRes.json();
      const rawText: string = anthJson?.content?.[0]?.text ?? '';
      const m = rawText.match(/\{[\s\S]*\}/);
      if (!m) {
        r.status = 'no_json';
        results.push(r);
        continue;
      }
      const parsed = JSON.parse(m[0]) as ParsedFlyer;

      // 2d. Filter weak / hors zone
      if (parsed.hors_zone === true) {
        r.status = 'hors_zone';
        await supa.from('whatsapp_inbound_messages')
          .update({ bot_intent: 'image_ia_hors_zone' })
          .eq('id', msg.id);
        results.push(r);
        continue;
      }
      if (parsed.confiance === 'basse' || !parsed.ville_arrivee || !parsed.date_depart) {
        r.status = 'low_confidence';
        await supa.from('whatsapp_inbound_messages')
          .update({ bot_intent: 'image_ia_low_confidence' })
          .eq('id', msg.id);
        results.push(r);
        continue;
      }

      // 2e. Save session (10 min — bot reads updated_at to gate)
      const dest2 = Array.isArray(parsed.destinations_secondaires)
        ? (parsed.destinations_secondaires.filter(Boolean) as string[])
        : [];
      const normalizedPhone = msg.from_phone.startsWith('+')
        ? msg.from_phone
        : '+' + msg.from_phone.replace(/\D/g, '');

      // Upsert session: clear any old then insert
      await supa.from('gp_bot_sessions').delete().eq('from_phone', msg.from_phone);
      await supa.from('gp_bot_sessions').insert({
        transporteur_id: transporteur.id,
        from_phone: msg.from_phone,
        pending_intent: 'image_dep_confirm',
        pending_data: {
          ville_depart: parsed.ville_depart,
          ville_arrivee: parsed.ville_arrivee,
          destinations_secondaires: dest2,
          date_depart: parsed.date_depart,
          date_depot_limite: parsed.date_depot_limite ?? null,
          multi_trajets: !!parsed.multi_trajets,
          ville_retour: parsed.ville_retour ?? null,
          date_retour: parsed.date_retour ?? null,
          confiance: parsed.confiance,
          source: 'reprocess',
        },
      });

      // 2f. Send recap via 926
      const lines = [
        `J'ai relu votre annonce 👀`,
        ``,
        `🛫 ${parsed.ville_depart} → ${parsed.ville_arrivee}`,
      ];
      if (dest2.length) lines.push(`Via : ${dest2.join(', ')}`);
      lines.push(`📅 ${parsed.date_depart}`);
      if (parsed.multi_trajets && parsed.ville_retour && parsed.date_retour) {
        lines.push(`🔄 Retour : ${parsed.ville_retour} ${parsed.date_retour}`);
      }
      lines.push(``, `Je cree ce depart ? Repondez OUI pour confirmer.`);

      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          recipient_phone: normalizedPhone,
          recipient_type: 'gp',
          message: lines.join('\n'),
          transporteur_id: transporteur.id,
          trigger_type: 'reprocess_image_ia_propose',
        }),
      });

      await supa.from('whatsapp_inbound_messages')
        .update({ bot_intent: 'image_ia_reprocessed' })
        .eq('id', msg.id);

      r.status = 'sent';
      r.gp = transporteur.reference;
      r.route = `${parsed.ville_depart} → ${parsed.ville_arrivee}`;
      results.push(r);
    } catch (e) {
      r.status = 'error';
      r.error = e instanceof Error ? e.message : String(e);
      results.push(r);
    }
  }

  return json({
    ok: true,
    scanned: candidates?.length ?? 0,
    pending: pending.length,
    results,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

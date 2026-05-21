// gp-bot — parses commands from a GP and acts on the Yobbanté backend.
// Called by webhook-whatsapp when a message hits the 122 number.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BotInput {
  inbound_id?: string;
  from_phone: string;
  from_name?: string | null;
  transporteur_id?: string | null;
  message?: string | null;
}

function normalize(text: string): string {
  return (text ?? '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const HELP_TEXT = `📦 Commandes Yobbanté disponibles :

DEP [ville] [JJ/MM] [Xkg]
  Ex: DEP Paris 28/05 25kg

COLLECTE [tracking]
  Ex: COLLECTE YOB-K7M9P2

POIDS [tracking] [Xkg]
  Ex: POIDS YOB-K7M9P2 2.3kg

LIVRE [tracking]
  Ex: LIVRE YOB-K7M9P2

MES MISSIONS
MES DEPARTS
AIDE`;

function parseDate(dateStr: string): string | null {
  // accepts JJ/MM or JJ/MM/AAAA
  const m = dateStr.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return iso;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let input: BotInput;
  try {
    input = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const fromPhone = input.from_phone;
  const rawMsg = (input.message ?? '').trim();
  const msg = normalize(rawMsg);

  console.log('GP_BOT msg', JSON.stringify({ from: fromPhone.slice(-4), msg: msg.slice(0, 60) }));

  // Resolve GP
  let transporteur: any = null;
  if (input.transporteur_id) {
    const { data } = await supa.from('transporteurs').select('*').eq('id', input.transporteur_id).maybeSingle();
    transporteur = data;
  }
  if (!transporteur) {
    const tail = fromPhone.slice(-9);
    const { data } = await supa
      .from('transporteurs')
      .select('*')
      .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
      .limit(1)
      .maybeSingle();
    transporteur = data;
  }

  // Helper: send reply via send-whatsapp (free text on 122)
  async function reply(text: string, intent?: string) {
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          recipient_phone: fromPhone,
          recipient_type: 'gp',
          message: text,
          transporteur_id: transporteur?.id,
          trigger_type: intent ?? 'gp_bot_reply',
        }),
      });
    } catch (e) {
      console.error('WA_ERROR gp reply', e);
    }
    if (input.inbound_id) {
      try {
        await supa
          .from('whatsapp_inbound_messages')
          .update({ bot_intent: intent ?? null, bot_response: text, replied_at: new Date().toISOString() })
          .eq('id', input.inbound_id);
      } catch (e) {
        console.error('WA_ERROR inbound update', e);
      }
    }
  }

  if (!transporteur) {
    await reply(
      `Bonjour ! Je suis le bot Yobbanté.
Vous êtes transporteur partenaire ?
Contactez-nous au +221 78 607 80 80 pour activer votre accès.`,
      'unknown_gp',
    );
    return new Response('ok', { headers: corsHeaders });
  }

  const prenom = transporteur.prenom || transporteur.nom?.split(' ')?.[0] || 'partenaire';

  // ---------------- Intents ----------------

  if (/^(start|bonjour|hello|salam|salut)\b/i.test(rawMsg) || msg === '') {
    await reply(`Bonjour ${prenom} !\nTapez AIDE pour voir toutes les commandes.`, 'start');
    return new Response('ok', { headers: corsHeaders });
  }

  if (/^aide|^help/i.test(rawMsg)) {
    await reply(HELP_TEXT, 'help');
    return new Response('ok', { headers: corsHeaders });
  }

  // MES DEPARTS
  if (/^mes\s+departs?$/i.test(msg)) {
    const { data } = await supa
      .from('manual_departures')
      .select('short_ref, destination, departure_date, total_capacity_kg, available_capacity_kg')
      .eq('transporteur_ref', transporteur.reference)
      .gte('departure_date', new Date().toISOString().slice(0, 10))
      .order('departure_date', { ascending: true })
      .limit(20);
    if (!data || data.length === 0) {
      await reply(`Aucun départ programmé.\nTapez DEP [ville] [date] [Xkg] pour en créer un.`, 'mes_departs');
    } else {
      const lines = data
        .map((d) => {
          const dt = d.departure_date ? new Date(d.departure_date) : null;
          const dStr = dt ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}` : '?';
          const used = (d.total_capacity_kg ?? 0) - (d.available_capacity_kg ?? 0);
          return `Réf ${d.short_ref} - ${d.destination ?? '?'} - ${dStr} - ${used}/${d.total_capacity_kg}kg`;
        })
        .join('\n');
      await reply(`📋 Vos prochains départs :\n${lines}`, 'mes_departs');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // MES MISSIONS
  if (/^mes\s+missions?$/i.test(msg)) {
    const { data } = await supa
      .from('dossiers')
      .select('tracking_id, buyer_name, contact_phone, estimated_weight, actual_weight_kg, status')
      .eq('assigned_transporteur_ref', transporteur.reference)
      .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (!data || data.length === 0) {
      await reply(`Aucune mission active.`, 'mes_missions');
    } else {
      const lines = data
        .map((d) => {
          const w = d.actual_weight_kg ?? d.estimated_weight ?? '?';
          return `${d.tracking_id ?? '—'} - ${d.buyer_name ?? '?'} - ${w}kg - ${d.status}`;
        })
        .join('\n');
      await reply(`📦 Vos missions actives :\n${lines}`, 'mes_missions');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // DEP — create departure
  const depMatch = rawMsg.match(/^dep\s+(.+?)\s+(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?)\s+(\d+(?:[.,]\d+)?)\s*kg?$/i);
  if (depMatch) {
    const dest = depMatch[1].trim();
    const isoDate = parseDate(depMatch[2]);
    const capacity = Math.round(parseFloat(depMatch[3].replace(',', '.')));
    if (!isoDate || !capacity) {
      await reply(`Format invalide. Exemple :\nDEP Paris 28/05 25kg`, 'dep_error');
      return new Response('ok', { headers: corsHeaders });
    }
    const { data: dep, error } = await supa
      .from('manual_departures')
      .insert({
        transporteur_ref: transporteur.reference,
        destination: dest,
        departure_date: isoDate,
        total_capacity_kg: capacity,
        available_capacity_kg: capacity,
        status: 'active',
      })
      .select('short_ref')
      .maybeSingle();
    if (error) {
      console.error('WA_ERROR dep insert', error.message);
      await reply(`Désolé, impossible d’enregistrer ce départ : ${error.message}`, 'dep_error');
    } else {
      const dt = new Date(isoDate);
      const dStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
      await reply(
        `✅ Départ enregistré !
Réf #${dep?.short_ref} - ${dest} - ${dStr} - ${capacity}kg
Visible sur yobbante.com sous 1h.
Tapez AIDE pour toutes les commandes.`,
        'dep_ok',
      );
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // COLLECTE
  const collectMatch = rawMsg.match(/^(?:ok\s+)?collect[eé]\s+(\S+)/i);
  if (collectMatch) {
    const tracking = collectMatch[1].trim().toUpperCase();
    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, status, tracking_id, contact_phone, buyer_name')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();
    if (!dossier) {
      await reply(`Tracking ${tracking} non trouvé. Vérifiez le numéro et réessayez.`, 'collect_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await reply(`Ce dossier ne vous est pas assigné.`, 'collect_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }
    const { error } = await supa
      .from('dossiers')
      .update({ status: 'COLLECTED', collected_at: new Date().toISOString() })
      .eq('id', dossier.id);
    if (error) {
      await reply(`Erreur : ${error.message}`, 'collect_error');
    } else {
      await reply(
        `✅ Collecte enregistrée pour ${dossier.tracking_id}.
Pesez le colis et envoyez :
POIDS ${dossier.tracking_id} X.Xkg`,
        'collect_ok',
      );
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // POIDS
  const poidsMatch = rawMsg.match(/^poids\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s*kg?$/i);
  if (poidsMatch) {
    const tracking = poidsMatch[1].trim().toUpperCase();
    const weight = parseFloat(poidsMatch[2].replace(',', '.'));
    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, tracking_id, destination_country, estimated_cost')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();
    if (!dossier) {
      await reply(`Tracking ${tracking} non trouvé.`, 'poids_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await reply(`Ce dossier ne vous est pas assigné.`, 'poids_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }
    // Estimate final amount via existing pricing function (best effort)
    let amountXof: number | null = null;
    try {
      const { data: quote } = await supa.rpc('calculate_quote', {
        p_origin_country: 'FR',
        p_destination_country: dossier.destination_country || 'SN',
        p_weight_kg: weight,
        p_transport_type: 'air',
        p_priority: 'normal',
      });
      const row = Array.isArray(quote) ? quote[0] : quote;
      const eur = row?.price_eur;
      if (typeof eur === 'number') amountXof = Math.round(eur * 655.957);
    } catch (e) {
      console.error('WA_ERROR pricing', e);
    }
    const updates: Record<string, any> = {
      status: 'WEIGHED',
      actual_weight_kg: weight,
      weighed_at: new Date().toISOString(),
      payment_status: 'pending',
    };
    if (amountXof) updates.final_amount_xof = amountXof;
    const { error } = await supa.from('dossiers').update(updates).eq('id', dossier.id);
    if (error) {
      await reply(`Erreur : ${error.message}`, 'poids_error');
    } else {
      await reply(
        `✅ Poids ${weight}kg enregistré pour ${dossier.tracking_id}.
${amountXof ? `Montant final : ${amountXof.toLocaleString('fr-FR')} XOF.` : `Montant final en cours de calcul.`}
Client notifié pour paiement.`,
        'poids_ok',
      );
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // LIVRE
  const livreMatch = rawMsg.match(/^livr[eé]\s+(\S+)/i);
  if (livreMatch) {
    const tracking = livreMatch[1].trim().toUpperCase();
    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, tracking_id')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();
    if (!dossier) {
      await reply(`Tracking ${tracking} non trouvé.`, 'livre_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await reply(`Ce dossier ne vous est pas assigné.`, 'livre_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }
    const { error } = await supa
      .from('dossiers')
      .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
      .eq('id', dossier.id);
    if (error) {
      await reply(`Erreur : ${error.message}`, 'livre_error');
    } else {
      await reply(`✅ Livraison confirmée pour ${dossier.tracking_id}. Merci !`, 'livre_ok');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // Fallback
  await reply(`Je n’ai pas compris. Tapez AIDE pour voir les commandes.`, 'unknown');
  return new Response('ok', { headers: corsHeaders });
});

// gp-departure-reminders — Rappels WhatsApp automatiques pour les GP
//
// Modes (via ?mode=...) :
//   weekly        — lundi 8h Dakar : ping GP actifs sans départ dans 14 jours
//   forty_eight   — toutes les heures : rappel J-2 avant chaque départ
//   coverage      — lundi 8h Dakar : alerte admin pour destinations sans départ sur 7 j
//
// Tous les textes sont sans accents (compat WhatsApp templates).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

const ADMIN_PHONE = '+221784604003';
const SITE = 'https://yobbante.com';

async function sendWa(supa: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify(payload),
    });
    await res.text();
    return res.ok;
  } catch (e) {
    console.error('send-wa error', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: service-role bearer required (internal call only) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  if (!__SR || __auth !== `Bearer ${__SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') ?? 'weekly';
  const stats: Record<string, number> = { sent: 0, skipped: 0, failed: 0 };

  try {
    if (mode === 'weekly') {
      // 1. Tous les GP actifs
      const { data: gps } = await supa
        .from('transporteurs')
        .select('id, reference, prenom, nom, telephone_1, whatsapp')
        .eq('actif', true);

      const horizon = new Date(); horizon.setDate(horizon.getDate() + 14);
      const today = new Date().toISOString().slice(0, 10);
      const horizonStr = horizon.toISOString().slice(0, 10);

      for (const gp of gps ?? []) {
        // Départ existant dans 14j ?
        const { count } = await supa
          .from('manual_departures')
          .select('id', { count: 'exact', head: true })
          .eq('transporteur_ref', (gp as any).reference)
          .gte('departure_date', today)
          .lte('departure_date', horizonStr)
          .in('status', ['active', 'full']);
        if ((count ?? 0) > 0) { stats.skipped++; continue; }

        const phone = (gp as any).whatsapp || (gp as any).telephone_1;
        if (!phone) { stats.skipped++; continue; }

        const prenom = (gp as any).prenom || 'GP';
        const reference = (gp as any).reference;
        const message = `Salam ${prenom},

Avez-vous un depart prevu dans les 2 prochaines semaines ?

Declarez-le ici :
${SITE}/gp/depart/${reference}

Ou envoyez :
DEP [ville] [date] [kg]

Merci !`;

        const ok = await sendWa(supa, {
          recipient_type: 'gp',
          recipient_phone: phone,
          template_name: 'free_text',
          template_params: { text: message },
          trigger_type: 'gp_weekly_reminder',
          transporteur_id: (gp as any).id,
        });
        if (ok) stats.sent++; else stats.failed++;
      }
    }

    else if (mode === 'forty_eight' || mode === '48h') {
      // Départs dans 47-49h, non rappelés
      const now = new Date();
      const from = new Date(now.getTime() + 47 * 3600 * 1000).toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 49 * 3600 * 1000).toISOString().slice(0, 10);

      const { data: deps } = await supa
        .from('manual_departures')
        .select('id, destination_city, departure_date, total_capacity_kg, transporteur_ref, carrier_contact')
        .gte('departure_date', from)
        .lte('departure_date', to)
        .is('reminder_48h_sent_at', null)
        .eq('status', 'active');

      for (const d of deps ?? []) {
        const dep = d as any;
        // Récup GP
        const { data: gp } = await supa
          .from('transporteurs')
          .select('prenom, whatsapp, telephone_1')
          .eq('reference', dep.transporteur_ref)
          .maybeSingle();
        const phone = (gp as any)?.whatsapp || (gp as any)?.telephone_1 || dep.carrier_contact;
        if (!phone) { stats.skipped++; continue; }

        // Compter colis assignés
        const { data: dossiers } = await supa
          .from('dossiers')
          .select('actual_weight_kg, estimated_weight')
          .eq('assigned_departure_id', dep.id);
        const nbColis = (dossiers ?? []).length;
        const poidsTotal = (dossiers ?? []).reduce(
          (s, r: any) => s + Number(r.actual_weight_kg ?? r.estimated_weight ?? 0),
          0,
        );

        const prenom = (gp as any)?.prenom || 'GP';
        const message = `Salam ${prenom},

Votre depart ${dep.destination_city} est dans 48h !

Colis assignes : ${nbColis}
Poids total : ${poidsTotal.toFixed(0)}kg

Bon voyage !`;

        const ok = await sendWa(supa, {
          recipient_type: 'gp',
          recipient_phone: phone,
          template_name: 'free_text',
          template_params: { text: message },
          trigger_type: 'gp_48h_reminder',
        });
        if (ok) {
          await supa
            .from('manual_departures')
            .update({ reminder_48h_sent_at: new Date().toISOString() })
            .eq('id', dep.id);
          stats.sent++;
        } else stats.failed++;
      }
    }

    else if (mode === 'coverage') {
      // Destinations actives sans départ sur 7 j
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(); horizon.setDate(horizon.getDate() + 7);
      const horizonStr = horizon.toISOString().slice(0, 10);

      const { data: gps } = await supa
        .from('transporteurs')
        .select('destinations')
        .eq('actif', true);
      const destSet = new Set<string>();
      for (const g of gps ?? []) {
        for (const d of ((g as any).destinations ?? []) as string[]) {
          if (d) destSet.add(d.trim());
        }
      }

      const missing: string[] = [];
      for (const dest of destSet) {
        const { count } = await supa
          .from('manual_departures')
          .select('id', { count: 'exact', head: true })
          .ilike('destination_city', dest)
          .gte('departure_date', today)
          .lte('departure_date', horizonStr)
          .in('status', ['active', 'full']);
        if ((count ?? 0) === 0) missing.push(dest);
      }

      for (const dest of missing) {
        const msg = `ALERTE DEPARTS :
Aucun depart ${dest} dans les 7 prochains jours.`;
        const ok = await sendWa(supa, {
          recipient_type: 'admin',
          recipient_phone: ADMIN_PHONE,
          template_name: 'free_text',
          template_params: { text: msg },
          trigger_type: 'coverage_alert',
        });
        if (ok) stats.sent++; else stats.failed++;
      }
    }

    else {
      return new Response(JSON.stringify({ ok: false, error: 'unknown_mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, mode, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('gp-departure-reminders fatal', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

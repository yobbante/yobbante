// cron-admin-reminders — rappels opérationnels (midi, 17h, lundi 7h).
// Mode passé en query param: ?mode=noon|evening|weekly
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

async function sendAdmin(message: string) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        recipient_type: 'admin',
        recipient_phone: ADMIN_PHONE,
        message,
        trigger_type: 'admin_notification',
      }),
    });
  } catch (e) {
    console.error('send admin failed', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') || 'noon';

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    if (mode === 'noon') {
      // Dossiers CONFIRMED sans GP depuis > 4h
      const cutoff = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
      const { data } = await supa
        .from('dossiers')
        .select('tracking_id, reference')
        .eq('status', 'CONFIRMED')
        .is('assigned_transporteur_ref', null)
        .lt('created_at', cutoff)
        .limit(50);

      if (data && data.length > 0) {
        const list = data.map((d) => d.tracking_id || d.reference).join(', ');
        await sendAdmin(
          `Rappel : ${data.length} dossiers confirmes sans GP assigne.\nDossiers : ${list}`,
        );
      }
    } else if (mode === 'evening') {
      // Départs demain, dossiers assignés non collectés
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      const ymd = tomorrow.toISOString().slice(0, 10);
      const { data } = await supa
        .from('dossiers')
        .select('tracking_id, reference, assigned_transporteur_ref, status, pickup_date')
        .eq('pickup_date', ymd)
        .not('assigned_transporteur_ref', 'is', null)
        .in('status', ['CONFIRMED', 'ASSIGNED', 'READY'])
        .limit(50);

      if (data && data.length > 0) {
        const list = data
          .map((d) => `${d.tracking_id || d.reference} (GP${d.assigned_transporteur_ref})`)
          .join(', ');
        await sendAdmin(
          `Attention : depart demain !\n${data.length} colis pas encore collectes :\n${list}`,
        );
      }
    } else if (mode === 'weekly') {
      const weekEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const [departs, pending, incompleteGp, payments] = await Promise.all([
        supa.from('dossiers').select('id', { count: 'exact', head: true })
          .gte('pickup_date', today).lte('pickup_date', weekEnd),
        supa.from('dossiers').select('id', { count: 'exact', head: true })
          .in('status', ['CONFIRMED', 'PENDING']),
        supa.from('transporteurs').select('id', { count: 'exact', head: true })
          .eq('profile_complete', false).eq('actif', true),
        supa.from('dossiers').select('estimated_cost')
          .eq('payment_status', 'pending'),
      ]);

      const amount = (payments.data || []).reduce(
        (s, d: any) => s + (Number(d.estimated_cost) || 0), 0,
      );

      await sendAdmin(
        `Bonne semaine ! Planning :\n` +
        `Departs cette semaine : ${departs.count ?? 0}\n` +
        `Dossiers en attente : ${pending.count ?? 0}\n` +
        `GP a onboarder : ${incompleteGp.count ?? 0}\n` +
        `Paiements en attente : ${Math.round(amount)} XOF`,
      );
    } else if (mode === 'alerts') {
      // ----- ALERTES INTELLIGENTES -----
      const now = Date.now();
      const h48 = new Date(now - 48 * 3600 * 1000).toISOString();
      const h24 = new Date(now - 24 * 3600 * 1000).toISOString();
      const d7 = new Date(now - 7 * 86400 * 1000).toISOString();

      // 1. Dossiers ASSIGNED depuis > 48h sans update
      const { data: stuck } = await supa.from('dossiers')
        .select('tracking_id, reference, assigned_transporteur_ref, updated_at')
        .eq('status', 'ASSIGNED').lt('updated_at', h48).limit(10);
      for (const d of (stuck ?? []) as any[]) {
        const tid = d.tracking_id || d.reference;
        let gpName = d.assigned_transporteur_ref || '—';
        if (d.assigned_transporteur_ref) {
          const { data: gp } = await supa.from('transporteurs')
            .select('prenom, nom').eq('reference', d.assigned_transporteur_ref).maybeSingle();
          if (gp) gpName = `${(gp as any).prenom ?? ''} ${(gp as any).nom ?? ''}`.trim();
        }
        await sendAdmin(
          `ALERTE : ${tid} bloque en ASSIGNED depuis 48h.\nGP : ${gpName}\n\nActions :\nMSG ${tid} votre message\nREASSIGNE ${tid} GP0001`,
        );
      }

      // 2. WEIGHED non paye depuis > 24h
      const { data: latePay } = await supa.from('dossiers')
        .select('tracking_id, reference, sender_name, buyer_name, final_amount_xof, weighed_at')
        .eq('status', 'WEIGHED').eq('payment_status', 'pending')
        .lt('weighed_at', h24).limit(10);
      for (const d of (latePay ?? []) as any[]) {
        const tid = d.tracking_id || d.reference;
        const prenom = String(d.sender_name || d.buyer_name || 'Client').split(/\s+/)[0];
        const amt = Math.round(Number(d.final_amount_xof) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
        await sendAdmin(
          `RELANCE PAIEMENT\n${tid} . ${prenom}\nMontant : ${amt} FCFA\nNon paye depuis 24h\n\nAction : RELANCE ${tid}`,
        );
      }

      // 3. 0 nouvelle commande depuis 48h
      const { count: newOrders } = await supa.from('dossiers')
        .select('id', { count: 'exact', head: true }).gte('created_at', h48);
      if ((newOrders ?? 0) === 0) {
        await sendAdmin(
          `ALERTE COMMERCIAL :\n0 commande depuis 48h.\nAction marketing recommandee.`,
        );
      }

      // 4. GP sans depart declare depuis 7j
      const { data: activeGps } = await supa.from('transporteurs')
        .select('reference, prenom, nom, telephone_1').eq('actif', true).limit(50);
      for (const gp of (activeGps ?? []) as any[]) {
        const { data: lastDep } = await supa.from('manual_departures')
          .select('id, created_at').eq('transporteur_ref', gp.reference)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!lastDep || (lastDep as any).created_at < d7) {
          const name = `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() || gp.reference;
          await sendAdmin(
            `ALERTE GP :\n${name} (${gp.reference}) n a pas declare de depart depuis 7 jours.\n\nAction : MSG ${gp.telephone_1 ?? gp.reference} message`,
          );
        }
      }
    }


    return new Response(JSON.stringify({ ok: true, mode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('cron-admin-reminders error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

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
      // ----- ALERTES CONSOLIDEES (1 seul message par jour, midi)
      const now = Date.now();
      const h48 = new Date(now - 48 * 3600 * 1000).toISOString();
      const h24 = new Date(now - 24 * 3600 * 1000).toISOString();
      const d7 = new Date(now - 7 * 86400 * 1000).toISOString();

      // 1. GP SANS TARIF (+48h depuis creation, actif)
      const { data: gpNoRate } = await supa.from('transporteurs')
        .select('reference, prenom, nom, telephone_1, whatsapp, rates_per_city, created_at')
        .eq('actif', true).lt('created_at', h48).limit(50);
      const gpSansTarif = (gpNoRate ?? []).filter((g: any) => {
        const r = g.rates_per_city;
        return !r || (typeof r === 'object' && Object.keys(r).length === 0);
      });

      // 2. GP SANS DEPART (7j)
      const { data: activeGps } = await supa.from('transporteurs')
        .select('reference, prenom, nom, telephone_1, whatsapp').eq('actif', true).limit(100);
      const gpSansDepart: any[] = [];
      for (const gp of (activeGps ?? []) as any[]) {
        const { data: lastDep } = await supa.from('manual_departures')
          .select('id, created_at').eq('transporteur_ref', gp.reference)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!lastDep || (lastDep as any).created_at < d7) gpSansDepart.push(gp);
      }

      // 3. DOSSIERS BLOQUES (ASSIGNED > 48h, ARRIVED_HUB > 5j)
      const { data: stuck } = await supa.from('dossiers')
        .select('tracking_id, reference, status, updated_at')
        .eq('status', 'ASSIGNED').lt('updated_at', h48).limit(20);
      const d5 = new Date(now - 5 * 86400 * 1000).toISOString();
      const { data: hubStuck } = await supa.from('dossiers')
        .select('tracking_id, reference, status, updated_at')
        .eq('status', 'ARRIVED_HUB').lt('updated_at', d5).limit(20);
      const bloques = [...(stuck ?? []), ...(hubStuck ?? [])];

      // 4. PAIEMENTS EN ATTENTE +24h
      const { data: latePay } = await supa.from('dossiers')
        .select('tracking_id, reference, sender_name, buyer_name, final_amount_xof, weighed_at')
        .eq('status', 'WEIGHED').eq('payment_status', 'pending')
        .lt('weighed_at', h24).limit(20);

      // 5. 0 commande depuis 48h — uniquement apres lancement (>= 2026-06-15)
      const LAUNCH_DATE = new Date('2026-06-15T00:00:00Z').getTime();
      let zeroCmd = false;
      if (Date.now() >= LAUNCH_DATE) {
        const { count: newOrders } = await supa.from('dossiers')
          .select('id', { count: 'exact', head: true }).gte('created_at', h48);
        zeroCmd = (newOrders ?? 0) === 0;
      }

      const totalAlerts =
        gpSansTarif.length + gpSansDepart.length + bloques.length + (latePay?.length ?? 0) + (zeroCmd ? 1 : 0);

      // Pas de spam : aucun message si rien a signaler
      if (totalAlerts === 0) {
        return new Response(JSON.stringify({ ok: true, mode, alerts: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dateLabel = new Date().toLocaleDateString('fr-FR');
      const hoursOf = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
      const fmtAmt = (n: any) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');

      const lines: string[] = [`ALERTES YOBBANTE . ${dateLabel}`, ''];

      lines.push(`GP SANS TARIF (+48h) : ${gpSansTarif.length}`);
      for (const g of gpSansTarif.slice(0, 10)) {
        const name = `${g.prenom ?? ''} ${g.nom ?? ''}`.trim() || g.reference;
        const tel = g.telephone_1 || g.whatsapp || '—';
        lines.push(`- ${name} . ${tel} . ${g.reference} . GP ${g.reference}`);
      }
      lines.push('');

      lines.push(`GP SANS DEPART (7j) : ${gpSansDepart.length}`);
      for (const g of gpSansDepart.slice(0, 10)) {
        const name = `${g.prenom ?? ''} ${g.nom ?? ''}`.trim() || g.reference;
        const tel = g.telephone_1 || g.whatsapp || '—';
        lines.push(`- ${name} . ${tel} . ${g.reference}`);
      }
      lines.push('');

      lines.push(`DOSSIERS BLOQUES : ${bloques.length}`);
      for (const d of bloques.slice(0, 10) as any[]) {
        const tid = d.tracking_id || d.reference;
        lines.push(`- ${tid} . ${d.status} . ${hoursOf(d.updated_at)}h`);
      }
      lines.push('');

      lines.push(`PAIEMENTS EN ATTENTE +24h : ${latePay?.length ?? 0}`);
      for (const d of (latePay ?? []).slice(0, 10) as any[]) {
        const tid = d.tracking_id || d.reference;
        const cli = String(d.sender_name || d.buyer_name || 'Client').split(/\s+/)[0];
        lines.push(`- ${tid} . ${fmtAmt(d.final_amount_xof)} FCFA . ${cli}`);
      }
      lines.push('');

      lines.push(`0 COMMANDE DEPUIS 48h : ${zeroCmd ? 'OUI' : 'NON'}`);
      lines.push('');
      lines.push('Actions rapides :');
      lines.push('GP [ref] . MSG [tracking] [msg]');
      lines.push('RELANCE [tracking] . ASSIGNE [tracking]');

      await sendAdmin(lines.join('\n'));
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

// cron-weekly-gp-reminder — Lundi 9h UTC
// Pour chaque GP actif qui a deja ecrit au bot (channel=gp) et qui n'a creé
// aucun depart dans les 5 derniers jours, envoie un rappel WhatsApp depuis 122.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildMessage(prenom: string) {
  return `Salam ${prenom},

Rappel hebdomadaire Yobbante.

As-tu des departs prevus cette semaine ou la semaine prochaine ?

Envoie-moi :
DEP [ville] [date] [poids]kg

Exemple : DEP Paris 28/05 25kg

Merci et bonne semaine !`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];

  try {
    // 1. GP actifs ayant deja ecrit au bot (channel=gp)
    const { data: inboundRows, error: inErr } = await supa
      .from('whatsapp_inbound_messages')
      .select('transporteur_id')
      .eq('channel', 'gp')
      .not('transporteur_id', 'is', null)
      .limit(10000);
    if (inErr) throw inErr;

    const gpIds = Array.from(new Set((inboundRows ?? [])
      .map((r: any) => r.transporteur_id).filter(Boolean)));

    if (gpIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 0, failed: 0, note: 'no gp on bot' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: gps, error: gpErr } = await supa
      .from('transporteurs')
      .select('id, reference, prenom, nom, telephone_1, actif, bot_paused_until')
      .in('id', gpIds)
      .eq('actif', true)
      .or(`bot_paused_until.is.null,bot_paused_until.lt.${new Date().toISOString()}`);
    if (gpErr) throw gpErr;

    for (const gp of (gps ?? []) as any[]) {
      try {
        // Verifier qu'il n'a PAS de depart cree dans les 5 derniers jours
        const { count, error: depErr } = await supa
          .from('manual_departures')
          .select('id', { count: 'exact', head: true })
          .eq('transporteur_ref', gp.reference)
          .gte('created_at', fiveDaysAgo);
        if (depErr) { failed++; errors.push(`${gp.reference}: ${depErr.message}`); continue; }

        if ((count ?? 0) > 0) { skipped++; continue; }

        const prenom = (gp.prenom?.trim() || gp.nom?.split(' ')[0] || 'cher partenaire');
        const message = buildMessage(prenom);

        const { error: sendErr } = await supa.functions.invoke('send-whatsapp', {
          body: {
            recipient_phone: gp.telephone_1,
            recipient_type: 'gp',
            message,
            transporteur_id: gp.id,
            trigger_type: 'weekly_dep_reminder',
          },
        });
        if (sendErr) { failed++; errors.push(`${gp.reference}: ${sendErr.message ?? sendErr}`); }
        else sent++;

        // 2s entre chaque envoi
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        failed++;
        errors.push(`${gp.reference ?? gp.id}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    console.error('weekly reminder fatal', e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed, errors: errors.slice(0, 20) }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

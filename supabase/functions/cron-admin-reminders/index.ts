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

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STALE_LIMIT = 3;
const INACTIVITY_HOURS = 48;

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cutoff = new Date(Date.now() - INACTIVITY_HOURS * 3600_000).toISOString();

  const { data: dossiers, error } = await supabase
    .from('dossiers')
    .select('id, reference, buyer_name, contact_phone, reminder_count, updated_at, last_client_contact, reminder_sent_at')
    .eq('status', 'AWAITING_CLIENT')
    .lt('updated_at', cutoff)
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let reminded = 0; let staled = 0;
  const now = new Date().toISOString();

  for (const d of dossiers ?? []) {
    const lastTouch = d.reminder_sent_at || d.last_client_contact || d.updated_at;
    if (lastTouch && new Date(lastTouch) > new Date(cutoff)) continue;

    const newCount = (d.reminder_count ?? 0) + 1;

    if (newCount > STALE_LIMIT) {
      await supabase
        .from('dossiers')
        .update({ status: 'STALE' as any, reminder_count: newCount, reminder_sent_at: now })
        .eq('id', d.id);
      staled++;
      continue;
    }

    if (d.contact_phone) {
      try {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            recipient_phone: d.contact_phone,
            message:
              `Bonjour ${d.buyer_name || ''} 👋\n` +
              `Petit rappel concernant votre dossier Yobbanté ${d.reference}.\n` +
              `Pouvez-vous confirmer pour qu'on lance la suite ? Répondez OUI pour confirmer.\n` +
              `Merci 🙏`,
          },
        });
      } catch (_) { /* swallow — log via update anyway */ }
    }

    await supabase
      .from('dossiers')
      .update({ reminder_count: newCount, reminder_sent_at: now })
      .eq('id', d.id);
    reminded++;
  }

  // ---------- Payment reminders ----------
  const now48 = new Date(Date.now() - 48 * 3600_000).toISOString();
  const now96 = new Date(Date.now() - 96 * 3600_000).toISOString();
  let payReminded48 = 0;
  let payAlerted96 = 0;

  // 48h reminder
  const { data: pay48 } = await supabase
    .from('dossiers')
    .select('id, tracking_id, reference, buyer_name, contact_phone, final_amount_xof, weighed_at, payment_reminders_count')
    .eq('status', 'WEIGHED')
    .eq('payment_status', 'pending')
    .eq('payment_reminders_count', 0)
    .lt('weighed_at', now48)
    .limit(100);

  for (const d of pay48 ?? []) {
    const prenom = (d.buyer_name || '').split(' ')[0] || 'Client';
    const tracking = d.tracking_id || d.reference;
    const amount = d.final_amount_xof ? `${Number(d.final_amount_xof).toLocaleString('fr-FR')} XOF` : '—';
    const payLink = `https://yobbante.com/pay/${tracking}`;
    if (d.contact_phone) {
      try {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            recipient_type: 'client',
            recipient_phone: d.contact_phone,
            template_name: 'payment_reminder_48h',
            template_params: [prenom, tracking, amount, payLink],
            dossier_id: d.id,
            trigger_type: 'payment_reminder_48h',
          },
        });
      } catch (_) {}
    }
    await supabase.from('dossiers').update({
      payment_reminders_count: 1,
      last_payment_reminder_at: now,
    }).eq('id', d.id);
    payReminded48++;
  }

  // 96h admin alert
  const { data: pay96 } = await supabase
    .from('dossiers')
    .select('id, tracking_id, reference, payment_reminders_count, weighed_at')
    .eq('status', 'WEIGHED')
    .eq('payment_status', 'pending')
    .eq('payment_reminders_count', 1)
    .lt('weighed_at', now96)
    .limit(100);

  for (const d of pay96 ?? []) {
    const tracking = d.tracking_id || d.reference;
    try {
      await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_type: 'admin',
          recipient_phone: '+221784604003',
          message: `Paiement non recu pour ${tracking} depuis 96h. Colis bloque.`,
          dossier_id: d.id,
          trigger_type: 'payment_admin_alert_96h',
        },
      });
    } catch (_) {}
    await supabase.from('dossiers').update({
      payment_reminders_count: 2,
      last_payment_reminder_at: now,
    }).eq('id', d.id);
    payAlerted96++;
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: dossiers?.length ?? 0, reminded, staled, payReminded48, payAlerted96 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STALE_LIMIT = 3;
const INACTIVITY_HOURS = 48;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

  return new Response(
    JSON.stringify({ ok: true, scanned: dossiers?.length ?? 0, reminded, staled }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

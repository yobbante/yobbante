// gp-broadcast-new-number — annonce le nouveau numero GP 926 a tous les
// transporteurs actifs. Envoi via send-whatsapp (recipient_type: 'gp'), donc
// depuis le compte 926 (WHATSAPP_GP_BOT_PHONE_ID).
//
// Usage : POST { dry_run?: boolean, limit?: number }
//   - dry_run=true (defaut) -> ne fait que lister la cible
//   - dry_run=false          -> envoie reellement
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NEW_NUMBER_DISPLAY = '+221789269756';

function buildMessage(prenom: string): string {
  return [
    `Salam ${prenom},`,
    ``,
    `Yobbante evolue !`,
    `Nouveau numero dedie a vos operations :`,
    NEW_NUMBER_DISPLAY,
    `Nom : Konnekt`,
    ``,
    `Enregistrez ce numero.`,
    `C est sur ce numero que vous recevrez vos missions`,
    `et pouvez gerer vos departs.`,
    ``,
    `Merci !`,
    `Amath - Yobbante`,
  ].join('\n');
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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let body: { dry_run?: boolean; limit?: number } = {};
  try { body = await req.json(); } catch { /* ok */ }
  const dryRun = body.dry_run !== false; // securite par defaut
  const limit = Math.max(1, Math.min(2000, body.limit ?? 1000));

  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const { data: gps, error } = await supa
    .from('transporteurs')
    .select('id, reference, prenom, nom, telephone_1, is_active')
    .eq('is_active', true)
    .not('telephone_1', 'is', null)
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ id: string; phone: string; status: string }> = [];
  for (const gp of gps ?? []) {
    const phone = String(gp.telephone_1 ?? '').replace(/\D/g, '');
    if (phone.length < 8) {
      results.push({ id: gp.id, phone, status: 'skip_invalid_phone' });
      continue;
    }
    const prenom = (gp.prenom?.trim() || gp.nom?.split(' ')[0] || 'partenaire');
    const msg = buildMessage(prenom);
    if (dryRun) {
      results.push({ id: gp.id, phone, status: 'dry_run' });
      continue;
    }
    try {
      const r = await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          recipient_phone: phone,
          recipient_type: 'gp',
          message: msg,
          transporteur_id: gp.id,
          trigger_type: 'gp_new_number_announce',
        }),
      });
      const json = await r.json().catch(() => ({}));
      results.push({ id: gp.id, phone, status: json?.status ?? (r.ok ? 'sent' : 'failed') });
    } catch (e) {
      results.push({ id: gp.id, phone, status: `error:${e instanceof Error ? e.message : 'unknown'}` });
    }
    // petite pause pour respecter Meta rate limits
    await new Promise((res) => setTimeout(res, 150));
  }

  return new Response(JSON.stringify({
    ok: true,
    dry_run: dryRun,
    total: results.length,
    sent: results.filter((r) => r.status === 'sent').length,
    results,
  }, null, 2), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

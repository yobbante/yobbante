// relais-d-notify — Alerte équipe (push VAPID + WhatsApp admin) à la création
// d'une commande "Relais D — Commander en ligne" ou d'une demande "Sourcing D".
// Appelé côté client (verify_jwt = false) : ne fait que relayer vers admin-notify
// avec la clé service-role, aucune donnée sensible retournée.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let body: { kind?: 'shop' | 'sourcing'; reference?: string; dossier_id?: string; summary?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const kind = body.kind === 'sourcing' ? 'sourcing' : 'shop';
  const ref = (body.reference || '').toString().slice(0, 40) || 'sans référence';
  const summary = (body.summary || '').toString().slice(0, 300);

  const title = kind === 'sourcing'
    ? `Nouvelle demande Sourcing D — ${ref}`
    : `Nouvelle commande Relais D à chiffrer — ${ref}`;

  const message = [
    title,
    summary,
    kind === 'sourcing'
      ? 'Action : rechercher le produit en Chine, constater le prix réel + poids estimé majoré, envoyer la proposition.'
      : 'Action : ouvrir chaque lien, constater le prix réel + poids estimé majoré, envoyer le devis tout compris.',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/admin-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        notification_type: kind === 'sourcing' ? 'relais_d_sourcing' : 'relais_d_order',
        message,
        dedup_key: `relais_d_${kind}_${ref}`,
        dossier_id: body.dossier_id ?? null,
        bypass_suspend: true,
        push_title: title,
        push_body: summary || 'Nouveau dossier Relais D à traiter.',
        push_url: '/admin?tab=requests',
      }),
    });
    return json({ ok: res.ok });
  } catch (e) {
    console.error('relais-d-notify failed', e);
    return json({ ok: false }, 200);
  }
});

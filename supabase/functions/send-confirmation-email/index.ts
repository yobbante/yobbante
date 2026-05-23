// Envoi du récapitulatif d'expédition par e-mail (optionnel).
// Utilise Resend si RESEND_API_KEY est configurée.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number(n)));
}

function html(d: any, trackUrl: string) {
  const prenom = (d.sender_name || '').split(' ')[0] || 'Client';
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f7f8;margin:0;padding:24px;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
    <div style="background:#0a0a0a;color:#F5C518;padding:20px 24px;font-weight:800;font-size:18px;letter-spacing:0.5px">YOBBANTÉ</div>
    <div style="padding:24px">
      <h2 style="margin:0 0 8px;font-size:20px">Bonjour ${prenom},</h2>
      <p style="margin:0 0 16px;color:#444">Votre expédition est enregistrée ✅</p>

      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#666">Référence suivi</td><td style="text-align:right;font-weight:600">${d.tracking_id || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Référence commande</td><td style="text-align:right;font-weight:600">${d.reference || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Trajet</td><td style="text-align:right">${d.origin_country || '?'} → ${d.destination_country || '?'}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Poids</td><td style="text-align:right">${d.estimated_weight ?? '—'} kg</td></tr>
        <tr><td style="padding:6px 0;color:#666">Prix total</td><td style="text-align:right;font-weight:700">${fmt(d.final_amount_xof ?? d.estimated_cost)} FCFA</td></tr>
        ${d.pickup_date ? `<tr><td style="padding:6px 0;color:#666">Collecte</td><td style="text-align:right">${d.pickup_date}</td></tr>` : ''}
      </table>

      <div style="margin:24px 0;text-align:center">
        <a href="${trackUrl}" style="display:inline-block;background:#F5C518;color:#0a0a0a;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Suivre mon colis →</a>
      </div>

      <p style="margin:16px 0 0;color:#666;font-size:13px">Une question ? WhatsApp <a href="https://wa.me/221786078080" style="color:#0a0a0a">+221 78 607 80 80</a></p>
    </div>
    <div style="background:#fafafa;padding:14px 24px;font-size:11px;color:#888;text-align:center">© Yobbanté · Logistique internationale</div>
  </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { dossier_id, email } = await req.json();
    if (!dossier_id || !email) {
      return new Response(JSON.stringify({ error: 'dossier_id and email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return new Response(JSON.stringify({ error: 'invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: d, error } = await sb.from('dossiers').select('*').eq('id', dossier_id).maybeSingle();
    if (error || !d) {
      return new Response(JSON.stringify({ error: 'dossier not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trackUrl = `https://yobbante.com/suivre/${d.tracking_id || d.reference || ''}`;
    const subject = `Votre expédition Yobbanté — ${d.tracking_id || d.reference || ''}`;
    const body = html(d, trackUrl);

    if (!RESEND_KEY) {
      console.log('RESEND_API_KEY missing — skipping send', { to: email, subject });
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no_provider' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Yobbanté <noreply@yobbante.com>',
        to: [email],
        subject,
        html: body,
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: out }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, sent: true, id: (out as any)?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

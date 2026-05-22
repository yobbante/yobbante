// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPER_ADMIN_PHONE = Deno.env.get('SUPER_ADMIN_PHONE')
  || Deno.env.get('ADMIN_WHATSAPP_NUMBER')
  || '+221784604003';
const ADMIN_PHONE = SUPER_ADMIN_PHONE;

function isSuperAdminPhone(from: string): boolean {
  const n = (from || '').replace(/\D/g, '');
  const sa = SUPER_ADMIN_PHONE.replace(/\D/g, '');
  if (!n || !sa) return false;
  return n === sa || n.endsWith(sa) || sa.endsWith(n);
}

function supa() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

async function sendWa(phone: string, body: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        recipient_type: 'admin',
        recipient_phone: phone,
        text_body: body,
        trigger_type: 'super_admin_bot',
      }),
    });
  } catch (e) {
    console.error('SUPER_ADMIN_BOT send-wa failed', e);
  }
}

const MENU = [
  'Bonjour ! Que veux-tu faire ?',
  '',
  '1 - Nouveau dossier',
  '2 - Stats du jour',
  '3 - Sortir',
  '',
  'Reponds avec le numero.',
].join('\n');

const TYPE_PROMPT = [
  'Quel type de demande ?',
  '',
  '1 - Expedition (envoi depuis Dakar)',
  '2 - Reception (colis depuis l etranger)',
  '3 - Sourcing (achat a l etranger)',
].join('\n');

function parseType(input: string): 'expedier' | 'recevoir' | 'sourcing' | null {
  const t = input.trim().toLowerCase();
  if (t === '1' || t.startsWith('exp')) return 'expedier';
  if (t === '2' || t.startsWith('rec')) return 'recevoir';
  if (t === '3' || t.startsWith('sour')) return 'sourcing';
  return null;
}

function nextStepPrompt(type: string, step: string): string {
  if (type === 'sourcing') {
    if (step === 'client_name') return 'Nom du client ?';
    if (step === 'client_phone') return 'Telephone du client ?';
    if (step === 'product') return 'Quel produit ? (description courte ou URL)';
    if (step === 'sourcing_country') return 'Pays d achat ? (ex: CN, FR, US)';
    if (step === 'budget') return 'Budget en EUR ? (ou tape - pour ignorer)';
  } else if (type === 'recevoir') {
    if (step === 'client_name') return 'Nom du destinataire a Dakar ?';
    if (step === 'client_phone') return 'Telephone du destinataire ?';
    if (step === 'origin_country') return 'Pays d origine ? (ex: CN, FR, US)';
    if (step === 'product') return 'Description du colis ?';
    if (step === 'weight') return 'Poids estime en kg ? (ou tape - pour ignorer)';
  } else {
    // expedier
    if (step === 'client_name') return 'Nom de l expediteur ?';
    if (step === 'client_phone') return 'Telephone de l expediteur ?';
    if (step === 'destination') return 'Pays de destination ? (ex: FR, CN, US)';
    if (step === 'product') return 'Description du colis ?';
    if (step === 'weight') return 'Poids estime en kg ?';
  }
  return '';
}

function stepsFor(type: string): string[] {
  if (type === 'sourcing') return ['client_name', 'client_phone', 'product', 'sourcing_country', 'budget'];
  if (type === 'recevoir') return ['client_name', 'client_phone', 'origin_country', 'product', 'weight'];
  return ['client_name', 'client_phone', 'destination', 'product', 'weight'];
}

async function getSession(phone: string) {
  const sb = supa();
  const { data } = await sb.from('super_admin_sessions').select('*').eq('from_phone', phone).maybeSingle();
  return data;
}

async function saveSession(phone: string, intent: string | null, step: string | null, dataObj: any) {
  const sb = supa();
  const { data: existing } = await sb.from('super_admin_sessions').select('id').eq('from_phone', phone).maybeSingle();
  const payload: any = {
    from_phone: phone,
    pending_intent: intent,
    pending_step: step,
    pending_data: dataObj,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    await sb.from('super_admin_sessions').update(payload).eq('id', (existing as any).id);
  } else {
    await sb.from('super_admin_sessions').insert(payload);
  }
}

async function clearSession(phone: string) {
  await supa().from('super_admin_sessions').delete().eq('from_phone', phone);
}

async function findAdminUserId(): Promise<string | null> {
  const sb = supa();
  const { data } = await sb
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();
  return (data as any)?.user_id || null;
}

async function createDossierFromSession(phone: string, dataObj: any): Promise<string | null> {
  const sb = supa();
  const type = dataObj.type as string;
  const adminId = await findAdminUserId();
  if (!adminId) return null;

  const insertRow: any = {
    user_id: adminId,
    intake_by: adminId,
    intake_method: 'manual_intake',
    source: 'whatsapp',
    app_source: type,
    needs_sourcing: type === 'sourcing',
    contact_phone: dataObj.client_phone || null,
    buyer_name: dataObj.client_name || null,
    buyer_contact: dataObj.client_phone || null,
    origin_country: type === 'recevoir' ? (dataObj.origin_country || 'FR').slice(0, 2).toUpperCase() : 'SN',
    destination_country: type === 'expedier' ? (dataObj.destination || 'FR').slice(0, 2).toUpperCase() : 'SN',
    product_description: dataObj.product || `Demande ${type} via super-admin bot`,
    estimated_weight: dataObj.weight ? Number(dataObj.weight) : null,
    budget_eur: dataObj.budget ? Number(dataObj.budget) : null,
    notes: `Source: bot super-admin (${phone})\nClient: ${dataObj.client_name || '—'}`,
    status: 'SUBMITTED' as any,
  };

  const { data, error } = await sb.from('dossiers').insert(insertRow).select('id, reference').single();
  if (error) {
    console.error('SUPER_ADMIN_BOT insert dossier failed', error);
    return null;
  }
  return (data as any).reference;
}

async function handleMessage(phone: string, message: string): Promise<string> {
  const text = (message || '').trim();
  const lower = text.toLowerCase();

  if (['menu', 'aide', 'help', 'bonjour', 'salut', 'start'].includes(lower)) {
    await clearSession(phone);
    return MENU;
  }
  if (['stop', 'annuler', 'cancel', 'sortir'].includes(lower) || text === '3') {
    await clearSession(phone);
    return 'OK, session terminee. Tape MENU pour revenir.';
  }

  const session = await getSession(phone);

  // No active flow → interpret as menu command
  if (!session?.pending_intent) {
    if (text === '1') {
      await saveSession(phone, 'new_dossier', 'type', {});
      return TYPE_PROMPT;
    }
    if (text === '2') {
      const sb = supa();
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { count: nb } = await sb.from('dossiers').select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString());
      return `Stats aujourd hui :\n- Nouveaux dossiers : ${nb ?? 0}\n\nTape MENU pour revenir.`;
    }
    return MENU;
  }

  // Active flow : new_dossier
  if (session.pending_intent === 'new_dossier') {
    const dataObj = (session.pending_data || {}) as any;
    const step = session.pending_step as string;

    if (step === 'type') {
      const t = parseType(text);
      if (!t) return 'Choix invalide. ' + TYPE_PROMPT;
      dataObj.type = t;
      const steps = stepsFor(t);
      const nextStep = steps[0];
      await saveSession(phone, 'new_dossier', nextStep, dataObj);
      return nextStepPrompt(t, nextStep);
    }

    // Save current step value, move to next
    if (text && text !== '-') {
      dataObj[step] = text;
    }
    const type = dataObj.type as string;
    const steps = stepsFor(type);
    const idx = steps.indexOf(step);
    if (idx === -1 || idx === steps.length - 1) {
      // Done — create dossier
      const ref = await createDossierFromSession(phone, dataObj);
      await clearSession(phone);
      if (!ref) return 'Echec creation dossier. Reessaye plus tard.';
      return `Dossier ${ref} cree (${type}).\nTape MENU pour une autre action.`;
    }
    const nextStep = steps[idx + 1];
    await saveSession(phone, 'new_dossier', nextStep, dataObj);
    return nextStepPrompt(type, nextStep);
  }

  return MENU;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const fromPhone = body.from_phone || '';

    // HARD SECURITY GUARD — only the super admin number can use this bot.
    // Anyone else: silently ignore (no reply, no session, no log).
    if (!isSuperAdminPhone(fromPhone)) {
      console.warn('SUPER_ADMIN_BOT rejected non-admin', fromPhone);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const message = body.message || '';
    console.log('SUPER_ADMIN_BOT IN', fromPhone, message);
    const reply = await handleMessage(fromPhone, message);
    if (reply) await sendWa(fromPhone, reply);
    return new Response(JSON.stringify({ ok: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('SUPER_ADMIN_BOT error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

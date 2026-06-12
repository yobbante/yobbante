import { createClient } from 'npm:@supabase/supabase-js@2'
import { normalizePhone, normalizePhoneDigits } from '../_shared/phone.ts'

const allowedOrigins = [
  'https://usekonnekt.com',
  'https://www.usekonnekt.com',
  'https://def7c5d9-bcc1-4ef1-82ad-fc1e70593446.lovableproject.com',
]

function normalizeRef(ref: string): string {
  const s = String(ref).toUpperCase()
  return s.startsWith('GP') ? s.slice(2) : s
}

/** Extract last 9 digits for a permissive DB search */
function last9Digits(input: string): string {
  const digits = input.replace(/\D/g, '')
  return digits.slice(-9)
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || ''
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'content-type, x-konnekt-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Vérification clé partagée
  const key = req.headers.get('x-konnekt-key')
  if (key !== Deno.env.get('KONNEKT_SHARED_KEY')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const ref_gp = body?.ref_gp
  const phone = body?.phone

  if (!ref_gp && !phone) {
    return new Response(JSON.stringify({ found: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  // ── Recherche par ref ──
  if (ref_gp) {
    const normalized = normalizeRef(ref_gp)

    const { data } = await supabase
      .from('transporteurs')
      .select('prenom, nom, telephone_1, telephone_2, reference')
      .eq('reference', normalized)
      .maybeSingle()

    if (data) {
      return new Response(JSON.stringify({
        found: true,
        ref: `GP${data.reference}`,
        prenom: data.prenom,
        nom: data.nom,
        telephone_1: data.telephone_1,
        telephone_2: data.telephone_2,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Si on a aussi un phone, on continue vers la recherche par phone
    if (!phone) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Recherche par téléphone ──
  if (phone) {
    const normalizedPhone = normalizePhone(phone)
    const digitsPhone = normalizePhoneDigits(phone)
    const tail9 = last9Digits(normalizedPhone)

    if (!tail9) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rows } = await supabase
      .from('transporteurs')
      .select('prenom, nom, telephone_1, telephone_2, reference')
      .or(`telephone_1.ilike.%${tail9}%,telephone_2.ilike.%${tail9}%`)
      .limit(20)

    const match = (rows ?? []).find((row) => {
      const t1 = normalizePhoneDigits(row.telephone_1)
      const t2 = normalizePhoneDigits(row.telephone_2)
      return t1 === digitsPhone || t2 === digitsPhone ||
             t1 === tail9 || t2 === tail9 ||
             t1 === normalizedPhone || t2 === normalizedPhone
    })

    if (match) {
      return new Response(JSON.stringify({
        found: true,
        ref: `GP${match.reference}`,
        prenom: match.prenom,
        nom: match.nom,
        telephone_1: match.telephone_1,
        telephone_2: match.telephone_2,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ found: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

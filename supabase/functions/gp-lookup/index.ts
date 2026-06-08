import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = [
  'https://usekonnekt.com',
  'https://www.usekonnekt.com',
  'https://def7c5d9-bcc1-4ef1-82ad-fc1e70593446.lovableproject.com',
]

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
  if (!ref_gp) {
    return new Response(JSON.stringify({ data: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  // Normalize: DB stores references without the "GP" prefix (e.g. "9391")
  const normalized = String(ref_gp).toUpperCase().startsWith('GP')
    ? String(ref_gp).slice(2)
    : String(ref_gp)

  const { data } = await supabase
    .from('transporteurs')
    .select('prenom, nom, telephone_1, telephone_2, reference')
    .eq('reference', normalized)
    .maybeSingle()

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
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

  const { data } = await supabase
    .from('transporteurs')
    .select('prenom, nom, telephone_1, telephone_2, reference')
    .eq('reference', ref_gp)
    .maybeSingle()

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

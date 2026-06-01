// parse-departure-message — Parse un message GP type "DEP Paris 15/06 25kg"
// et renvoie { destination, date, kg }. Fallback regex si Lovable AI indispo.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function parseDateFr(s: string): string | null {
  // dd/mm or dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd
  const m1 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  if (m1) {
    const d = +m1[1], mo = +m1[2];
    let y = m1[3] ? +m1[3] : new Date().getFullYear();
    if (y < 100) y += 2000;
    const dt = new Date(y, mo - 1, d);
    if (dt < new Date(new Date().setHours(0, 0, 0, 0))) {
      dt.setFullYear(y + 1); // si date passée, on bascule l'année
    }
    return dt.toISOString().slice(0, 10);
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;
  return null;
}

function regexParse(text: string) {
  // "DEP Paris 15/06 25kg" / "depart paris 15/06 25"
  const cleaned = text.trim().replace(/\s+/g, ' ');
  // Remove leading DEP/DEPART
  const stripped = cleaned.replace(/^(dep|depart|départ)\s+/i, '');
  // Find token that looks like a date
  const dateMatch = stripped.match(/\b(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/);
  // Find weight (e.g. "25kg" or "25 kg" or just "25")
  const kgMatch = stripped.match(/\b(\d{1,3})\s*(?:kg|kgs|kilos?)\b/i)
    || stripped.match(/\b(\d{1,3})\b(?=\s*$)/);
  if (!dateMatch || !kgMatch) return { ok: false, reason: 'parse_failed' };
  const before = stripped.slice(0, dateMatch.index).trim();
  const destination = before.replace(/[,;]+$/, '').trim();
  const date = parseDateFr(dateMatch[1]);
  if (!destination || !date) return { ok: false, reason: 'parse_failed' };
  return {
    ok: true,
    destination,
    date,
    kg: parseInt(kgMatch[1], 10),
    source: 'regex',
  };
}

async function aiParse(text: string) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Tu reçois un message court d'un GP (transporteur) annonçant un départ. Renvoie UNIQUEMENT un JSON {"destination":"<ville>","date":"YYYY-MM-DD","kg":<int>}. Si la date n'a pas d'année, prends l'année courante ou l'année suivante si la date est déjà passée. Année courante : ${new Date().getFullYear()}. Message : "${text}"`,
        }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.destination || !parsed?.date || !parsed?.kg) return null;
    return { ok: true, ...parsed, source: 'ai' };
  } catch (e) {
    console.error('aiParse error', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.length > 400) {
      return new Response(JSON.stringify({ ok: false, reason: 'invalid_text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Try regex first (free, fast), fall back to AI
    const regex = regexParse(text);
    const result = regex.ok ? regex : (await aiParse(text)) ?? regex;
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

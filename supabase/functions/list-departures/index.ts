// Public endpoint — proxies Konnekt's external-list-departures.
// Falls back to a mock list if Konnekt returns nothing or is misconfigured,
// so the home page ticker is never empty.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Departure = {
  id: string;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  transport: 'AIR' | 'SEA' | 'ROAD';
};

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function getMockDepartures(): Departure[] {
  const today = new Date();
  const lanes: Array<Omit<Departure, 'id' | 'departure_date'> & { offset: number }> = [
    { origin_country: 'CN', origin_city: 'Shenzhen',  destination_country: 'SN', destination_city: 'Dakar',     transport: 'SEA',  offset: 3 },
    { origin_country: 'FR', origin_city: 'Paris',     destination_country: 'SN', destination_city: 'Dakar',     transport: 'AIR',  offset: 2 },
    { origin_country: 'AE', origin_city: 'Dubai',     destination_country: 'SN', destination_city: 'Dakar',     transport: 'AIR',  offset: 5 },
    { origin_country: 'CN', origin_city: 'Guangzhou', destination_country: 'CI', destination_city: 'Abidjan',   transport: 'SEA',  offset: 6 },
    { origin_country: 'US', origin_city: 'Miami',     destination_country: 'SN', destination_city: 'Dakar',     transport: 'SEA',  offset: 9 },
    { origin_country: 'DE', origin_city: 'Hambourg',  destination_country: 'ML', destination_city: 'Bamako',    transport: 'ROAD', offset: 7 },
    { origin_country: 'FR', origin_city: 'Marseille', destination_country: 'CI', destination_city: 'Abidjan',   transport: 'SEA',  offset: 4 },
    { origin_country: 'CN', origin_city: 'Shanghai',  destination_country: 'CM', destination_city: 'Douala',    transport: 'SEA',  offset: 11 },
    { origin_country: 'AE', origin_city: 'Dubai',     destination_country: 'CI', destination_city: 'Abidjan',   transport: 'AIR',  offset: 1 },
    { origin_country: 'CA', origin_city: 'Montréal',  destination_country: 'SN', destination_city: 'Dakar',     transport: 'AIR',  offset: 8 },
  ];
  return lanes.map((l, i) => ({
    id: `mock-${i}`,
    origin_country: l.origin_country,
    origin_city: l.origin_city,
    destination_country: l.destination_country,
    destination_city: l.destination_city,
    transport: l.transport,
    departure_date: addDays(today, l.offset).toISOString().slice(0, 10),
  }));
}

function normalizeTransport(v: unknown): 'AIR' | 'SEA' | 'ROAD' {
  const s = String(v || '').toUpperCase();
  if (s.startsWith('A') || s.includes('AIR') || s.includes('AVION') || s.includes('AÉR')) return 'AIR';
  if (s.startsWith('R') || s.includes('ROAD') || s.includes('ROUT') || s.includes('CAMION')) return 'ROAD';
  return 'SEA';
}

function normalizeKonnekt(raw: unknown): Departure[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: Record<string, unknown>, i: number): Departure | null => {
      const dep = String(
        r.departure_date || r.departureDate || r.date || r.eta || r.starts_at || ''
      ).slice(0, 10);
      if (!dep) return null;
      return {
        id: String(r.id || r.reference || `k-${i}`),
        origin_country: String(r.origin_country || r.from_country || 'CN').toUpperCase().slice(0, 2),
        origin_city: String(r.origin_city || r.from_city || r.origin || ''),
        destination_country: String(r.destination_country || r.to_country || 'SN').toUpperCase().slice(0, 2),
        destination_city: String(r.destination_city || r.to_city || r.destination || ''),
        transport: normalizeTransport(r.transport || r.transport_type || r.mode),
        departure_date: dep,
      };
    })
    .filter((x): x is Departure => x !== null);
}

async function fetchKonnektDepartures(): Promise<{ departures: Departure[]; authed: boolean } | null> {
  const base = (Deno.env.get('KONNEKT_BASE_URL') || '').trim();
  const key = (Deno.env.get('KONNEKT_API_KEY') || '').trim();
  if (!base || !/^https:\/\//i.test(base)) return null;

  // Normalize: strip trailing slash + ensure /functions/v1 suffix
  let url = base.replace(/\/+$/, '');
  if (url.endsWith('/external-list-departures')) {
    url = url.slice(0, -'/external-list-departures'.length);
  }
  if (!/\/functions\/v\d+$/.test(url)) url = `${url}/functions/v1`;
  const endpoint = `${url}/external-list-departures`;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
      headers['X-Yobbante-Api-Key'] = key;
    }
    const res = await fetch(endpoint, { method: 'GET', headers });
    if (!res.ok) {
      console.error('Konnekt list-departures failed', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const list = json?.departures ?? json?.data ?? json;
    const authed = json?.partner_authenticated === true;
    return { departures: normalizeKonnekt(list), authed };
  } catch (e) {
    console.error('Konnekt fetch error', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const konnekt = await fetchKonnektDepartures();
    let departures: Departure[] = konnekt?.departures ?? [];
    let source: 'konnekt' | 'mock' = 'konnekt';

    if (!departures.length) {
      departures = getMockDepartures();
      source = 'mock';
    }

    departures.sort((a, b) => a.departure_date.localeCompare(b.departure_date));

    return new Response(JSON.stringify({
      source,
      partner_authenticated: konnekt?.authed ?? false,
      count: departures.length,
      generated_at: new Date().toISOString(),
      departures,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // Cache 10 min on CDN, 5 min in browser
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=120',
      },
    });
  } catch (e) {
    console.error('list-departures error', e);
    return new Response(JSON.stringify({ error: 'Failed to load departures' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

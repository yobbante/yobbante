// Public endpoint — returns upcoming departures.
// Currently mocked. When Konnekt exposes a real endpoint, swap the
// `getMockDepartures()` call for a fetch to KONNEKT_BASE_URL + the real path.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Departure = {
  id: string;
  origin_country: string; // ISO-2
  origin_city: string;
  destination_country: string;
  destination_city: string;
  departure_date: string; // ISO date
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const departures = getMockDepartures().sort(
      (a, b) => a.departure_date.localeCompare(b.departure_date),
    );
    return new Response(JSON.stringify({ departures, source: 'mock' }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
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

// Public endpoint — proxies Konnekt's external-list-departures.
// Strategy:
//  1. Try Konnekt
//  2. If success → dedup, persist as last-known-good (LKG), log, return source=konnekt
//  3. If failure → return last-known-good from cache if present (source=cache)
//  4. If no LKG ever → return mock (source=mock)
// Pass ?refresh=1 to force a fresh fetch and bypass CDN cache.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  let s = '';
  if (typeof v === 'string') s = v;
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    s = String(o.code || o.name || o.value || o.label || '');
  }
  s = s.toUpperCase();
  if (s.startsWith('A') || s.includes('AIR') || s.includes('AVION') || s.includes('AÉR')) return 'AIR';
  if (s.startsWith('R') || s.includes('ROAD') || s.includes('ROUT') || s.includes('CAMION')) return 'ROAD';
  return 'SEA';
}

// Konnekt sometimes returns origin/destination as objects { name, code, country, city }.
// Pull a usable string out instead of stringifying the object.
function pickStr(v: unknown, ...keys: string[]): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of keys) {
      const val = o[k];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    // Last resort: any first string property
    for (const val of Object.values(o)) {
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  return '';
}

function pickCountry(v: unknown, fallback = ''): string {
  const s = pickStr(v, 'code', 'country_code', 'iso', 'iso2', 'country', 'name');
  return (s || fallback).toUpperCase().slice(0, 2);
}

function pickCity(v: unknown): string {
  return pickStr(v, 'city', 'name', 'label', 'value');
}

function normalizeKonnekt(raw: unknown): Departure[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: Record<string, unknown>, i: number): Departure | null => {
      const dep = String(
        r.departure_date || r.departureDate || r.date || r.eta || r.starts_at || ''
      ).slice(0, 10);
      if (!dep) return null;

      // Origin: try flat fields first, then nested object
      const originCountry = pickCountry(
        r.origin_country ?? r.from_country ?? (r.origin as Record<string, unknown> | undefined)?.country ?? r.origin,
        'CN',
      );
      const originCity =
        pickStr(r.origin_city, 'city', 'name') ||
        pickStr(r.from_city, 'city', 'name') ||
        pickCity(r.origin) ||
        pickCity(r.from);

      const destCountry = pickCountry(
        r.destination_country ?? r.to_country ?? (r.destination as Record<string, unknown> | undefined)?.country ?? r.destination,
        'SN',
      );
      const destCity =
        pickStr(r.destination_city, 'city', 'name') ||
        pickStr(r.to_city, 'city', 'name') ||
        pickCity(r.destination) ||
        pickCity(r.to);

      // Drop entries without proper city info — these are not "real" departures.
      if (!originCity || !destCity) return null;

      return {
        id: String(r.id || r.reference || `k-${i}`),
        origin_country: originCountry,
        origin_city: originCity,
        destination_country: destCountry,
        destination_city: destCity,
        transport: normalizeTransport(r.transport || r.transport_type || r.mode),
        departure_date: dep,
      };
    })
    .filter((x): x is Departure => x !== null);
}

// Dedup by (origin_country, destination_country, departure_date, transport)
function dedupDepartures(list: Departure[]): Departure[] {
  const seen = new Set<string>();
  const out: Departure[] = [];
  for (const d of list) {
    const k = `${d.origin_country}|${d.destination_country}|${d.departure_date}|${d.transport}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

async function fetchKonnektDepartures(): Promise<{
  departures: Departure[];
  authed: boolean;
  raw: unknown;
} | { error: string }> {
  const base = (Deno.env.get('KONNEKT_BASE_URL') || '').trim();
  const key = (Deno.env.get('KONNEKT_API_KEY') || '').trim();
  if (!base || !/^https:\/\//i.test(base)) return { error: 'KONNEKT_BASE_URL missing/invalid' };

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
      const txt = await res.text();
      console.error('Konnekt list-departures failed', res.status, txt);
      return { error: `Konnekt HTTP ${res.status}: ${txt.slice(0, 300)}` };
    }
    const json = await res.json();
    const list = json?.departures ?? json?.data ?? json;
    const authed = json?.partner_authenticated === true;
    return { departures: normalizeKonnekt(list), authed, raw: json };
  } catch (e) {
    console.error('Konnekt fetch error', e);
    return { error: (e as Error).message || 'fetch failed' };
  }
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

async function readLKG(): Promise<{ departures: Departure[]; updated_at: string } | null> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from('konnekt_departures_cache')
      .select('departures, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.departures) return null;
    return { departures: data.departures as Departure[], updated_at: data.updated_at };
  } catch (e) {
    console.error('LKG read failed', e);
    return null;
  }
}

async function writeLKG(departures: Departure[]) {
  try {
    const sb = getServiceClient();
    await sb.from('konnekt_departures_cache').insert({
      source: 'konnekt',
      count: departures.length,
      departures,
    });
    // Keep only the 5 most recent rows
    const { data: old } = await sb
      .from('konnekt_departures_cache')
      .select('id')
      .order('updated_at', { ascending: false })
      .range(5, 100);
    if (old?.length) {
      await sb.from('konnekt_departures_cache').delete().in('id', old.map((r) => r.id));
    }
  } catch (e) {
    console.error('LKG write failed', e);
  }
}

async function logSync(input: {
  source: string;
  status: 'ok' | 'error';
  count: number;
  partner_authenticated: boolean;
  raw_payload?: unknown;
  error_message?: string;
}) {
  try {
    const sb = getServiceClient();
    await sb.from('konnekt_sync_log').insert(input);
    // Trim to last 100 rows
    const { data: old } = await sb
      .from('konnekt_sync_log')
      .select('id')
      .order('created_at', { ascending: false })
      .range(100, 1000);
    if (old?.length) {
      await sb.from('konnekt_sync_log').delete().in('id', old.map((r) => r.id));
    }
  } catch (e) {
    console.error('logSync failed', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

async function fetchManualDepartures(): Promise<Departure[]> {
  try {
    const sb = getServiceClient();
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from('manual_departures')
      .select('id, origin_country, origin_city, destination_country, destination_city, transport_mode, departure_date, status, available_capacity_kg')
      .eq('status', 'active')
      .gte('departure_date', todayIso)
      .order('departure_date', { ascending: true });
    if (error) {
      console.error('manual_departures read failed', error);
      return [];
    }
    return (data || []).map((r): Departure => ({
      id: `m-${r.id}`,
      origin_country: String(r.origin_country || '').toUpperCase().slice(0, 2),
      origin_city: String(r.origin_city || ''),
      destination_country: String(r.destination_country || '').toUpperCase().slice(0, 2),
      destination_city: String(r.destination_city || ''),
      transport: normalizeTransport(r.transport_mode),
      departure_date: String(r.departure_date).slice(0, 10),
    })).filter(d => d.origin_city && d.destination_city);
  } catch (e) {
    console.error('fetchManualDepartures error', e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  try {
    const [konnektResult, manualDepartures] = await Promise.all([
      fetchKonnektDepartures(),
      fetchManualDepartures(),
    ]);

    let konnektDepartures: Departure[] = [];
    let source: 'konnekt' | 'cache' | 'mock' = 'mock';
    let partner_authenticated = false;
    let lkg_updated_at: string | null = null;
    let error_message: string | undefined;

    if ('departures' in konnektResult && konnektResult.departures.length > 0) {
      konnektDepartures = konnektResult.departures;
      source = 'konnekt';
      partner_authenticated = konnektResult.authed;
      await writeLKG(konnektDepartures);
      await logSync({
        source: 'konnekt',
        status: 'ok',
        count: konnektDepartures.length,
        partner_authenticated,
        raw_payload: konnektResult.raw,
      });
    } else {
      error_message = 'error' in konnektResult ? konnektResult.error : 'Konnekt returned 0 departures';
      const lkg = await readLKG();
      if (lkg && lkg.departures.length) {
        konnektDepartures = lkg.departures;
        source = 'cache';
        lkg_updated_at = lkg.updated_at;
      }
      await logSync({
        source,
        status: 'error',
        count: konnektDepartures.length,
        partner_authenticated: 'authed' in konnektResult ? konnektResult.authed : false,
        raw_payload: 'raw' in konnektResult ? konnektResult.raw : null,
        error_message,
      });
    }

    // Merge manual + konnekt and dedup. If we have manual departures and no
    // konnekt data, mark source as konnekt (real data) — never mock.
    const merged = dedupDepartures([...manualDepartures, ...konnektDepartures]);
    if (merged.length && source === 'mock') {
      source = manualDepartures.length ? 'konnekt' : 'mock';
    }

    merged.sort((a, b) => a.departure_date.localeCompare(b.departure_date));

    return new Response(JSON.stringify({
      source,
      partner_authenticated,
      count: merged.length,
      generated_at: new Date().toISOString(),
      lkg_updated_at,
      error_message,
      departures: merged,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': forceRefresh
          ? 'no-store'
          : 'public, max-age=30, s-maxage=30, stale-while-revalidate=120',
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

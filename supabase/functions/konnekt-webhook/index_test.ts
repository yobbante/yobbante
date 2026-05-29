// Tests d'intégration pour le webhook Konnekt.
//
// On stub `Deno.env.get` + `createClient` (via un module-level swap) puis on
// importe dynamiquement `index.ts`. Chaque test rejoue un POST sur le handler
// `Deno.serve` capturé.

import {
  assertEquals,
  assertNotEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SECRET = 'test-secret-konnekt';

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ───── Mock Supabase client ─────
interface MockShipment {
  id: string;
  user_id: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELIVERED';
  origin_country: string;
  destination_country: string;
  konnekt_id: string;
}
interface MockState {
  shipments: MockShipment[];
  timeline: unknown[];
  /** Compteur d'appels par table — utilisé pour le scénario retry. */
  insertFailuresRemaining: Record<string, number>;
}
const state: MockState = {
  shipments: [],
  timeline: [],
  insertFailuresRemaining: {},
};

function resetState(seed?: Partial<MockShipment>) {
  state.shipments = seed
    ? [{
        id: 'ship_1',
        user_id: 'user_1',
        status: 'PENDING',
        origin_country: 'SN',
        destination_country: 'FR',
        konnekt_id: 'KNK-1',
        ...seed,
      }]
    : [];
  state.timeline = [];
  state.insertFailuresRemaining = {};
}

// Builder de query chainable minimal compatible avec l'usage du handler.
function makeClient() {
  function from(table: string) {
    let pending: MockShipment[] = table === 'shipments' ? [...state.shipments] : [];
    const api = {
      select() { return api; },
      eq(col: string, val: string) {
        pending = pending.filter((r) => (r as Record<string, unknown>)[col] === val);
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: pending[0] ?? null, error: null });
      },
      update(patch: Partial<MockShipment>) {
        return {
          eq(col: string, val: string) {
            state.shipments = state.shipments.map((s) =>
              (s as Record<string, unknown>)[col] === val ? { ...s, ...patch } : s,
            );
            return Promise.resolve({ error: null });
          },
        };
      },
      insert(row: unknown) {
        const remaining = state.insertFailuresRemaining[table] ?? 0;
        if (remaining > 0) {
          state.insertFailuresRemaining[table] = remaining - 1;
          return Promise.resolve({ error: { message: 'simulated insert failure' } });
        }
        state.timeline.push(row);
        return Promise.resolve({ error: null });
      },
    };
    return api;
  }
  return { from };
}

// Stub des modules avant import
const realEnvGet = Deno.env.get.bind(Deno.env);
Deno.env.get = ((k: string) => {
  if (k === 'KONNEKT_WEBHOOK_SECRET') return SECRET;
  if (k === 'SUPABASE_URL') return 'http://localhost';
  if (k === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-role';
  return realEnvGet(k);
}) as typeof Deno.env.get;

// On intercepte `Deno.serve` pour récupérer le handler sans démarrer de serveur.
let capturedHandler: ((req: Request) => Response | Promise<Response>) | null = null;
const realServe = Deno.serve;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Deno as any).serve = ((handler: any) => {
  capturedHandler = handler;
  return { finished: Promise.resolve(), shutdown: () => {} } as unknown as ReturnType<typeof realServe>;
}) as typeof Deno.serve;

// Stub createClient via un import map dynamique : on remplace le module dans le cache
// d'import en publiant un faux module data: URL puis on patche l'import absolu via
// `globalThis`. Plus simple : on monkey-patch après import en remplaçant la fonction.
// Pour rester portable, on remplace simplement createClient en passant par un
// module shim local.
// → ici on contourne en remplaçant la requête vers esm.sh par un import map runtime :
// on déclare un loader minimal.
// Approche pragmatique : on importe le handler après avoir stubé fetch des esm.sh
// puis on remplace l'exécution réelle en monkey-patchant l'objet retourné.

// Trick le plus simple : on importe le module et on patche `createClient` via
// l'objet global qu'il utilise. Comme le module l'importe directement, on doit
// passer par un wrapper. Plus robuste : on ré-implémente le shim via une URL data.
// Pour ces tests, on s'appuie sur le fait que `createClient` retourne un objet
// avec `.from()` — on remplace donc la fonction exportée par esm.sh à l'aide
// du système de hooks de Deno (`Deno.dlopen` n'existe pas pour JS).
// Solution finale et fiable : on charge le code source du handler et on le ré-évalue
// avec un createClient mocké injecté via Function().

const indexSource = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
const patched = indexSource.replace(
  /import \{ createClient \} from 'https:\/\/esm\.sh\/@supabase\/supabase-js@2\.57\.4';/,
  'const createClient = globalThis.__mockCreateClient;',
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__mockCreateClient = () => makeClient();
const blobUrl = URL.createObjectURL(new Blob([patched], { type: 'application/typescript' }));
await import(blobUrl);

if (!capturedHandler) {
  throw new Error('Deno.serve handler not captured');
}
const handler = capturedHandler;

async function postEvent(body: Record<string, unknown>, opts: { badSig?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const sig = opts.badSig ? 'deadbeef' : await sign(raw);
  return handler(
    new Request('http://x/konnekt-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-konnekt-signature': sig },
      body: raw,
    }),
  );
}

Deno.test('konnekt-webhook — rejette une signature HMAC invalide (401)', async () => {
  resetState({});
  const res = await postEvent({ event: 'shipment.in_transit', konnekt_id: 'KNK-1' }, { badSig: true });
  assertEquals(res.status, 401);
  await res.text();
  assertEquals(state.shipments[0].status, 'PENDING');
});

Deno.test('konnekt-webhook — synchronise le status PENDING → IN_TRANSIT', async () => {
  resetState({});
  const res = await postEvent({ event: 'shipment.in_transit', konnekt_id: 'KNK-1' });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.new_status, 'IN_TRANSIT');
  assertEquals(state.shipments[0].status, 'IN_TRANSIT');
  assertEquals(state.timeline.length, 1);
});

Deno.test('konnekt-webhook — forward-only : ignore les régressions de status', async () => {
  resetState({ status: 'DELIVERED' });
  const res = await postEvent({ event: 'shipment.in_transit', konnekt_id: 'KNK-1' });
  assertEquals(res.status, 200);
  await res.json();
  // Le status reste DELIVERED même après réception d'un IN_TRANSIT tardif.
  assertEquals(state.shipments[0].status, 'DELIVERED');
});

Deno.test('konnekt-webhook — shipment introuvable : 200 + ignored (pas de retry infini)', async () => {
  resetState();
  const res = await postEvent({ event: 'shipment.delivered', konnekt_id: 'KNK-unknown' });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ignored, 'shipment_not_found');
});

Deno.test('konnekt-webhook — fallback non-fatal quand l\'insert timeline échoue', async () => {
  resetState({});
  // Premier insert échoue → handler doit logger et renvoyer 200 quand même
  // avec timeline_logged=false. Le status reste appliqué.
  state.insertFailuresRemaining = { timeline_events: 1 };
  const res = await postEvent({ event: 'shipment.delivered', konnekt_id: 'KNK-1' });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.new_status, 'DELIVERED');
  assertEquals(body.timeline_logged, false);
  assertEquals(state.shipments[0].status, 'DELIVERED');

  // Retry du même évènement (idempotent côté client Konnekt) : insert passe
  // cette fois, status déjà DELIVERED donc pas de nouveau update mais
  // timeline ré-écrite.
  const res2 = await postEvent({ event: 'shipment.delivered', konnekt_id: 'KNK-1' });
  assertEquals(res2.status, 200);
  const body2 = await res2.json();
  assertEquals(body2.timeline_logged, true);
  assertNotEquals(state.timeline.length, 0);
});

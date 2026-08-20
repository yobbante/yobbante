// Web Push (RFC 8291 / aes128gcm) + VAPID (RFC 8292) — implémentation Web Crypto,
// sans dépendance Node. Utilisée par la fonction push-send.

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(b: Uint8Array): string {
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** JWT ES256 signé avec la clé privée VAPID (base64url du scalaire `d`). */
async function vapidJwt(audience: string, subject: string, publicKey: string, privateKey: string) {
  const pub = b64urlToBytes(publicKey); // 65 octets non compressés: 0x04 || X || Y
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKey,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = bytesToB64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const signingInput = enc.encode(`${header}.${body}`);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput));
  return `${header}.${body}.${bytesToB64url(sig)}`;
}

/** Chiffrement aes128gcm du payload pour l'abonnement du navigateur. */
async function encryptPayload(plaintext: string, p256dh: string, authSecret: string): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const authKey = b64urlToBytes(authSecret);

  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prkKey = await hmac(authKey, shared);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, Uint8Array.of(1));
  const ikm = await hmac(prkKey, keyInfo);
  const prk = await hmac(salt, ikm);

  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), Uint8Array.of(1)))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), Uint8Array.of(1)))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const padded = concat(enc.encode(plaintext), Uint8Array.of(2)); // délimiteur de dernier enregistrement
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, Uint8Array.of(asPublic.length), asPublic, cipher);
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** true quand l'abonnement est mort côté navigateur (404/410) → à supprimer. */
  gone: boolean;
  error?: string;
}

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
  vapid: { publicKey: string; privateKey: string; subject: string },
  ttlSeconds = 3600,
): Promise<SendResult> {
  try {
    const url = new URL(sub.endpoint);
    const jwt = await vapidJwt(url.origin, vapid.subject, vapid.publicKey, vapid.privateKey);
    const body = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttlSeconds),
        Urgency: 'high',
      },
      body,
    });

    if (res.ok) return { ok: true, status: res.status, gone: false };
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: text.slice(0, 200),
    };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: String(e).slice(0, 200) };
  }
}

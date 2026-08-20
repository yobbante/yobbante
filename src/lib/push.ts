/**
 * Web Push (VAPID) côté client.
 * Enregistre le service worker dédié aux notifications (`/push-sw.js`, aucun cache)
 * et gère l'abonnement/désabonnement via la fonction edge `push-subscribe`.
 */
import { supabase } from '@/integrations/supabase/client';

/** Clé publique VAPID du projet (publiable). */
export const VAPID_PUBLIC_KEY =
  'BJnpoBdQk7s1ku8edR6etN55aqfYxDBVLXd8vOr_D2j3LxP6OQXYAcRT3yWn1rgNps0zeIjO8NLrXgT5BYPZGnQ';

const SW_URL = '/push-sw.js';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) ||
    (/Mac/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS uniquement
    window.navigator.standalone === true
  );
}

function inIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

function isPreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h.includes('id-preview--') || h.includes('lovableproject.com') || h.includes('lovableproject-dev.com');
}

/** Le navigateur peut-il techniquement recevoir des notifications push ? */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined' &&
    !inIframe() &&
    !isPreviewHost()
  );
}

/** iPhone/iPad hors app installée : Safari refuse les push tant que l'app n'est pas sur l'écran d'accueil. */
export function iosNeedsInstall(): boolean {
  return isIosDevice() && !isStandaloneApp();
}

async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: '/' });
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'ios_install_required' | 'denied' | 'error'; detail?: string };

interface EnableOptions {
  audience: 'admin' | 'chauffeur';
  /** Token de session chauffeur (PWA chauffeur, pas de compte Supabase). */
  chauffeurToken?: string;
}

/** Demande la permission (à appeler sur action volontaire) puis enregistre l'abonnement. */
export async function enablePush(opts: EnableOptions): Promise<EnableResult> {
  if (!pushSupported()) {
    return { ok: false, reason: iosNeedsInstall() ? 'ios_install_required' : 'unsupported' };
  }
  if (iosNeedsInstall()) return { ok: false, reason: 'ios_install_required' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await registerWorker();
    await navigator.serviceWorker.ready;

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const { error } = await supabase.functions.invoke('push-subscribe', {
      body: {
        action: 'subscribe',
        audience: opts.audience,
        chauffeur_token: opts.chauffeurToken,
        subscription: sub.toJSON(),
        user_agent: navigator.userAgent,
      },
    });
    if (error) return { ok: false, reason: 'error', detail: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', detail: (e as Error).message };
  }
}

export async function disablePush(opts: EnableOptions): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  try {
    await supabase.functions.invoke('push-subscribe', {
      body: {
        action: 'unsubscribe',
        audience: opts.audience,
        chauffeur_token: opts.chauffeurToken,
        endpoint: sub.endpoint,
      },
    });
  } catch { /* best effort */ }
  await sub.unsubscribe().catch(() => undefined);
}

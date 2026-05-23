// Détection du domaine Konnekt (plateforme onboarding GP).
// Konnekt vit sur usekonnekt.com et le path /konnekt sur yobbante.com.

const KONNEKT_HOSTS = ['usekonnekt.com', 'www.usekonnekt.com'];

export function isKonnektDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (KONNEKT_HOSTS.includes(host)) return true;
  if (host.includes('konnekt')) return true;
  return false;
}

export function isKonnektContext(): boolean {
  if (isKonnektDomain()) return true;
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/konnekt');
}

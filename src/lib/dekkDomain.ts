/**
 * Helpers de détection du sous-domaine Boutique Dëkk.
 *
 * Production : dekk.yobbante.com → mode boutique
 * Main       : yobbante.com / www.yobbante.com → site logistique
 * Dev / preview : on peut forcer le mode boutique via `?dekk=1`
 * (persisté dans sessionStorage) pour tester avant que le DNS soit en place.
 */

const DEKK_HOSTS = ['dekk.yobbante.com', 'dekk.lovable.app'];

export const DEKK_ORIGIN = 'https://dekk.yobbante.com';

function readForcedFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('dekk');
    if (q === '1') {
      sessionStorage.setItem('dekk:force', '1');
      return true;
    }
    if (q === '0') {
      sessionStorage.removeItem('dekk:force');
      return false;
    }
    return sessionStorage.getItem('dekk:force') === '1';
  } catch {
    return false;
  }
}

export function isDekkSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('dekk.')) return true;
  if (DEKK_HOSTS.includes(host)) return true;
  return readForcedFlag();
}

/** True en production réelle (pour activer les 301 vers le sous-domaine). */
export function isProductionMainHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'yobbante.com' || host === 'www.yobbante.com';
}

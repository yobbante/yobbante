import { supabase } from '@/integrations/supabase/client';

const KEY = 'yobbante:pending_claim_ref';

/** Mémorise le colis consulté en public pour le rattacher après inscription. */
export function setPendingClaim(ref: string) {
  try { localStorage.setItem(KEY, ref.toUpperCase()); } catch { /* storage bloqué */ }
}

export function getPendingClaim(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearPendingClaim() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export interface ClaimResult {
  ref: string;
  ok: boolean;
  reason?: 'already_claimed' | 'not_found' | 'error';
}

/**
 * Rattache le colis mémorisé au compte connecté (appelé au chargement de
 * l'espace client). Sans compte connecté ou sans colis en attente : no-op.
 */
export async function claimPendingTracking(): Promise<ClaimResult | null> {
  const ref = getPendingClaim();
  if (!ref) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  try {
    const { data, error } = await supabase.functions.invoke('claim-tracking', { body: { ref } });
    if (error) {
      const status = (error as any)?.context?.status;
      if (status === 409) { clearPendingClaim(); return { ref, ok: false, reason: 'already_claimed' }; }
      if (status === 404) { clearPendingClaim(); return { ref, ok: false, reason: 'not_found' }; }
      return { ref, ok: false, reason: 'error' };
    }
    clearPendingClaim();
    if ((data as any)?.ok) return { ref, ok: true };
    return { ref, ok: false, reason: 'error' };
  } catch {
    return { ref, ok: false, reason: 'error' };
  }
}

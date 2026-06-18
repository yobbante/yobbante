import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * OAuth callback page.
 *
 * Récupère la session depuis le hash/code retourné par le provider OAuth,
 * puis route vers :
 *   • /confirmation/{tracking_id} si un `pending_order` est présent en
 *     sessionStorage (commande à finaliser après authentification)
 *   • la valeur de sessionStorage.post_auth_redirect si présente
 *   • /app par défaut.
 *
 * Reste tolérant aux deux modes Supabase :
 *   - implicit flow (#access_token=…)
 *   - PKCE flow (?code=…) — exchangeCodeForSession est appelé.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // PKCE flow: ?code=… → on échange contre une session.
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          try { await supabase.auth.exchangeCodeForSession(window.location.href); } catch {}
        }

        // Récupère la session (broker Lovable / implicit / PKCE). Petite
        // boucle de retry car detectSessionInUrl est asynchrone au mount.
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; i < 10 && !session; i++) {
          await new Promise((r) => setTimeout(r, 150));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (cancelled) return;

        if (!session) {
          navigate('/auth', { replace: true });
          return;
        }

        // 1) Commande en attente ?
        const pendingRaw = sessionStorage.getItem('pending_order');
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw) as { tracking_id?: string };
            sessionStorage.removeItem('pending_order');
            if (pending?.tracking_id) {
              navigate(`/confirmation/${pending.tracking_id}`, { replace: true });
              return;
            }
          } catch {
            sessionStorage.removeItem('pending_order');
          }
        }

        // 2) Redirection explicite mémorisée avant le départ vers le provider.
        const stored = sessionStorage.getItem('post_auth_redirect');
        if (stored) {
          sessionStorage.removeItem('post_auth_redirect');
          if (stored.startsWith('/') && !stored.startsWith('//')) {
            navigate(stored, { replace: true });
            return;
          }
        }

        // 3) Défaut.
        navigate('/app', { replace: true });
      } catch {
        navigate('/auth', { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-yellow-400" />
        <p className="text-sm text-white/70">Connexion en cours…</p>
      </div>
    </div>
  );
}

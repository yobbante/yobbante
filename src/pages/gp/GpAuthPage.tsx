import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { writeGpSession, normalizeGpRef } from '@/lib/gpSession';
import logoYobbante from '@/assets/logo-yobbante.png';

const BG = '#0A0F1E';
const GOLD = '#D4AF37';
const SURFACE = '#121828';
const BORDER = 'rgba(212,175,55,0.18)';

export default function GpAuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'invalid' | 'expired' | 'used'>('loading');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('invalid'); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('gp_consume_token' as any, { p_token: token });
      if (cancelled) return;
      if (error || !(data as any)?.ok) {
        const reason = (data as any)?.reason;
        if (reason === 'used') setState('used');
        else if (reason === 'expired') setState('expired');
        else setState('invalid');
        return;
      }
      const r = data as any;
      const ref = normalizeGpRef(r.ref_gp);
      writeGpSession({
        ref,
        phone: r.phone,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });
      navigate(`/gp/${ref}`, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BG, color: 'white' }}>
      <div className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
           style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <img src={logoYobbante} alt="Yobbanté" className="h-8 mx-auto" />
        {state === 'loading' && (
          <>
            <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: GOLD }} />
            <div className="text-sm text-white/70">Connexion en cours…</div>
          </>
        )}
        {state !== 'loading' && (
          <>
            <h1 className="text-xl font-bold">Ce lien a expiré ou a déjà été utilisé.</h1>
            <Link
              to="/gp/connexion"
              className="inline-block w-full rounded-xl py-3 font-semibold"
              style={{ background: GOLD, color: BG }}
            >
              Obtenir un nouveau lien
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

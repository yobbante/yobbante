import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { writeFpSession } from '@/lib/fpSession';
import logoYobbante from '@/assets/logo-yobbante.png';

const BG = '#0A0F1E';
const GOLD = '#D4AF37';
const SURFACE = '#121828';
const BORDER = 'rgba(212,175,55,0.18)';

const MESSAGES: Record<string, string> = {
  invalid: "Ce lien n'est pas valide.",
  expired: 'Ce lien a expiré.',
  used: 'Ce lien a déjà été utilisé.',
};

export default function PartnerAuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'invalid' | 'expired' | 'used'>('loading');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('invalid'); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('fp_consume_token' as any, { p_token: token });
      if (cancelled) return;
      const r = data as any;
      if (error || !r?.ok) {
        setState((r?.reason as any) === 'used' ? 'used' : (r?.reason as any) === 'expired' ? 'expired' : 'invalid');
        return;
      }
      writeFpSession({
        session: r.session,
        reference: r.reference,
        company_name: r.partner?.company_name ?? '',
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });
      navigate(`/partenaire/${r.reference}`, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BG, color: 'white' }}>
      <div className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
           style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <img src={logoYobbante} alt="Yobbanté" className="h-8 mx-auto" />
        {state === 'loading' ? (
          <><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: GOLD }} />
            <p className="text-sm text-white/70">Connexion en cours…</p></>
        ) : (
          <>
            <p className="text-sm text-white/80">{MESSAGES[state]}</p>
            <Link to="/partenaire/connexion" className="inline-block rounded-md px-4 py-2 font-semibold"
                  style={{ background: GOLD, color: BG }}>Demander un nouveau lien</Link>
          </>
        )}
      </div>
    </div>
  );
}

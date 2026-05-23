import { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { gpWhatsappLink } from '@/lib/contact';

const KONNEKT_BASE = 'https://usekonnekt.com';

export default function RejoindreKonnektPage() {
  const [params] = useSearchParams();
  const ref = (params.get('ref') || '').trim();

  useEffect(() => {
    if (ref) {
      try { localStorage.setItem('konnekt_ref', ref); } catch { /* ignore */ }
    }
  }, [ref]);

  const konnektUrl = useMemo(
    () => (ref ? `${KONNEKT_BASE}/#inscription?ref=${encodeURIComponent(ref)}` : `${KONNEKT_BASE}/#inscription`),
    [ref],
  );

  // En interne (preview / yobbante.com), on redirige vers la page locale Konnekt
  // avec le ref pré-rempli au lieu de pointer vers usekonnekt.com.
  if (typeof window !== 'undefined' && !window.location.hostname.includes('konnekt')) {
    return <Navigate to={`/konnekt${ref ? `?ref=${encodeURIComponent(ref)}` : ''}#inscription`} replace />;
  }

  useEffect(() => {
    document.title = 'Rejoindre Konnekt · Yobbanté';
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-5 py-10">


      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[#F5C518] text-[#0A0E1A] font-extrabold text-sm">
            Y
          </span>
          <span className="text-muted-foreground">+</span>
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-border bg-secondary text-foreground font-extrabold text-sm">
            K
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-center">
          Rejoignez le reseau Konnekt
        </h1>

        <p className="text-sm text-muted-foreground mt-3 text-center leading-relaxed">
          Votre profil transporteur est deja enregistre chez Yobbante.
          Finalisez votre inscription sur Konnekt pour recevoir des missions
          directement sur votre telephone.
        </p>

        {ref && (
          <p className="text-[11px] text-center text-muted-foreground mt-3 font-mono">
            Reference : {ref}
          </p>
        )}

        <div className="mt-6 space-y-2.5">
          <a
            href={konnektUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center font-semibold rounded-xl py-3 px-4 transition-colors"
            style={{ background: '#F5C518', color: '#0A0E1A' }}
          >
            Finaliser mon inscription
          </a>
          <a
            href={gpWhatsappLink('Bonjour, je suis transporteur partenaire Yobbante et je souhaite finaliser mon inscription Konnekt.')}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center font-medium rounded-xl py-3 px-4 border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Nous contacter
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          Une question ? Ecrivez-nous sur WhatsApp au +221 78 122 18 91
        </p>
      </section>
    </main>
  );
}

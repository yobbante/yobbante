import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { PublicFooter } from '@/components/PublicFooter';
import { useSeo } from '@/hooks/useSeo';

export const LEGAL_LINKS = [
  { to: '/confidentialite', label: 'Politique de confidentialité' },
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/cgu', label: "Conditions générales d'utilisation" },
  { to: '/cgv', label: 'Conditions générales de vente' },
  { to: '/cookies', label: 'Politique cookies' },
];

interface Props {
  title: string;
  updatedAt: string;
  description?: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, updatedAt, description, children }: Props) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  useSeo({
    title: `${title} · Yobbanté`,
    description: description ?? `${title} de Yobbanté — plateforme logistique internationale.`,
    path,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
          <BrandLogo size={26} />
          <Link
            to="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Accueil
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
          <nav className="text-xs text-muted-foreground mb-6">
            <Link to="/" className="hover:text-foreground">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{title}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dernière mise à jour&nbsp;: <time>{updatedAt}</time>
          </p>

          <div className="legal-content mt-8 space-y-6 text-sm sm:text-[15px] leading-relaxed text-foreground/90">
            {children}
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Autres documents légaux
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {LEGAL_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    → {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              to="/"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Home className="w-4 h-4" /> Retour à l'accueil
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mt-8 first:mt-0">{title}</h2>
      <div className="space-y-3 text-foreground/85">{children}</div>
    </section>
  );
}

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 mt-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="space-y-2 text-foreground/85">{children}</div>
    </div>
  );
}

const env = (import.meta as any).env ?? {};
export const COMPANY_INFO = {
  name: env.VITE_COMPANY_NAME || 'Yobbanté',
  legalForm: env.VITE_COMPANY_LEGAL_FORM || 'SARL Yobbanté',
  address: env.VITE_COMPANY_ADDRESS || 'Dakar, Sénégal',
  ninea: env.VITE_COMPANY_NINEA || 'À renseigner',
  rccm: env.VITE_COMPANY_RCCM || 'À renseigner',
  email: env.VITE_COMPANY_EMAIL || 'contact@yobbante.com',
  phone: env.VITE_COMPANY_PHONE || '+221 78 607 80 80',
  phoneGp: env.VITE_COMPANY_PHONE_GP || '+221 78 122 18 91',
  site: env.VITE_COMPANY_SITE || 'https://yobbante.com',
  host: env.VITE_COMPANY_HOST || 'Lovable / Vercel (à confirmer)',
};

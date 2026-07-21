import { forwardRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { IntentSearchBar, type IntentKey } from '@/components/IntentSearchBar';
import { LiveDeparturesTicker } from '@/components/LiveDeparturesTicker';
import yobbanteLogoAsset from '@/assets/yobbante-logo-mark.png.asset.json';

interface PublicNavProps {
  /** Hide the inline action chips when the page already exposes them prominently. */
  hideActions?: boolean;
  /** Show the unified intent search bar below the nav. Default: true unless hideActions. */
  showIntentBar?: boolean;
  /** Default tab on the intent bar. */
  defaultIntent?: IntentKey;
}


const LINKS: { label: string; to: string; match: (p: string) => boolean; subBadge?: string; external?: boolean }[] = [
  // 3 CTAs égaux — entrée principale du site
  { label: 'Expédier',     to: '/expedier',          match: p => p.startsWith('/expedier') && !p.startsWith('/expedier/recevoir') },
  { label: 'Sourcing',     to: '/sourcing',          match: p => p.startsWith('/sourcing') || p.startsWith('/acheter') },
  { label: 'Réception',    to: '/expedier/recevoir', match: p => p.startsWith('/expedier/recevoir') || p.startsWith('/reception') },
  // Secondaires
  { label: 'Suivre',       to: '/suivre',            match: p => p.startsWith('/suivre') || p.startsWith('/track') },
  { label: 'Tarifs',       to: '/tarifs',            match: p => p.startsWith('/tarifs') },
  { label: 'Boutique Dëkk', to: 'https://dekk.yobbante.com', match: p => p.startsWith('/boutique'), external: true },
];

const SubBadge = ({ children }: { children: React.ReactNode }) => (
  <span
    aria-hidden
    style={{
      display: 'block', fontSize: 8, lineHeight: 1,
      fontFamily: 'var(--font-mono, monospace)',
      letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))',
      marginTop: 2, fontWeight: 400,
    }}
  >
    {children}
  </span>
);

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '').trim();
  if (!src) return '·';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export const PublicNav = forwardRef<HTMLElement, PublicNavProps>(function PublicNav(
  { hideActions = false, showIntentBar, defaultIntent = 'send' },
  ref,
) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const shouldShowIntent = showIntentBar ?? !hideActions;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 w-full" style={{ background: 'hsl(var(--background-primary))' }}>
        <nav
          ref={ref}
          style={{
            height: 52,
            background: 'hsl(var(--background-primary))',
            borderBottom: '0.5px solid hsl(var(--color-border-tertiary))',
          }}
        >
          <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between gap-4">
            {/* Brand — logged-in users go straight to /app */}
            <Link
              to={user ? '/app' : '/'}
              aria-label="Yobbanté — Accueil"
              className="inline-flex items-center"
            >
              <img
                src={yobbanteLogoAsset.url}
                alt="Yobbanté logo"
                style={{ height: 36, width: 'auto', display: 'block', background: 'transparent' }}
              />
            </Link>

            {/* Center links retirés — navigation regroupée dans le menu burger (desktop + mobile) */}
            <div className="flex-1" />


            {/* Right */}
            <div className="flex items-center gap-2">
              {user ? (
                <Link
                  to="/app"
                  aria-label="Mon espace"
                  className="hidden sm:inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 32,
                    height: 32,
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--foreground))',
                    fontSize: 13,
                    fontWeight: 500,
                    border: '0.5px solid hsl(var(--color-border-tertiary))',
                  }}
                >
                  {initials((user as any).user_metadata?.full_name, user.email)}
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth"
                    className="hidden sm:inline-flex items-center text-[13px] transition-colors"
                    style={{ color: 'hsl(var(--muted-foreground))', padding: '6px 8px' }}
                  >
                    Connexion
                  </Link>
                  <Link to="/auth" className="hidden sm:inline-flex btn-cta">
                    Mon espace
                  </Link>
                </>
              )}

              {/* Burger — visible sur mobile ET desktop */}
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <button
                    aria-label="Ouvrir le menu"
                    className="inline-flex items-center justify-center rounded-lg"
                    style={{
                      width: 36,
                      height: 36,
                      border: '0.5px solid hsl(var(--color-border-tertiary))',
                      color: 'hsl(var(--foreground))',
                      background: 'transparent',
                    }}
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="p-0 w-full sm:max-w-sm"
                  style={{
                    background: 'hsl(var(--background-primary))',
                    borderLeft: '0.5px solid hsl(var(--color-border-tertiary))',
                  }}
                >

                  <div className="flex items-center justify-between px-6" style={{ height: 52, borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                    <img src={yobbanteLogoAsset.url} alt="Yobbanté logo" style={{ height: 36, width: 'auto', display: 'block', background: 'transparent' }} />
                    <button
                      aria-label="Fermer le menu"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center justify-center rounded-lg"
                      style={{ width: 36, height: 36 }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-6 py-2">
                    {LINKS.map((l, i) => (
                      <button
                        key={l.to}
                        type="button"
                        onClick={() => { setOpen(false); navigate(l.to); }}
                        className="w-full text-left flex items-center"
                        style={{
                          fontSize: 16,
                          color: 'hsl(var(--foreground))',
                          padding: '14px 0',
                          borderBottom: i < LINKS.length - 1 ? '0.5px solid hsl(var(--color-border-tertiary))' : 'none',
                        }}
                      >
                        <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
                          <span>{l.label}</span>
                          {l.subBadge && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{l.subBadge}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="px-6 py-4 flex items-center gap-2" style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                    {user ? (
                      <Link to="/app" onClick={() => setOpen(false)} className="btn-cta w-full">Mon espace</Link>
                    ) : (
                      <>
                        <Link
                          to="/auth"
                          onClick={() => setOpen(false)}
                          className="flex-1 inline-flex items-center justify-center rounded-lg text-[13px]"
                          style={{
                            height: 40,
                            border: '0.5px solid hsl(var(--color-border-tertiary))',
                            color: 'hsl(var(--foreground))',
                          }}
                        >
                          Connexion
                        </Link>
                        <Link to="/auth" onClick={() => setOpen(false)} className="btn-cta flex-1">
                          Mon espace
                        </Link>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>
        <LiveDeparturesTicker />
      </div>
      <div style={{ height: 84 }} />
    </>
  );
});


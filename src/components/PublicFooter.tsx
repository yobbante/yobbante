import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Package, ShoppingCart, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterSection {
  title: string;
  links: { label: string; to?: string; href?: string; icon?: React.ReactNode }[];
}

const SECTIONS: FooterSection[] = [
  {
    title: 'Commencer',
    links: [
      { label: 'Expédier un colis', to: '/expedier', icon: <Package className="w-3.5 h-3.5" /> },
      { label: 'Acheter un produit', to: '/acheter', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
      { label: 'Mon espace', to: '/auth' },
    ],
  },
  {
    title: 'Entreprises',
    links: [
      { label: 'Solution B2B', to: '/entreprises' },
      { label: 'Demander un devis', to: '/devis-entreprise' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'CGU' },
      { label: 'Confidentialité' },
      { label: 'Mentions légales' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 md:py-14">
        {/* ─────────── DESKTOP / TABLET (md+) ─────────── */}
        <div className="hidden md:grid grid-cols-5 gap-8">
          <div className="col-span-2">
            <p className="text-base font-bold text-foreground tracking-tight">YOBBANTÉ</p>
            <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed">
              Expédiez, recevez ou achetez à l'international. On gère tout, de A à Z.
            </p>
            <div className="mt-5 space-y-2">
              <a href="mailto:contact@yobbante.com" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-3.5 h-3.5" /> contact@yobbante.com
              </a>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> Dakar · Paris · Shenzhen
              </p>
            </div>
          </div>

          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{s.title}</p>
              <div className="space-y-2">
                {s.links.map((l) => (
                  l.to ? (
                    <Link key={l.label} to={l.to} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {l.icon} {l.label}
                    </Link>
                  ) : (
                    <span key={l.label} className="block text-sm text-muted-foreground">{l.label}</span>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ─────────── MOBILE (collapsible accordion menu) ─────────── */}
        <div className="md:hidden">
          <div>
            <p className="text-base font-bold text-foreground tracking-tight">YOBBANTÉ</p>
            <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
              Expédiez, recevez ou achetez à l'international.
            </p>
          </div>

          <div className="mt-6 -mx-1 divide-y divide-border border-y border-border">
            {SECTIONS.map((s) => (
              <FooterAccordion key={s.title} section={s} />
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <a href="mailto:contact@yobbante.com" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-3.5 h-3.5" /> contact@yobbante.com
            </a>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> Dakar · Paris · Shenzhen
            </p>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Yobbanté. Tous droits réservés.</p>
          <p className="text-xs text-muted-foreground">
            powered by{' '}
            <a
              href="https://it-visionary.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:underline"
            >
              it-visionary.fr
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterAccordion({ section }: { section: FooterSection }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3.5 text-left"
      >
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{section.title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-3.5 space-y-2.5">
            {section.links.map((l) =>
              l.to ? (
                <Link
                  key={l.label}
                  to={l.to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l.icon} {l.label}
                </Link>
              ) : (
                <span key={l.label} className="block text-sm text-muted-foreground/80">{l.label}</span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

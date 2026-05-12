import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageCircle, Package, ShoppingCart, ChevronDown } from 'lucide-react';

const SOCIAL_LINKS: { label: string; href: string; path: string }[] = [
  { label: 'Instagram', href: 'https://instagram.com/yobbante', path: 'M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.64.07-4.85.07-3.2 0-3.58 0-4.85-.07-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.2 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.2 8.8 2.2 12 2.2zm0 1.8c-3.14 0-3.51 0-4.74.07-1.07.05-1.65.23-2.04.38-.51.2-.88.43-1.26.82-.39.38-.62.75-.82 1.26-.15.39-.33.97-.38 2.04-.06 1.23-.07 1.6-.07 4.74s0 3.51.07 4.74c.05 1.07.23 1.65.38 2.04.2.51.43.88.82 1.26.38.39.75.62 1.26.82.39.15.97.33 2.04.38 1.23.06 1.6.07 4.74.07s3.51 0 4.74-.07c1.07-.05 1.65-.23 2.04-.38.51-.2.88-.43 1.26-.82.39-.38.62-.75.82-1.26.15-.39.33-.97.38-2.04.06-1.23.07-1.6.07-4.74s0-3.51-.07-4.74c-.05-1.07-.23-1.65-.38-2.04a3.4 3.4 0 0 0-.82-1.26 3.4 3.4 0 0 0-1.26-.82c-.39-.15-.97-.33-2.04-.38C15.51 4 15.14 4 12 4zm0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88zm0 8.14a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm6.28-8.34a1.16 1.16 0 1 1-2.32 0 1.16 1.16 0 0 1 2.32 0z' },
  { label: 'Facebook', href: 'https://facebook.com/yobbante', path: 'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/yobbante', path: 'M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.23 0z' },
  { label: 'TikTok', href: 'https://tiktok.com/@yobbante', path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.42a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.85z' },
];

function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Yobbanté sur ${s.label}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={s.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}
import { whatsappLink, YOBBANTE_WHATSAPP_DISPLAY } from '@/lib/contact';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';

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
            <BrandLogo size={28} asLink={false} />
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
            <BrandLogo size={26} asLink={false} />
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

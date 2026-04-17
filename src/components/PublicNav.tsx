import { forwardRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  to?: string;
  href?: string;
  label: string;
  onClick?: () => void;
}

interface PublicNavProps {
  /** Optional extra items (e.g. a button that opens a dialog) injected after the static links */
  extraItems?: NavItem[];
}

const STATIC_ITEMS: NavItem[] = [
  { to: '/services', label: 'Services' },
  { to: '/simulateur', label: 'Simulateur' },
  { to: '/#warehouses', label: 'Adresses' },
];

export const PublicNav = forwardRef<HTMLElement, PublicNavProps>(function PublicNav({ extraItems = [] }, ref) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const items = [...STATIC_ITEMS, ...extraItems];

  const isActive = (to?: string) => {
    if (!to) return false;
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to.split('#')[0]) && to !== '/#warehouses';
  };

  return (
    <nav ref={ref} className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-7">
          {items.map((item) => {
            const cls = `text-sm transition-colors ${
              isActive(item.to)
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`;
            if (item.onClick) {
              return (
                <button key={item.label} onClick={item.onClick} className={cls}>
                  {item.label}
                </button>
              );
            }
            return (
              <Link key={item.label} to={item.to!} className={cls}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/auth"
            className="hidden sm:inline-block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Connexion
          </Link>
          <Link
            to="/auth"
            className="text-sm font-semibold bg-foreground text-background px-3.5 sm:px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Commencer
          </Link>

          {/* Mobile burger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Ouvrir le menu"
                className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
              >
                <Menu className="w-4 h-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 bg-background">
              <div className="flex items-center justify-between px-5 h-14 border-b border-border">
                <span className="text-base font-bold tracking-tight text-foreground">YOBBANTÉ</span>
                <button
                  aria-label="Fermer le menu"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col px-3 py-4 gap-1">
                {items.map((item) => {
                  const cls = `w-full text-left text-base font-medium px-3 py-3 rounded-lg transition-colors ${
                    isActive(item.to)
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`;
                  if (item.onClick) {
                    return (
                      <button
                        key={item.label}
                        onClick={() => { setOpen(false); item.onClick!(); }}
                        className={cls}
                      >
                        {item.label}
                      </button>
                    );
                  }
                  return (
                    <Link key={item.label} to={item.to!} onClick={() => setOpen(false)} className={cls}>
                      {item.label}
                    </Link>
                  );
                })}
                <div className="border-t border-border mt-3 pt-3">
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="block text-base font-medium px-3 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    Connexion
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

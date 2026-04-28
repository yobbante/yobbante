import { forwardRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Package, Factory, Inbox } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface PublicNavProps {
  /** Hide the inline action chips (Expédier / Acheter) when the page already exposes them prominently. */
  hideActions?: boolean;
}

export const PublicNav = forwardRef<HTMLElement, PublicNavProps>(function PublicNav({ hideActions = false }, ref) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + '/');

  const goExpedier = () => { setOpen(false); navigate('/expedier'); };
  const goAcheter = () => { setOpen(false); navigate('/acheter'); };
  const goRecevoir = () => { setOpen(false); navigate('/expedier/recevoir'); };

  return (
    <nav ref={ref} className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</Link>

        {/* Desktop: only the 2 main entry points */}
        {!hideActions && (
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={goExpedier}
              className={`text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                isActive('/expedier')
                  ? 'text-foreground font-semibold bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Expédier
            </button>
            <button
              onClick={goRecevoir}
              className={`text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                isActive('/expedier/recevoir')
                  ? 'text-foreground font-semibold bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> Recevoir
            </button>
            <button
              onClick={goAcheter}
              className={`text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                isActive('/acheter')
                  ? 'text-foreground font-semibold bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Factory className="w-3.5 h-3.5" /> Sourcing
            </button>
          </div>
        )}

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
            Mon espace
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
                <button
                  onClick={goExpedier}
                  className="w-full text-left flex items-center gap-3 px-3 py-3.5 rounded-lg bg-foreground text-background font-semibold"
                >
                  <Package className="w-4 h-4" /> Expédier un colis
                </button>
                <button
                  onClick={goRecevoir}
                  className="w-full text-left flex items-center gap-3 px-3 py-3.5 rounded-lg bg-zinc-950 text-white font-semibold"
                >
                  <Inbox className="w-4 h-4 text-yellow-400" /> Recevoir une commande
                </button>
                <button
                  onClick={goAcheter}
                  className="w-full text-left flex items-center gap-3 px-3 py-3.5 rounded-lg bg-secondary text-foreground font-semibold"
                >
                  <Factory className="w-4 h-4" /> Acheter un produit
                </button>
                <div className="border-t border-border mt-3 pt-3 space-y-1">
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    Connexion
                  </Link>
                  <Link
                    to="/entreprises"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    Entreprises
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
});

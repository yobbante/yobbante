import { Link } from 'react-router-dom';
import { Mail, MapPin } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <p className="text-base font-bold text-foreground tracking-tight">YOBBANTÉ</p>
            <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed">
              Opérateur logistique international. Sourcing, transport, dédouanement, livraison — un seul partenaire.
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

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Solutions</p>
            <div className="space-y-2">
              <Link to="/services" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Services</Link>
              <Link to="/entreprises" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Entreprises</Link>
              <Link to="/simulateur" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Simulateur</Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Plateforme</p>
            <div className="space-y-2">
              <Link to="/auth" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Connexion</Link>
              <Link to="/auth" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Créer un compte</Link>
              <a href="https://konnekt.app" target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Konnekt (petits colis)</a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Légal</p>
            <div className="space-y-2">
              <span className="block text-sm text-muted-foreground">CGU</span>
              <span className="block text-sm text-muted-foreground">Confidentialité</span>
              <span className="block text-sm text-muted-foreground">Mentions légales</span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Yobbanté. Tous droits réservés.</p>
          <p className="text-xs text-muted-foreground">Made with care in West Africa 🌍</p>
        </div>
      </div>
    </footer>
  );
}

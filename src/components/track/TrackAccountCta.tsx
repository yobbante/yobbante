import { useNavigate } from 'react-router-dom';
import { Bell, ShieldCheck, Package, ArrowRight } from 'lucide-react';
import { setPendingClaim } from '@/lib/claimTracking';

const BENEFITS = [
  { Icon: Package, label: 'Retrouvez ce colis et tous vos envois dans un seul espace' },
  { Icon: Bell, label: 'Notifications à chaque étape (WhatsApp + push)' },
  { Icon: ShieldCheck, label: 'Historique, factures et adresses enregistrées' },
];

/**
 * Incitation à la création de compte sur la page publique de suivi.
 * Le colis consulté est mémorisé : dès l'inscription, il est rattaché
 * automatiquement au nouveau compte client.
 */
export function TrackAccountCta({ trackingRef }: { trackingRef: string }) {
  const navigate = useNavigate();

  const go = () => {
    setPendingClaim(trackingRef);
    navigate(`/auth?mode=signup&redirect=${encodeURIComponent(`/suivre/${trackingRef}`)}`);
  };

  return (
    <aside className="mt-8 rounded-2xl border border-border bg-card p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        Votre espace client
      </p>
      <h3 className="mt-1 text-lg font-semibold">
        Créez votre compte et gardez {trackingRef} à portée de main
      </h3>
      <ul className="mt-3 space-y-2">
        {BENEFITS.map(({ Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
            <Icon className="w-4 h-4 mt-0.5 shrink-0 text-foreground" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={go} className="btn-cta inline-flex items-center gap-2">
          Créer mon compte gratuit <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingClaim(trackingRef);
            navigate(`/auth?redirect=${encodeURIComponent(`/suivre/${trackingRef}`)}`);
          }}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          J'ai déjà un compte
        </button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Ce colis sera automatiquement ajouté à votre espace après connexion.
      </p>
    </aside>
  );
}

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Package as PackageIcon, Truck, CreditCard } from 'lucide-react';
import { type Dossier, COUNTRY_FLAGS, DOSSIER_STATUS_ORDER } from '@/lib/types';
import { StatusPill } from './StatusPill';
import { MiniTimeline } from './MiniTimeline';
import { cn } from '@/lib/utils';

function isPaymentPending(d: Dossier): boolean {
  if (d.payment_status !== 'pending') return false;
  const idx = DOSSIER_STATUS_ORDER.indexOf(d.status);
  // ≥ PROCURED (acheté/pesé) — équivalent du "WEIGHED" du spec
  return idx >= DOSSIER_STATUS_ORDER.indexOf('PROCURED');
}

function isPartnerArrived(d: Dossier): boolean {
  return d.delivery_mode === 'partner_pickup' && d.status === 'IN_TRANSIT';
  // Note: l'enum n'a pas ARRIVED_HUB; on traite IN_TRANSIT comme proxy.
  // Quand le state machine sera étendu, basculer ici.
}

function fmtDate(date?: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return null; }
}

export function ClientDossierCard({ dossier }: { dossier: Dossier }) {
  const navigate = useNavigate();
  const pending = isPaymentPending(dossier);
  const arrived = isPartnerArrived(dossier);
  const eta = fmtDate(dossier.estimated_delivery_date);
  const ref = dossier.reference;

  const route = `${COUNTRY_FLAGS[dossier.origin_country] ?? ''} ${dossier.origin_city ?? dossier.origin_country} → ${dossier.destination_city ?? dossier.destination_country}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-card border rounded-2xl overflow-hidden transition-colors',
        pending ? 'border-orange-500/60' : 'border-border hover:border-foreground/30',
      )}
    >
      {arrived && (
        <div className="bg-green-600/15 text-green-300 px-4 py-2.5 text-xs font-medium border-b border-green-600/20">
          🎉 Votre colis est arrivé ! Récupérez-le chez notre partenaire. Adresse envoyée par WhatsApp.
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(`/app/dossier/${dossier.id}`)}
        className="w-full text-left p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <StatusPill status={dossier.status} />
            <p className="font-mono text-sm font-bold text-foreground mt-2">{ref}</p>
          </div>
          {eta && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Arrivée estimée</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{eta}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{route}</span>
          {dossier.estimated_weight ? (<><span>·</span><span className="inline-flex items-center gap-1"><PackageIcon className="w-3 h-3" />{dossier.estimated_weight} kg</span></>) : null}
          {dossier.is_express ? (<><span>·</span><span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" />Express</span></>) : null}
        </div>

        <MiniTimeline status={dossier.status} />
      </button>

      <div className="px-4 sm:px-5 pb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/app/dossier/${dossier.id}`)}
          className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:border-foreground/40 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          Suivre <ArrowRight className="w-4 h-4" />
        </button>
        {pending && (
          <button
            type="button"
            onClick={() => navigate(`/pay/${dossier.tracking_id ?? dossier.id}`)}
            className="flex-1 h-10 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" /> Payer maintenant
          </button>
        )}
      </div>
    </motion.div>
  );
}

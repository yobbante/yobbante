import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { type Dossier, COUNTRY_FLAGS, DOSSIER_STATUS_LABELS, DOSSIER_STATUS_ORDER } from '@/lib/types';
import { ArrowRight } from 'lucide-react';

export function DossierCard({ dossier }: { dossier: Dossier }) {
  const navigate = useNavigate();
  const stepIdx = DOSSIER_STATUS_ORDER.indexOf(dossier.status);
  const total = DOSSIER_STATUS_ORDER.length - 1;
  const pct = Math.max(0, Math.min(100, Math.round((stepIdx / (total - 1)) * 100)));

  return (
    <motion.button
      type="button"
      onClick={() => navigate(`/app/dossier/${dossier.id}`)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-foreground/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{dossier.reference}</span>
            <span>·</span>
            <span>{DOSSIER_STATUS_LABELS[dossier.status]}</span>
          </div>
          <p className="text-sm font-semibold text-foreground mt-1.5 line-clamp-2">
            {dossier.product_description}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <span>{COUNTRY_FLAGS[dossier.origin_country]}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{dossier.destination_country}</span>
            {dossier.estimated_weight ? (
              <>
                <span>·</span>
                <span>{dossier.estimated_weight} kg</span>
              </>
            ) : null}
          </div>
        </div>
        {dossier.estimated_cost ? (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Estimation</p>
            <p className="text-base font-bold text-foreground">{Math.round(dossier.estimated_cost)} €</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 h-1 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </motion.button>
  );
}

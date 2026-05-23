import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Package, Inbox, Sparkles, Search } from 'lucide-react';

interface ActionBarProps {
  onTrack?: () => void;
  onEstimate?: () => void;
  // back-compat (unused props from older callers)
  onDossier?: () => void;
  onShip?: () => void;
  onBuy?: () => void;
}

/**
 * Dashboard action bar — mirrors the public 2-CTA model.
 * Primary row: Envoyer (light flow) + Recevoir (dark flow).
 * Secondary row: Sourcing fournisseurs + Estimation IA + Suivi.
 */
export function ActionBar({ onTrack, onEstimate }: ActionBarProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Primary: 2-CTA hero — same model as the public landing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/expedier/envoyer')}
          className="group relative overflow-hidden text-left p-4 sm:p-5 rounded-2xl border-2 border-border bg-card hover:border-foreground transition-all"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <p className="mt-3 sm:mt-4 text-[15px] sm:text-base font-bold tracking-tight">Envoyer un colis</p>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground leading-relaxed">D'un point A à un point B. On gère tout.</p>
          <span className="mt-2 sm:mt-3 inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-foreground group-hover:gap-2 transition-all">
            Démarrer <span aria-hidden>→</span>
          </span>
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => navigate('/expedier/recevoir')}
          className="group relative overflow-hidden text-left p-4 sm:p-5 rounded-2xl border-2 border-zinc-900 bg-zinc-950 text-white hover:border-yellow-400 transition-all"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center">
            <Inbox className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <p className="mt-3 sm:mt-4 text-[15px] sm:text-base font-bold tracking-tight">Recevoir une commande</p>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-white/55 leading-relaxed">Achat en ligne ? On réceptionne, regroupe, livre.</p>
          <span className="mt-2 sm:mt-3 inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-yellow-400 group-hover:gap-2 transition-all">
            Démarrer <span aria-hidden>→</span>
          </span>
        </motion.button>
      </div>

      {/* Secondary: minimal trio */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {[
          { icon: Search,    label: 'Sourcing',  desc: 'Fournisseurs', onClick: () => navigate('/acheter') },
          { icon: Sparkles,  label: 'Estimer',   desc: 'Devis IA',     onClick: () => navigate('/expedier/envoyer#tarifs') },
          { icon: Package,   label: 'Suivre',    desc: 'YOB-XXXXXX',   onClick: () => navigate('/suivre') },
        ].map((a, i) => (
          <motion.button
            key={a.label}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}
            onClick={a.onClick}
            className="flex flex-col items-start gap-0.5 sm:gap-1 p-3 sm:p-4 bg-card border border-border rounded-xl hover:border-foreground/40 transition-colors text-left min-h-[76px] sm:min-h-[88px]"
          >
            <a.icon className="w-4 h-4 text-foreground" />
            <span className="text-[13px] sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1">{a.label}</span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground">{a.desc}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

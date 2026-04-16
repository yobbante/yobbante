import { motion } from 'framer-motion';
import { FolderPlus, Sparkles, Send, Search } from 'lucide-react';

interface ActionBarProps {
  onDossier?: () => void;
  onEstimate?: () => void;
  onShip?: () => void;
  onTrack?: () => void;
  // back-compat
  onBuy?: () => void;
}

export function ActionBar({ onDossier, onEstimate, onShip, onTrack, onBuy }: ActionBarProps) {
  const estimate = onEstimate ?? onBuy;

  return (
    <div className="space-y-3">
      {/* Primary: Confier un dossier */}
      <motion.button
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onDossier}
        className="w-full flex items-center gap-4 p-5 bg-foreground text-background rounded-2xl hover:opacity-95 transition-opacity text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-background/10 flex items-center justify-center flex-shrink-0">
          <FolderPlus className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold">Confier un dossier</p>
          <p className="text-xs opacity-70 mt-0.5">Yobbanté gère tout : sourcing, transport, douane, livraison</p>
        </div>
        <span className="text-xs opacity-60">→</span>
      </motion.button>

      {/* Secondary actions */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: Sparkles, label: 'Estimer', desc: 'IA', onClick: estimate },
          { icon: Send, label: 'Expédier', desc: 'Mes colis', onClick: onShip },
          { icon: Search, label: 'Suivre', desc: 'Temps réel', onClick: onTrack },
        ].map((a, i) => (
          <motion.button
            key={a.label}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            onClick={a.onClick}
            className="flex flex-col items-start gap-1 p-4 bg-card border border-border rounded-xl hover:border-foreground/30 transition-colors text-left min-h-[88px]"
          >
            <a.icon className="w-4 h-4 text-foreground" />
            <span className="text-sm font-semibold text-foreground mt-1">{a.label}</span>
            <span className="text-[11px] text-muted-foreground">{a.desc}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

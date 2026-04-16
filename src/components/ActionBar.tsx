import { motion } from 'framer-motion';
import { Search, Send, ShoppingBag } from 'lucide-react';

interface ActionBarProps {
  onTrack?: () => void;
  onShip?: () => void;
  onBuy?: () => void;
}

export function ActionBar({ onTrack, onShip, onBuy }: ActionBarProps) {
  const actions = [
    { icon: Search, label: 'Suivre', desc: 'Vos colis en temps réel', onClick: onTrack },
    { icon: Send, label: 'Expédier', desc: 'Grouper et envoyer', onClick: onShip },
    { icon: ShoppingBag, label: 'Acheter', desc: 'Shopping mondial', onClick: onBuy },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action, i) => (
        <motion.button
          key={action.label}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 400, damping: 25 }}
          onClick={action.onClick}
          className="flex flex-col items-center gap-1.5 p-4 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow min-h-[80px] justify-center"
        >
          <action.icon className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">{action.label}</span>
          <span className="text-[11px] text-muted-foreground leading-tight">{action.desc}</span>
        </motion.button>
      ))}
    </div>
  );
}

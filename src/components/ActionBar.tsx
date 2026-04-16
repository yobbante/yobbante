import { motion } from 'framer-motion';
import { Search, Send, ShoppingBag } from 'lucide-react';

interface ActionBarProps {
  onTrack?: () => void;
  onShip?: () => void;
  onBuy?: () => void;
}

export function ActionBar({ onTrack, onShip, onBuy }: ActionBarProps) {
  const actions = [
    { icon: Search, label: 'Track Package', onClick: onTrack },
    { icon: Send, label: 'Ship Now', onClick: onShip },
    { icon: ShoppingBag, label: 'Buy Product', onClick: onBuy },
  ];

  return (
    <div className="flex gap-3">
      {actions.map((action, i) => (
        <motion.button
          key={action.label}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, type: 'spring', stiffness: 400, damping: 25 }}
          onClick={action.onClick}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-card border border-border/50 rounded-lg text-sm font-medium text-foreground hover:border-primary/40 hover:bg-card/80 transition-all"
        >
          <action.icon className="w-4 h-4 text-primary" />
          {action.label}
        </motion.button>
      ))}
    </div>
  );
}

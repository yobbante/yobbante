import { motion } from 'framer-motion';
import { Search, Send, ShoppingBag } from 'lucide-react';

interface ActionBarProps {
  onTrack?: () => void;
  onShip?: () => void;
  onBuy?: () => void;
}

export function ActionBar({ onTrack, onShip, onBuy }: ActionBarProps) {
  const actions = [
    { icon: Search, label: 'Track', onClick: onTrack },
    { icon: Send, label: 'Ship Now', onClick: onShip },
    { icon: ShoppingBag, label: 'Buy', onClick: onBuy },
  ];

  return (
    <div className="flex gap-3">
      {actions.map((action, i) => (
        <motion.button
          key={action.label}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 400, damping: 25 }}
          onClick={action.onClick}
          className="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 bg-secondary rounded-xl text-sm font-semibold text-foreground hover:bg-secondary/80 active:bg-secondary/70 transition-colors"
        >
          <action.icon className="w-4 h-4 text-primary" />
          {action.label}
        </motion.button>
      ))}
    </div>
  );
}

import { motion } from 'framer-motion';
import { MessageCircle, Phone } from 'lucide-react';
import { whatsappLink, YOBBANTE_WHATSAPP_DISPLAY } from '@/lib/contact';

interface Props {
  message?: string;
  /** Optional small label above the CTA */
  context?: string;
}

/**
 * Mobile-only sticky bar at the bottom that lets users jump to WhatsApp at any time.
 * Hidden on md+ (use inline CTAs there).
 */
export function StickyWhatsAppBar({
  message = "Bonjour Yobbanté, j'ai une question sur mon dossier d'import.",
  context = 'Une question ? Parlez à un agent',
}: Props) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 24 }}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2 pointer-events-none"
    >
      <div className="pointer-events-auto rounded-2xl bg-card border border-border shadow-xl backdrop-blur-md flex items-center gap-2.5 p-2 pl-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{context}</p>
          <p className="text-xs font-semibold text-foreground truncate">{YOBBANTE_WHATSAPP_DISPLAY}</p>
        </div>
        <a
          href={whatsappLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#25D366] text-white px-3.5 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-md shrink-0"
          aria-label="Contacter Yobbanté sur WhatsApp"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
        <a
          href={`tel:+${YOBBANTE_WHATSAPP_DISPLAY.replace(/\s|\+/g, '')}`}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary border border-border text-foreground hover:bg-foreground hover:text-background transition-colors shrink-0"
          aria-label="Appeler Yobbanté"
        >
          <Phone className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  );
}

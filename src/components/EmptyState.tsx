import { motion } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Empty state premium — bordure pointillée discrète, copy inspirante,
 * CTA contextuel. Réutilisé partout dans /app pour cohérence.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center"
    >
      <div className="w-11 h-11 rounded-xl bg-secondary mx-auto mb-4 flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-[15px] font-semibold text-foreground tracking-tight">{title}</p>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {(ctaLabel || secondaryLabel) && (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {ctaLabel && onCta && (
            <Button size="sm" onClick={onCta} className="gap-1">
              {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button size="sm" variant="ghost" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

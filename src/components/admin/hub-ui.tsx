import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Mobile-first admin primitives.
 * En mobile on masque les titres/sous-titres et on ne garde que les icônes :
 * l'admin connaît déjà la structure, l'espace écran sert aux données.
 */
export function HubHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
    </div>
  );
}

/** Onglet : icône seule en mobile, icône + libellé à partir de md. */
export function HubTab({
  value, icon: Icon, label, badge, className,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabsTrigger
          value={value}
          aria-label={label}
          className={cn('relative gap-1.5 px-2.5 md:px-3', className)}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">{label}</span>
          {badge}
        </TabsTrigger>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="md:hidden">{label}</TooltipContent>
    </Tooltip>
  );
}

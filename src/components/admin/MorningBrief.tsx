import { AlertCircle, MessageSquare, CreditCard, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminBrief } from '@/hooks/useAdminBrief';

/**
 * Bandeau "Morning Brief" — 4 pills actionnables au sommet de la Vue Globale.
 * Cliquer sur une pill navigue vers la section correspondante.
 */
export function MorningBrief({ onJump }: { onJump: (s: string) => void }) {
  const { data, isLoading } = useAdminBrief();

  if (isLoading || !data) {
    return (
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-2 overflow-x-auto">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-40 rounded-full flex-shrink-0" />)}
        </div>
      </div>
    );
  }

  const pills: { icon: typeof AlertCircle; label: string; value: number; onClick: () => void; emoji: string }[] = [
    { emoji: '🔴', icon: AlertCircle, label: 'dossiers sans GP', value: data.dossiersNoGp, onClick: () => onJump('dossiers') },
    { emoji: '💬', icon: MessageSquare, label: 'messages non lus', value: data.unreadMessages, onClick: () => onJump('messages') },
    { emoji: '💳', icon: CreditCard, label: 'paiements en attente', value: data.pendingPaymentsCount, onClick: () => onJump('revenus') },
    { emoji: '🚀', icon: Plane, label: 'départs cette semaine', value: data.departuresWeek, onClick: () => onJump('departs') },
  ];

  return (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex gap-2 overflow-x-auto">
        {pills.map(p => {
          const active = p.value > 0;
          return (
            <button
              key={p.label}
              onClick={p.onClick}
              className={cn(
                'group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                active
                  ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] text-foreground hover:bg-[hsl(var(--danger)/0.14)]'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="text-sm leading-none">{p.emoji}</span>
              <span className={cn('tabular-nums font-semibold', active ? 'text-[hsl(var(--danger))]' : 'text-muted-foreground')}>
                {p.value}
              </span>
              <span className="text-muted-foreground group-hover:text-foreground">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

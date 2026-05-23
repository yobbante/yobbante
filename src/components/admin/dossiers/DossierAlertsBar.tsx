// Barre d'alertes pour /admin (vue globale). Masquée si 0 alertes.
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, MessageSquare, Truck, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  onJump?: (section: string, params?: Record<string, string>) => void;
}

export function DossierAlertsBar({ onJump }: Props) {
  const { data } = useQuery({
    queryKey: ['admin-alerts-bar'],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const now = Date.now();
      const since48 = new Date(now - 48 * 3600_000).toISOString();
      const tomorrow = new Date(now + 36 * 3600_000).toISOString();

      const [submittedR, gpR, msgR, payR] = await Promise.all([
        supabase
          .from('dossiers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'SUBMITTED')
          .lt('created_at', since48),
        supabase
          .from('dossiers')
          .select('id', { count: 'exact', head: true })
          .is('assigned_transporteur_ref', null)
          .not('assigned_departure_id', 'is', null)
          .lt('estimated_delivery_date', tomorrow.slice(0, 10)),
        supabase
          .from('dossier_messages')
          .select('id', { count: 'exact', head: true })
          .eq('author_role', 'client')
          .gte('created_at', new Date(now - 7 * 86400_000).toISOString()),
        supabase
          .from('dossiers')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'pending')
          .lt('created_at', since48),
      ]);
      return {
        submittedOld: submittedR.count || 0,
        gpMissing: gpR.count || 0,
        unreadMessages: msgR.count || 0,
        paymentsLate: payR.count || 0,
      };
    },
  });

  if (!data) return null;
  const total = data.submittedOld + data.gpMissing + data.unreadMessages + data.paymentsLate;
  if (total === 0) return null;

  const items: Array<{
    show: boolean;
    label: string;
    icon: React.ComponentType<any>;
    tone: string;
    onClick: () => void;
  }> = [
    {
      show: data.submittedOld > 0,
      label: `${data.submittedOld} dossier${data.submittedOld > 1 ? 's' : ''} soumis depuis +48h`,
      icon: AlertCircle,
      tone: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/15',
      onClick: () => onJump?.('dossiers'),
    },
    {
      show: data.gpMissing > 0,
      label: `${data.gpMissing} GP non confirmé${data.gpMissing > 1 ? 's' : ''} pour bientôt`,
      icon: Truck,
      tone: 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/15',
      onClick: () => onJump?.('terrain'),
    },
    {
      show: data.unreadMessages > 0,
      label: `${data.unreadMessages} message${data.unreadMessages > 1 ? 's' : ''} récent${data.unreadMessages > 1 ? 's' : ''}`,
      icon: MessageSquare,
      tone: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/15',
      onClick: () => onJump?.('messages'),
    },
    {
      show: data.paymentsLate > 0,
      label: `${data.paymentsLate} paiement${data.paymentsLate > 1 ? 's' : ''} en attente +48h`,
      icon: Wallet,
      tone: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/15',
      onClick: () => onJump?.('revenus'),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.filter(i => i.show).map((i, idx) => (
        <button
          key={idx}
          onClick={i.onClick}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
            i.tone,
          )}
        >
          <i.icon className="w-3.5 h-3.5" />
          {i.label}
        </button>
      ))}
    </div>
  );
}

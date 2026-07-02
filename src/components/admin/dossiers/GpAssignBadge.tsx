import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { GpLink } from '@/components/admin/links/EntityLink';

interface Props {
  transporteurRef?: string | null;
  onAssignClick?: (e: React.MouseEvent) => void;
}

export function GpAssignBadge({ transporteurRef, onAssignClick }: Props) {
  const { data: gp } = useQuery({
    queryKey: ['transporteur-by-ref', transporteurRef],
    enabled: !!transporteurRef,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('transporteurs' as any)
        .select('prenom, nom, photo_url')
        .eq('reference', transporteurRef)
        .maybeSingle();
      return data as any;
    },
  });

  if (!transporteurRef) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAssignClick?.(e);
        }}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap',
          'bg-orange-500/15 text-orange-400 border border-orange-500/30',
          'hover:bg-orange-500/25 transition-colors cursor-pointer',
        )}
      >
        <AlertTriangle className="w-3 h-3" />
        À assigner
      </button>
    );
  }

  const initials = gp
    ? `${(gp.prenom || '').charAt(0)}${(gp.nom || '').charAt(0)}`.toUpperCase()
    : '..';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
      title={`GP ${transporteurRef}`}
    >
      {gp?.photo_url ? (
        <img
          src={gp.photo_url}
          alt=""
          className="w-5 h-5 rounded-full object-cover border border-border"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-secondary text-foreground inline-flex items-center justify-center text-[9px] font-semibold">
          {initials || <User className="w-2.5 h-2.5" />}
        </span>
      )}
      <span className="truncate max-w-[80px]">
        {gp?.prenom || `GP ${transporteurRef}`}
      </span>
    </span>
  );
}

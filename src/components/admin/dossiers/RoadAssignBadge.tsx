import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { FRET_STATUS_LABEL, type FretStatus } from '@/lib/fretApi';

interface Props {
  dossierId: string;
}

interface RoadAssignment {
  ref: string;
  status: FretStatus;
  chauffeur_id: string | null;
  chauffeur_nom: string | null;
  immatriculation: string | null;
}

/**
 * Colonne « assignation » pour un dossier en transport routier (Terminal D) :
 * on affiche le chauffeur affecté à la course, ou l'état d'attente d'assignation.
 */
export function RoadAssignBadge({ dossierId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['road-assignment', dossierId],
    staleTime: 30_000,
    queryFn: async (): Promise<RoadAssignment | null> => {
      const { data: course } = await supabase
        .from('fret_courses' as any)
        .select('ref, status, chauffeur_id')
        .eq('dossier_id', dossierId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!course) return null;
      const c = course as any;
      let nom: string | null = null;
      let immat: string | null = null;
      if (c.chauffeur_id) {
        const { data: ch } = await supabase
          .from('chauffeurs' as any)
          .select('nom_complet, telephone, immatriculation')
          .eq('id', c.chauffeur_id)
          .maybeSingle();
        nom = (ch as any)?.nom_complet || (ch as any)?.telephone || null;
        immat = (ch as any)?.immatriculation ?? null;
      }
      return {
        ref: c.ref,
        status: c.status as FretStatus,
        chauffeur_id: c.chauffeur_id,
        chauffeur_nom: nom,
        immatriculation: immat,
      };
    },
  });

  if (isLoading) {
    return <span className="text-[11px] text-muted-foreground">…</span>;
  }

  if (!data) {
    return (
      <span
        title="Dossier routier sans course Terminal D"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap bg-orange-500/15 text-orange-400 border border-orange-500/30"
      >
        <AlertTriangle className="w-3 h-3" />
        Course à créer
      </span>
    );
  }

  if (!data.chauffeur_id) {
    return (
      <span
        title={`Course ${data.ref} · ${FRET_STATUS_LABEL[data.status]}`}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap',
          'bg-amber-500/15 text-amber-500 border border-amber-500/30',
        )}
      >
        <Truck className="w-3 h-3" />
        Chauffeur à assigner
      </span>
    );
  }

  return (
    <span
      title={`Course ${data.ref} · ${FRET_STATUS_LABEL[data.status]}`}
      className="inline-flex items-center gap-1.5 text-[11px] text-foreground"
    >
      <span className="w-5 h-5 rounded-full bg-secondary inline-flex items-center justify-center">
        <Truck className="w-2.5 h-2.5" />
      </span>
      <span className="truncate max-w-[90px]">{data.chauffeur_nom}</span>
      {data.immatriculation && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{data.immatriculation}</span>
      )}
    </span>
  );
}

import { Fragment, useMemo, useState } from 'react';
import { Route as RouteIcon, Search, ChevronRight, Truck, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFretCourses, useChauffeurs, FRET_ACTIVE_STATUSES, type AdminFretCourse } from '@/hooks/useFretAdmin';
import { FRET_STATUS_LABEL } from '@/lib/fretApi';
import { FretCourseSheet, FRET_STATUS_TONE } from '@/components/admin/fret/FretCourseSheet';
import { DossierTableShell, TimingCellBody, InlineAmount } from './dossierTableUi';
import { formatShortDate, daysFromToday, TIMING_TONE_CLASS, type DossierTiming } from '@/lib/dossierTiming';
import { dossierAmount } from '@/lib/dossierAmount';
import { cn } from '@/lib/utils';

/**
 * Courses Terminal D (fret routier) — affichées avec EXACTEMENT la même
 * structure de tableau que « Demandes entrantes » pour que toutes les fiches
 * admin soient synchronisées visuellement et fonctionnellement.
 */
function fretTiming(c: AdminFretCourse): DossierTiming {
  if (c.status === 'LIVRE') {
    return { label: 'Livré', value: formatShortDate(c.delivered_at ?? c.created_at) ?? '—', tone: 'success' };
  }
  if (c.status === 'ANNULE') {
    return { label: 'Annulé', value: formatShortDate(c.created_at) ?? '—', tone: 'danger' };
  }
  if (c.status === 'A_ENLEVER' || c.status === 'PENDING_ACCEPT') {
    const age = daysFromToday(c.created_at);
    const days = age == null ? null : Math.abs(age);
    return {
      label: 'Enlèvement',
      value: 'À planifier',
      hint: days != null ? `créée il y a ${days} j` : undefined,
      tone: days != null && days >= 2 ? 'warn' : 'info',
    };
  }
  return {
    label: 'En cours',
    value: FRET_STATUS_LABEL[c.status],
    hint: formatShortDate(c.remis_at ?? c.en_route_at ?? c.created_at) ?? undefined,
    tone: 'info',
  };
}

export function FretDossiersList({ compact = false }: { compact?: boolean }) {
  const { data: courses = [], isLoading } = useFretCourses();
  const { data: chauffeurs = [] } = useChauffeurs();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(compact);
  const [selected, setSelected] = useState<AdminFretCourse | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const chauffeurById = useMemo(() => new Map(chauffeurs.map(c => [c.id, c])), [chauffeurs]);

  const updateAmount = useMutation({
    mutationFn: async ({ id, xof }: { id: string; xof: number | null }) => {
      const { error } = await supabase.from('fret_courses' as any).update({ total_fcfa: xof }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Montant mis à jour');
      qc.invalidateQueries({ queryKey: ['fret-courses'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec mise à jour du montant'),
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return courses.filter((c) => {
      if (activeOnly && !FRET_ACTIVE_STATUSES.includes(c.status)) return false;
      if (!s) return true;
      return c.ref.toLowerCase().includes(s)
        || c.destination.toLowerCase().includes(s)
        || (c.client_nom ?? '').toLowerCase().includes(s)
        || (c.expediteur_nom ?? '').toLowerCase().includes(s);
    });
  }, [courses, q, activeOnly]);

  const current = selected ? courses.find(c => c.id === selected.id) ?? selected : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9"
                 placeholder="Réf YBR · destination · client" />
        </div>
        <Button size="sm" variant="outline" className="h-9 text-xs shrink-0"
                onClick={() => setActiveOnly(v => !v)}>
          {activeOnly ? 'Voir tout' : 'Actives'}
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-xs shrink-0"
                onClick={() => navigate('/admin/terrain?tab=fret')}>
          Module fret
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Aucun dossier routier.</p>
      ) : (
        <DossierTableShell assignLabel="Chauffeur">
          {rows.map((c) => {
            const ch = chauffeurById.get(c.chauffeur_id ?? '');
            const isOpen = expandedId === c.id;
            const timing = fretTiming(c);
            const amount = dossierAmount(c as any);
            const clientName = c.client_nom || c.expediteur_nom || 'Client';
            const phone = c.client_phone || c.expediteur_phone;

            return (
              <Fragment key={c.id}>
                <tr
                  data-dossier-id={c.id}
                  onClick={() => setExpandedId(prev => (prev === c.id ? null : c.id))}
                  onDoubleClick={() => setSelected(c)}
                  className={cn('cursor-pointer transition-colors', isOpen ? 'bg-secondary/40' : 'hover:bg-secondary/30')}
                >
                  {/* Réf */}
                  <td className="px-2 md:px-3 py-2 md:py-2.5 align-middle">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                      className="font-mono text-[11px] md:text-[12px] font-semibold text-foreground hover:underline text-left inline-flex items-center gap-1 md:gap-1.5 max-w-full"
                    >
                      <span className="text-base leading-none">🇸🇳</span>
                      <span className="truncate">{c.ref}</span>
                    </button>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      Routier{c.scope === 'international' ? ' int.' : ''} · Dakar → {c.destination}
                    </div>
                  </td>
                  {/* Client */}
                  <td className="px-2 md:px-3 py-2 md:py-2.5 align-middle">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedId(prev => (prev === c.id ? null : c.id)); }}
                      className="text-foreground hover:underline text-left truncate max-w-full md:max-w-[220px] block text-[12px] md:text-[13px] font-medium"
                    >
                      {clientName}
                    </button>
                    {phone ? (
                      <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}
                         className="text-[10px] md:text-[11px] text-muted-foreground hover:text-foreground font-mono truncate block">
                        {phone}
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground truncate block">{c.destination}</span>
                    )}
                  </td>
                  {/* Statut */}
                  <td className="px-2 md:px-3 py-2 md:py-2.5 align-middle">
                    <span className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium',
                      FRET_STATUS_TONE[c.status] || 'bg-secondary text-muted-foreground border-border',
                    )}>
                      {FRET_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  {/* Échéance */}
                  <td className="px-2 md:px-3 py-2 md:py-2.5 align-middle hidden md:table-cell">
                    <TimingCellBody timing={timing} />
                  </td>
                  {/* Chauffeur */}
                  <td className="px-2 md:px-3 py-2 md:py-2.5 align-middle hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className="inline-flex items-center gap-1 text-[11px] hover:underline"
                    >
                      <Truck className="w-3 h-3 shrink-0" />
                      <span className={cn('truncate max-w-[110px]', !ch && 'text-muted-foreground')}>
                        {ch ? (ch.nom_complet || ch.telephone) : 'Assigner'}
                      </span>
                    </button>
                  </td>
                  {/* Montant (éditable) */}
                  <td className="px-2 md:px-3 py-2 md:py-2.5 align-middle text-right tabular-nums hidden md:table-cell">
                    <InlineAmount
                      value={amount.xof}
                      isFinal={amount.isFinal}
                      onSave={(v) => updateAmount.mutateAsync({ id: c.id, xof: v })}
                    />
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-secondary/20">
                    <td colSpan={6} className="px-3 md:px-4 py-3 border-t border-border">
                      <div className="space-y-3">
                        <div className="md:hidden flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                          <span className="text-muted-foreground">
                            {timing.label} : <span className={cn('font-medium', TIMING_TONE_CLASS[timing.tone])}>{timing.value}</span>
                          </span>
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            Montant :
                            <InlineAmount
                              value={amount.xof}
                              isFinal={amount.isFinal}
                              onSave={(v) => updateAmount.mutateAsync({ id: c.id, xof: v })}
                            />
                          </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 text-xs">
                          <InfoLine icon={<RouteIcon className="w-3 h-3" />} label="Trajet" value={`Dakar → ${c.destination}`} />
                          <InfoLine icon={<MapPin className="w-3 h-3" />} label="Enlèvement"
                                    value={[c.pickup_zone, c.pickup_address].filter(Boolean).join(' · ') || 'Non renseigné'} />
                          <InfoLine icon={<Truck className="w-3 h-3" />} label="Chauffeur"
                                    value={ch ? (ch.nom_complet || ch.telephone) : 'Aucun'} />
                          <InfoLine label="Colis" value={[c.colis_size, c.weight_kg ? `${c.weight_kg} kg` : null, c.colis_description]
                            .filter(Boolean).join(' · ') || '—'} />
                        </div>

                        <div className="flex justify-end">
                          <Button size="sm" className="text-xs h-8" onClick={() => setSelected(c)}>
                            Ouvrir la fiche <ChevronRight className="w-3 h-3 ml-1.5" />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </DossierTableShell>
      )}

      <FretCourseSheet
        course={current}
        open={!!current}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        onAssign={() => navigate('/admin/terrain?tab=fret')}
      />
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-[12px] text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, MapPin, Package, RefreshCw, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Livreur {
  id: string;
  prenom: string;
  nom: string;
  zone_couverte: string[] | null;
  is_active: boolean;
}

interface CollectDossier {
  id: string;
  reference: string;
  tracking_id: string | null;
  status: string;
  contact_phone: string | null;
  buyer_name: string | null;
  estimated_weight: number | null;
  collecte_creneau: string | null;
  livreur_collecte_id: string | null;
  product_description: string | null;
}

/**
 * Dispatch du jour — assign a livreur to each collection scheduled today.
 * One dropdown per row (simple), no drag&drop.
 */
export function DispatchPanel() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: livreurs } = useQuery({
    queryKey: ['livreurs', 'active'],
    queryFn: async (): Promise<Livreur[]> => {
      const { data, error } = await supabase
        .from('livreurs' as any)
        .select('id, prenom, nom, zone_couverte, is_active')
        .eq('is_active', true)
        .order('prenom');
      if (error) throw error;
      return (data ?? []) as unknown as Livreur[];
    },
  });

  const { data: dossiers, isLoading, refetch } = useQuery({
    queryKey: ['dispatch-day', date],
    queryFn: async (): Promise<CollectDossier[]> => {
      const start = new Date(`${date}T00:00:00`).toISOString();
      const end = new Date(`${date}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from('dossiers' as any)
        .select('id, reference, tracking_id, status, contact_phone, buyer_name, estimated_weight, collecte_creneau, livreur_collecte_id, product_description')
        .or(`status.eq.COLLECTING,and(collecte_creneau.gte.${start},collecte_creneau.lte.${end})`)
        .order('collecte_creneau', { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as CollectDossier[];
    },
    staleTime: 15_000,
  });

  const assign = useMutation({
    mutationFn: async ({ dossierId, livreurId }: { dossierId: string; livreurId: string | null }) => {
      const { error } = await supabase
        .from('dossiers' as any)
        .update({ livreur_collecte_id: livreurId })
        .eq('id', dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispatch-day'] });
      qc.invalidateQueries({ queryKey: ['livreur-mission-counts'] });
    },
  });

  const stats = useMemo(() => {
    const all = dossiers ?? [];
    return {
      total: all.length,
      assigned: all.filter(d => d.livreur_collecte_id).length,
      unassigned: all.filter(d => !d.livreur_collecte_id).length,
    };
  }, [dossiers]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <Button size="icon" variant="ghost" onClick={() => refetch()} className="h-9 w-9">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-secondary">Total: <b>{stats.total}</b></span>
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500">Assignés: <b>{stats.assigned}</b></span>
          <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500">À assigner: <b>{stats.unassigned}</b></span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (dossiers ?? []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Aucune collecte pour cette date.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {(dossiers ?? []).map((d) => {
            const creneau = d.collecte_creneau
              ? new Date(d.collecte_creneau).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : '—';
            return (
              <div
                key={d.id}
                className="grid grid-cols-1 md:grid-cols-[100px_1.4fr_1fr_240px] gap-3 items-center px-3 py-3 border-t border-border first:border-t-0 text-sm"
              >
                <div className="font-mono text-xs">
                  <div className="font-semibold">{d.tracking_id ?? d.reference}</div>
                  <div className="text-muted-foreground">{creneau}</div>
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    <User className="w-3 h-3 text-muted-foreground" /> {d.buyer_name ?? 'Client'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{d.contact_phone ?? '—'}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Package className="w-3 h-3" /> {d.estimated_weight ?? '?'}kg · {d.product_description?.slice(0, 40) ?? '—'}
                </div>
                <div>
                  <Select
                    value={d.livreur_collecte_id ?? 'none'}
                    onValueChange={(v) =>
                      assign.mutate({ dossierId: d.id, livreurId: v === 'none' ? null : v }, {
                        onSuccess: () => toast.success(v === 'none' ? 'Désassigné' : 'Livreur assigné'),
                        onError: (e: any) => toast.error(e?.message ?? 'Erreur'),
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Assigner livreur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Non assigné —</SelectItem>
                      {(livreurs ?? []).map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.prenom} {l.nom}
                          {l.zone_couverte && l.zone_couverte.length > 0 && (
                            <span className="text-muted-foreground ml-1.5">({l.zone_couverte.slice(0, 2).join(', ')})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

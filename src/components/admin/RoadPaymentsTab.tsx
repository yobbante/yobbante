import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatXof } from '@/lib/gpFinance';

type Course = {
  id: string;
  ref: string | null;
  status: string;
  destination: string | null;
  client_nom: string | null;
  total_fcfa: number | null;
  chauffeur_cost_fcfa: number | null;
  chauffeur_paid: boolean;
  chauffeur_id: string | null;
  delivered_at: string | null;
  created_at: string;
};

type Chauffeur = { id: string; nom: string | null; telephone: string | null };

/** Paiements dus aux chauffeurs / transporteurs routiers (Terminal D). */
export function RoadPaymentsTab() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: chauffeurs = [] } = useQuery({
    queryKey: ['road-pay-chauffeurs'],
    queryFn: async (): Promise<Chauffeur[]> => {
      const { data, error } = await supabase.from('chauffeurs' as any).select('id, nom, telephone');
      if (error) throw error;
      return (data ?? []) as unknown as Chauffeur[];
    },
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['road-pay-courses'],
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase
        .from('fret_courses' as any)
        .select('id, ref, status, destination, client_nom, total_fcfa, chauffeur_cost_fcfa, chauffeur_paid, chauffeur_id, delivered_at, created_at')
        .neq('status', 'ANNULE')
        .eq('chauffeur_paid', false)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Course[];
    },
  });

  const chauffeurById = useMemo(() => {
    const m = new Map<string, Chauffeur>();
    chauffeurs.forEach(c => m.set(c.id, c));
    return m;
  }, [chauffeurs]);

  const totalDue = courses.reduce((s, c) => s + Number(c.chauffeur_cost_fcfa || 0), 0);

  const saveCost = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from('fret_courses' as any)
        .update({ chauffeur_cost_fcfa: amount } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['road-pay-courses'] });
      qc.invalidateQueries({ queryKey: ['finance-ledger'] });
      toast.success('Coût chauffeur enregistré');
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fret_courses' as any)
        .update({ chauffeur_paid: true, chauffeur_paid_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['road-pay-courses'] });
      qc.invalidateQueries({ queryKey: ['finance-ledger'] });
      toast.success('Course marquée payée');
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  if (isLoading) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Truck className="w-4 h-4 text-muted-foreground" />
          <span>{courses.length} course(s) à régler</span>
        </div>
        <span className="text-sm font-semibold tabular-nums">{formatXof(totalDue)}</span>
      </div>

      {courses.length === 0 && (
        <p className="text-sm text-muted-foreground px-1">Aucun paiement routier en attente.</p>
      )}

      {courses.map((c) => {
        const ch = c.chauffeur_id ? chauffeurById.get(c.chauffeur_id) : null;
        const cost = Number(c.chauffeur_cost_fcfa || 0);
        const draft = drafts[c.id] ?? (cost ? String(cost) : '');
        return (
          <div key={c.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.ref ?? '—'} · {c.client_nom ?? 'Client'}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {c.destination ?? '—'} · {ch?.nom ?? 'Chauffeur non assigné'}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">{c.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Prix client : {formatXof(c.total_fcfa)}
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Input
                  inputMode="numeric"
                  className="h-8 w-28 text-xs"
                  placeholder="Coût chauffeur"
                  value={draft}
                  onChange={(e) => setDrafts(d => ({ ...d, [c.id]: e.target.value.replace(/[^\d]/g, '') }))}
                />
                <Button
                  size="sm" variant="outline" className="h-8"
                  disabled={saveCost.isPending || !draft}
                  onClick={() => saveCost.mutate({ id: c.id, amount: Number(draft) })}
                >
                  {saveCost.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enregistrer'}
                </Button>
                <Button
                  size="sm" className="h-8"
                  disabled={markPaid.isPending || !cost}
                  onClick={() => markPaid.mutate(c.id)}
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Payé
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

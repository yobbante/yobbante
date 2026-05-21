import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Phone, MessageCircle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'pending' | 'contacted' | 'quoted' | 'won' | 'lost';
const STATUS_LABEL: Record<Status, string> = {
  pending: 'À contacter', contacted: 'Contacté', quoted: 'Devis envoyé', won: 'Confirmé', lost: 'Perdu',
};
const STATUS_COLOR: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  contacted: 'bg-blue-100 text-blue-900 border-blue-200',
  quoted: 'bg-violet-100 text-violet-900 border-violet-200',
  won: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  lost: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

export function ManualQuotesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['manual_quote_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_quote_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from('manual_quote_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['manual_quote_requests'] }); toast.success('Statut mis à jour'); },
    onError: (e: any) => toast.error(e?.message ?? 'Erreur'),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Chargement…</p>;
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5" /> Devis manuels
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demandes de devis sur mesure reçues depuis le flow d'expédition.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucune demande pour le moment.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-left px-4 py-2.5">Trajet</th>
                <th className="text-left px-4 py-2.5">Poids</th>
                <th className="text-left px-4 py-2.5">Statut</th>
                <th className="text-left px-4 py-2.5">Reçu</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const status = (r.status ?? 'pending') as Status;
                const waUrl = `https://wa.me/${r.client_phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Bonjour ${r.client_name}, suite à votre demande de devis Yobbanté (${r.origin_city} → ${r.destination_city}, ${r.weight_kg} kg)…`)}`;
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.client_name}</p>
                      <p className="text-xs text-muted-foreground">{r.client_phone}</p>
                      {r.note && <p className="mt-1 text-[11px] text-muted-foreground italic">« {r.note} »</p>}
                    </td>
                    <td className="px-4 py-3">{r.origin_city} → {r.destination_city}</td>
                    <td className="px-4 py-3 tabular-nums">{r.weight_kg} kg</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                        <a href={`tel:${r.client_phone}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">
                          <Phone className="w-3 h-3" /> Appel
                        </a>
                        <select
                          value={status}
                          onChange={(e) => update.mutate({ id: r.id, status: e.target.value as Status })}
                          className="text-[11px] rounded-md border border-border bg-background px-1.5 py-1"
                        >
                          {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

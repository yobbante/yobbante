import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Mail, Phone, ChevronRight, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  QUALIFIED: 'Qualifié',
  WON: 'Gagné',
  LOST: 'Perdu',
};
const STATUS_ORDER = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;
type QStatus = typeof STATUS_ORDER[number];

interface Quote {
  id: string;
  company: string;
  sector: string;
  volume: string;
  full_name: string;
  role: string | null;
  email: string;
  phone: string;
  notes: string | null;
  status: QStatus;
  source: string;
  admin_notes: string | null;
  created_at: string;
}

export function EnterpriseQuotesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['admin-enterprise-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enterprise_quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Quote[];
    },
  });

  const updateQuote = useMutation({
    mutationFn: async (input: { id: string; status?: QStatus; admin_notes?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from('enterprise_quotes').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-enterprise-quotes'] });
      toast.success('Devis mis à jour');
    },
    onError: () => toast.error('Échec de la mise à jour'),
  });

  const filtered = quotes.filter(q => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        q.company.toLowerCase().includes(s) ||
        q.full_name.toLowerCase().includes(s) ||
        q.email.toLowerCase().includes(s) ||
        q.sector.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const selected = quotes.find(q => q.id === selectedId) || null;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <section>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Entreprise, contact, email…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as QStatus | 'ALL')}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous statuts</SelectItem>
              {STATUS_ORDER.map(s => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Aucun devis entreprise</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les nouvelles demandes du formulaire /devis-entreprise apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(q => (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={cn(
                  'w-full text-left bg-card border rounded-xl p-4 transition-all flex items-center gap-3',
                  selectedId === q.id ? 'border-foreground' : 'border-border hover:border-foreground/40'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-foreground">{q.company}</span>
                    <span className="text-muted-foreground">· {STATUS_LABELS[q.status]}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                    {q.full_name} {q.role ? `— ${q.role}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {q.sector} · {q.volume} · {new Date(q.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {!selected ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Sélectionnez un devis</p>
            <p className="text-xs text-muted-foreground mt-1">Pour qualifier le lead et ajouter une note interne.</p>
          </div>
        ) : (
          <QuotePanel
            key={selected.id}
            quote={selected}
            onUpdate={(patch) => updateQuote.mutateAsync({ id: selected.id, ...patch })}
            isPending={updateQuote.isPending}
          />
        )}
      </aside>
    </div>
  );
}

function QuotePanel({ quote, onUpdate, isPending }: {
  quote: Quote;
  onUpdate: (patch: { status?: QStatus; admin_notes?: string }) => Promise<void>;
  isPending: boolean;
}) {
  const [status, setStatus] = useState<QStatus>(quote.status);
  const [notes, setNotes] = useState(quote.admin_notes || '');

  const dirty = status !== quote.status || notes !== (quote.admin_notes || '');

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-sm font-bold text-foreground">{quote.company}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{quote.sector} · {quote.volume}</p>
      </div>

      <div className="rounded-xl bg-secondary/60 p-3 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{quote.full_name} {quote.role ? `— ${quote.role}` : ''}</p>
        <a href={`mailto:${quote.email}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary">
          <Mail className="w-3.5 h-3.5" /> {quote.email}
        </a>
        <a href={`tel:${quote.phone}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary">
          <Phone className="w-3.5 h-3.5" /> {quote.phone}
        </a>
      </div>

      {quote.notes && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Brief client</p>
          <p className="text-xs text-foreground/85 whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Statut</label>
        <Select value={status} onValueChange={v => setStatus(v as QStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Notes internes</label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="Visible uniquement par l'équipe Yobbanté"
        />
      </div>

      <Button
        onClick={() => onUpdate({ status, admin_notes: notes })}
        disabled={isPending || !dirty}
        className="w-full"
      >
        Enregistrer
      </Button>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        Reçu : {new Date(quote.created_at).toLocaleString('fr-FR')} · Source : {quote.source}
      </p>
    </div>
  );
}

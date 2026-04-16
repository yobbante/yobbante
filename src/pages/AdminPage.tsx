import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Search, ChevronRight, FolderOpen, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUserRole } from '@/hooks/useUserRole';
import { UsersTab } from '@/components/admin/UsersTab';
import {
  type Dossier,
  type DossierStatus,
  COUNTRY_FLAGS,
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_ORDER,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminPage() {
  const navigate = useNavigate();
  const { isStaff, isAdmin, isLoading: roleLoading } = useUserRole();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<'dossiers' | 'users'>('dossiers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth');
      else setAuthChecked(true);
    });
  }, [navigate]);

  const qc = useQueryClient();
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['admin-dossiers'],
    enabled: authChecked && isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Dossier[];
    },
  });

  const updateDossier = useMutation({
    mutationFn: async (input: { id: string; status?: DossierStatus; admin_notes?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from('dossiers').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-dossiers'] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success('Dossier mis à jour');
    },
    onError: () => toast.error('Échec de la mise à jour'),
  });

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.reference.toLowerCase().includes(q) ||
          d.product_description.toLowerCase().includes(q) ||
          (d.contact_email || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dossiers, search, statusFilter]);

  const selected = dossiers.find(d => d.id === selectedId) || null;

  if (!authChecked || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold text-foreground">Accès réservé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cet espace est réservé à l'équipe Yobbanté. Contactez un administrateur pour obtenir l'accès.
          </p>
          <Button onClick={() => navigate('/app')} variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/app')} className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-foreground truncate">YOBBANTÉ — Admin</p>
              <p className="text-[11px] text-muted-foreground truncate">Suivi opérationnel</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-full whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" /> {isAdmin ? 'Admin' : 'Staff'}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'dossiers' | 'users')}>
          <TabsList className="grid grid-cols-2 w-full max-w-sm mb-6">
            <TabsTrigger value="dossiers" className="gap-2">
              <FolderOpen className="w-4 h-4" /> Dossiers
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" disabled={!isAdmin}>
              <Users className="w-4 h-4" /> Utilisateurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dossiers" className="mt-0">
            <div className="grid lg:grid-cols-[1fr_400px] gap-6">
              <section>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Réf, produit, email…"
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={v => setStatusFilter(v as DossierStatus | 'ALL')}>
                    <SelectTrigger className="sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous statuts</SelectItem>
                      {DOSSIER_STATUS_ORDER.map(s => (
                        <SelectItem key={s} value={s}>{DOSSIER_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="text-sm font-semibold text-foreground">Aucun dossier</p>
                    <p className="text-xs text-muted-foreground mt-1">Ajustez vos filtres ou attendez de nouveaux dossiers.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={cn(
                          'w-full text-left bg-card border rounded-xl p-4 transition-all flex items-center gap-3',
                          selectedId === d.id ? 'border-foreground' : 'border-border hover:border-foreground/40'
                        )}
                      >
                        <span className="text-xl flex-shrink-0">{COUNTRY_FLAGS[d.origin_country]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="font-mono font-semibold text-foreground">{d.reference}</span>
                            <span className="text-muted-foreground">· {DOSSIER_STATUS_LABELS[d.status]}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate mt-0.5">{d.product_description}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {new Date(d.created_at).toLocaleDateString('fr-FR')} · {d.contact_email || 'pas d\'email'}
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
                    <p className="text-sm font-semibold text-foreground">Sélectionnez un dossier</p>
                    <p className="text-xs text-muted-foreground mt-1">Pour modifier le statut ou ajouter une note interne.</p>
                  </div>
                ) : (
                  <AdminDossierPanel
                    key={selected.id}
                    dossier={selected}
                    onUpdate={(patch) => updateDossier.mutateAsync({ id: selected.id, ...patch })}
                    onOpen={() => navigate(`/app/dossier/${selected.id}`)}
                    isPending={updateDossier.isPending}
                  />
                )}
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            {isAdmin ? (
              <UsersTab />
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Réservé aux administrateurs</p>
                <p className="text-xs text-muted-foreground mt-1">La gestion des rôles n'est accessible qu'aux admins.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AdminDossierPanel({ dossier, onUpdate, onOpen, isPending }: {
  dossier: Dossier;
  onUpdate: (patch: { status?: DossierStatus; admin_notes?: string }) => Promise<void>;
  onOpen: () => void;
  isPending: boolean;
}) {
  const [status, setStatus] = useState<DossierStatus>(dossier.status);
  const [notes, setNotes] = useState(dossier.admin_notes || '');

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <p className="font-mono text-sm font-bold text-foreground">{dossier.reference}</p>
        <p className="text-sm font-semibold text-foreground mt-1 line-clamp-2">{dossier.product_description}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Statut</label>
        <Select value={status} onValueChange={v => setStatus(v as DossierStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOSSIER_STATUS_ORDER.map(s => (
              <SelectItem key={s} value={s}>{DOSSIER_STATUS_LABELS[s]}</SelectItem>
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

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => onUpdate({ status, admin_notes: notes })}
          disabled={isPending || (status === dossier.status && notes === (dossier.admin_notes || ''))}
          className="w-full"
        >
          Enregistrer
        </Button>
        <Button onClick={onOpen} variant="outline" className="w-full">
          Voir la fiche complète
        </Button>
      </div>

      <div className="text-[11px] text-muted-foreground border-t border-border pt-3 space-y-0.5">
        <p>Client : {dossier.contact_email || '—'}</p>
        <p>Téléphone : {dossier.contact_phone || '—'}</p>
        <p>Reçu : {new Date(dossier.created_at).toLocaleString('fr-FR')}</p>
      </div>
    </div>
  );
}

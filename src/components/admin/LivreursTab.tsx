import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Pencil, Plus, Power, Search, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { sendGpMessage } from '@/lib/sendGpMessage';
import { DispatchPanel } from './DispatchPanel';
import { QUARTIER_GROUPS } from '@/lib/dakarZones';

const YOBBANTE_BOT_NUMBER = '+221781221891';

interface Livreur {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  zone_couverte: string[] | null;
  is_active: boolean;
  notes: string | null;
  invitation_bot_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function buildOnboardMessage(prenom: string) {
  return `Salam ${prenom},

Vous etes livreur partenaire Yobbante.

Enregistrez ce numero dans vos contacts :
${YOBBANTE_BOT_NUMBER}
Nom : Yobbante Livraisons

Envoyez AIDE pour voir vos missions.

Merci !`;
}

function useLivreurs() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['livreurs'],
    queryFn: async (): Promise<Livreur[]> => {
      const { data, error } = await supabase
        .from('livreurs' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Livreur[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Livreur> & { prenom: string; nom: string; telephone: string }) => {
      const { data, error } = await supabase
        .from('livreurs' as any)
        .upsert(input, { onConflict: 'telephone' })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Livreur;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livreurs'] }),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('livreurs' as any).update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livreurs'] }),
  });

  return { list, upsert, setActive };
}

function useMissionCounts() {
  return useQuery({
    queryKey: ['livreur-mission-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('dossiers' as any)
        .select('livreur_collecte_id')
        .not('livreur_collecte_id', 'is', null)
        .is('collecte_confirmee_at', null)
        .limit(5000);
      if (error) return {};
      const map: Record<string, number> = {};
      (data as any[] | null)?.forEach((r) => {
        if (r.livreur_collecte_id) map[r.livreur_collecte_id] = (map[r.livreur_collecte_id] ?? 0) + 1;
      });
      return map;
    },
    staleTime: 30_000,
  });
}

function useBotActiveLivreurs() {
  return useQuery({
    queryKey: ['livreur-bot-active'],
    queryFn: async (): Promise<Set<string>> => {
      // A livreur is "active on bot" if we have at least one inbound message from their phone on the gp channel
      const { data: livs } = await supabase.from('livreurs' as any).select('id, telephone').limit(500);
      if (!livs) return new Set();
      const set = new Set<string>();
      for (const l of livs as any[]) {
        const tail = (l.telephone || '').replace(/\D/g, '').slice(-9);
        if (!tail) continue;
        const { data } = await supabase
          .from('whatsapp_inbound_messages' as any)
          .select('id')
          .eq('channel', 'gp')
          .ilike('from_phone', `%${tail}%`)
          .limit(1);
        if ((data ?? []).length > 0) set.add(l.id);
      }
      return set;
    },
    staleTime: 60_000,
  });
}

export function LivreursTab() {
  const { list, upsert, setActive } = useLivreurs();
  const { data: missions } = useMissionCounts();
  const { data: botActive } = useBotActiveLivreurs();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Livreur> | null>(null);

  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter(l =>
      l.nom.toLowerCase().includes(s) ||
      l.prenom.toLowerCase().includes(s) ||
      l.telephone.includes(s) ||
      (l.zone_couverte ?? []).some(z => z.toLowerCase().includes(s)),
    );
  }, [list.data, q]);

  const onboardLivreur = async (l: Livreur) => {
    const res = await sendGpMessage({
      phone: l.telephone,
      message: buildOnboardMessage(l.prenom),
      trigger_type: 'admin_onboard_livreur',
    });
    if (res.ok) toast.success('Invitation livreur envoyée');
    try {
      await supabase.from('livreurs' as any)
        .update({ invitation_bot_sent_at: new Date().toISOString() })
        .eq('id', l.id);
      list.refetch();
    } catch { /* non-bloquant */ }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Livreurs Dakar</h2>
          <p className="text-sm text-muted-foreground">Annuaire des livreurs et dispatch quotidien des collectes.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing({ prenom: '', nom: '', telephone: '', zone_couverte: [], is_active: true })}
          style={{ background: '#F5C518', color: '#0A0E1A' }}
        >
          <Plus className="w-4 h-4 mr-2" /> Nouveau livreur
        </Button>
      </header>

      <Tabs defaultValue="annuaire" className="w-full">
        <TabsList>
          <TabsTrigger value="annuaire">Annuaire</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch du jour</TabsTrigger>
        </TabsList>

        <TabsContent value="dispatch" className="mt-4">
          <DispatchPanel />
        </TabsContent>

        <TabsContent value="annuaire" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : nom · téléphone · zone" className="pl-9" />
          </div>

      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Aucun livreur {q ? 'trouvé' : 'enregistré'}.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.4fr_1fr_1.4fr_80px_120px_1fr] items-center gap-3 px-3 py-2 bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Nom</div><div>Téléphone</div><div>Zones</div><div>Actifs</div><div>Statut bot</div><div></div>
          </div>
          {filtered.map((l) => {
            const isBotActive = !!botActive?.has(l.id);
            return (
              <div key={l.id} className={`grid md:grid-cols-[1.4fr_1fr_1.4fr_80px_120px_1fr] grid-cols-1 gap-2 md:gap-3 px-3 py-3 border-t border-border text-sm items-center ${!l.is_active ? 'opacity-60' : ''}`}>
                <div className="font-medium">
                  {l.prenom} {l.nom}
                  {!l.is_active && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">inactif</span>}
                </div>
                <div className="text-muted-foreground font-mono text-xs">{l.telephone}</div>
                <div className="flex flex-wrap gap-1">
                  {(l.zone_couverte ?? []).map(z => (
                    <span key={z} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground">{z}</span>
                  ))}
                </div>
                <div className="text-center font-mono">{missions?.[l.id] ?? 0}</div>
                <div>
                  {isBotActive ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">✅ Actif</span>
                  ) : l.invitation_bot_sent_at ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-500">📤 Invité</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onboardLivreur(l)}
                    className="border-[#F5C518] text-[#F5C518] hover:bg-[#F5C518]/10 hover:text-[#F5C518]"
                  >
                    <Bot className="w-3.5 h-3.5 mr-1.5" />
                    {l.invitation_bot_sent_at ? 'Renvoyer' : 'Onboarder'}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(l)} className="h-8 w-8">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8"
                    onClick={async () => {
                      await setActive.mutateAsync({ id: l.id, active: !l.is_active });
                      toast.success(l.is_active ? 'Livreur désactivé' : 'Livreur réactivé');
                    }}
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>

      <LivreurDialog
        livreur={editing}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (!data.prenom || !data.nom || !data.telephone) {
            toast.error('Prénom, nom et téléphone obligatoires');
            return;
          }
          await upsert.mutateAsync(data);
          toast.success('Livreur enregistré');
          setEditing(null);
        }}
      />
    </div>
  );
}

const DAKAR_ZONES = ['Plateau', 'Médina', 'Liberté', 'HLM', 'Point E', 'Sacré-Cœur', 'Mermoz', 'Almadies', 'Ouakam', 'Yoff', 'Pikine', 'Guédiawaye', 'Thiaroye', 'Rufisque', 'Bargny'];

function LivreurDialog({ livreur, onClose, onSave }: {
  livreur: Partial<Livreur> | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Livreur>>({});

  useMemo(() => {
    if (livreur) setForm({ ...livreur, zone_couverte: livreur.zone_couverte ?? [] });
  }, [livreur]);

  if (!livreur) return null;

  const toggleZone = (z: string) => {
    const current = form.zone_couverte ?? [];
    setForm({
      ...form,
      zone_couverte: current.includes(z) ? current.filter(x => x !== z) : [...current, z],
    });
  };

  return (
    <Dialog open={!!livreur} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{livreur.id ? 'Modifier' : 'Nouveau'} livreur</DialogTitle>
          <DialogDescription>Coordonnées et zones desservies à Dakar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prénom</Label>
              <Input value={form.prenom ?? ''} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div>
              <Label>Nom</Label>
              <Input value={form.nom ?? ''} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Téléphone (avec indicatif)</Label>
            <Input value={form.telephone ?? ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+221 77 000 00 00" />
          </div>
          <div>
            <Label>Zones couvertes</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {DAKAR_ZONES.map(z => {
                const active = (form.zone_couverte ?? []).includes(z);
                return (
                  <button
                    type="button"
                    key={z}
                    onClick={() => toggleZone(z)}
                    className="text-xs px-2 py-1 rounded border transition-colors"
                    style={{
                      borderColor: active ? '#F5C518' : 'hsl(var(--border))',
                      background: active ? 'rgba(245,197,24,0.1)' : 'transparent',
                      color: active ? '#F5C518' : 'hsl(var(--foreground))',
                    }}
                  >
                    {z}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)} style={{ background: '#F5C518', color: '#0A0E1A' }}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

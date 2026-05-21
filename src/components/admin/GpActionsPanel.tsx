import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plane, Send, ListChecks, Bot, CheckCircle2, Loader2, History, MapPin, Copy, Search as SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transporteur } from '@/hooks/useTransporteurs';

type Action = 'depart' | 'missions' | 'message' | 'simulate' | 'history';

export function GpActionsPanel({
  gp, open, onClose,
}: { gp: Transporteur | null; open: boolean; onClose: () => void }) {
  const [action, setAction] = useState<Action | null>(null);

  if (!gp) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Actions GP — {gp.prenom ?? ''} {gp.nom}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ref {gp.reference} · {gp.telephone_1}
          </p>
        </SheetHeader>

        <div className="mt-5 space-y-2">
          <ActionButton icon={Plane} label="Enregistrer un depart pour ce GP" onClick={() => setAction('depart')} />
          <ActionButton icon={ListChecks} label="Voir les missions de ce GP" onClick={() => setAction('missions')} />
          <ActionButton icon={Send} label="Envoyer un message au GP" onClick={() => setAction('message')} />
          <ActionButton icon={Bot} label="Simuler une commande bot" onClick={() => setAction('simulate')} />
          <ActionButton icon={History} label="Historique conversations WhatsApp" onClick={() => setAction('history')} />
        </div>

        {action === 'depart' && <CreateDepartDialog gp={gp} onClose={() => setAction(null)} />}
        {action === 'missions' && <GpMissionsDialog gp={gp} onClose={() => setAction(null)} />}
        {action === 'message' && <SendMessageDialog gp={gp} onClose={() => setAction(null)} />}
        {action === 'simulate' && <SimulateBotDialog gp={gp} onClose={() => setAction(null)} />}
        {action === 'history' && <GpHistoryDialog gp={gp} onClose={() => setAction(null)} />}
      </SheetContent>
    </Sheet>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg border border-border hover:border-[#F5C518] hover:bg-[#F5C518]/5 transition-colors text-sm font-medium text-foreground"
    >
      <Icon className="w-4 h-4 text-[#F5C518]" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

// ----------------------------------------------------------------
// 1) Créer un départ pour ce GP
// ----------------------------------------------------------------
function CreateDepartDialog({ gp, onClose }: { gp: Transporteur; onClose: () => void }) {
  const qc = useQueryClient();
  const [origin, setOrigin] = useState('Paris');
  const [destination, setDestination] = useState('Dakar');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('25');
  const [mode, setMode] = useState<'air' | 'sea_lcl' | 'road'>('air');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!destination.trim() || !date || !capacity) {
      toast.error('Tous les champs obligatoires');
      return;
    }
    setSaving(true);
    try {
      const cap = Math.max(1, parseInt(capacity, 10));
      const { data: dep, error } = await supabase
        .from('manual_departures')
        .insert({
          transporteur_ref: gp.reference,
          origin_city: origin.trim(),
          destination_city: destination.trim(),
          departure_date: date,
          total_capacity_kg: cap,
          available_capacity_kg: cap,
          transport_mode: mode,
          status: 'active',
        } as any)
        .select('short_ref, departure_date, destination_city, total_capacity_kg')
        .single();
      if (error) throw error;

      // Notifier le GP par WhatsApp
      const dStr = new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: gp.telephone_1,
          recipient_type: 'gp',
          message: `Depart enregistre par l'equipe Yobbante.
Ref #${dep?.short_ref} - ${destination} - ${dStr} - ${cap}kg`,
          transporteur_id: gp.id,
          trigger_type: 'admin_create_departure',
        },
      });

      toast.success(`Depart Ref #${dep?.short_ref} cree`);
      qc.invalidateQueries({ queryKey: ['manual_departures'] });
      onClose();
    } catch (e) {
      toast.error('Echec creation', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un depart</DialogTitle>
          <DialogDescription>Pour {gp.prenom ?? ''} {gp.nom} (Ref {gp.reference})</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ville de depart</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: Dakar" />
          </div>
          <div>
            <Label>Date de depart</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Capacite (kg)</Label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full bg-background border border-border rounded-md px-2 py-2 text-sm text-foreground"
            >
              <option value="air">Aerien</option>
              <option value="sea_lcl">Maritime</option>
              <option value="road">Routier</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving} style={{ background: '#F5C518', color: '#000' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Creer + notifier GP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// 2) Missions du GP
// ----------------------------------------------------------------
function GpMissionsDialog({ gp, onClose }: { gp: Transporteur; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gp-missions', gp.reference],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, tracking_id, buyer_name, status, estimated_weight, actual_weight_kg, destination_country, destination_city, contact_phone')
        .eq('assigned_transporteur_ref', gp.reference)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function markStatus(id: string, status: 'COLLECTED' | 'DELIVERED') {
    try {
      const patch: any = { status };
      if (status === 'COLLECTED') patch.collected_at = new Date().toISOString();
      if (status === 'DELIVERED') patch.delivered_at = new Date().toISOString();
      const { error } = await supabase.from('dossiers').update(patch).eq('id', id);
      if (error) throw error;
      toast.success(status === 'COLLECTED' ? 'Marque collecte' : 'Marque livre');
      refetch();
      qc.invalidateQueries({ queryKey: ['gp-missions'] });
    } catch (e) {
      toast.error('Echec', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Missions de {gp.prenom ?? ''} {gp.nom}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center">Aucune mission</p>
          ) : (
            <div className="divide-y divide-border">
              {data.map((d: any) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{d.tracking_id ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.buyer_name ?? '—'} · {d.actual_weight_kg ?? d.estimated_weight ?? '?'}kg · {d.destination_city ?? d.destination_country ?? '—'}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                  <div className="flex gap-1">
                    {!['COLLECTED', 'WEIGHED', 'IN_TRANSIT', 'ARRIVED_HUB', 'DELIVERED'].includes(d.status) && (
                      <Button size="sm" variant="outline" onClick={() => markStatus(d.id, 'COLLECTED')}>Collecte</Button>
                    )}
                    {d.status !== 'DELIVERED' && (
                      <Button size="sm" variant="outline" onClick={() => markStatus(d.id, 'DELIVERED')}>Livre</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// 3) Envoyer un message libre
// ----------------------------------------------------------------
function SendMessageDialog({ gp, onClose }: { gp: Transporteur; onClose: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: gp.telephone_1,
          recipient_type: 'gp',
          message: text.trim(),
          transporteur_id: gp.id,
          trigger_type: 'admin_message',
        },
      });
      if (error) throw error;
      toast.success('Message envoye');
      onClose();
    } catch (e) {
      toast.error('Echec envoi', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer un message a {gp.prenom ?? ''} {gp.nom}</DialogTitle>
          <DialogDescription>Texte libre via le numero 122 (fenetre 24h requise).</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Votre message..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={send} disabled={sending || !text.trim()} style={{ background: '#F5C518', color: '#000' }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// 4) Simuler une commande bot
// ----------------------------------------------------------------
function SimulateBotDialog({ gp, onClose }: { gp: Transporteur; onClose: () => void }) {
  const [cmd, setCmd] = useState('AIDE');
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setResponse(null);
    try {
      const { error } = await supabase.functions.invoke('gp-bot', {
        body: {
          from_phone: gp.telephone_1,
          from_name: `${gp.prenom ?? ''} ${gp.nom}`,
          transporteur_id: gp.id,
          message: cmd,
        },
      });
      if (error) throw error;
      // Récupérer la dernière réponse du bot
      await new Promise((r) => setTimeout(r, 500));
      const { data } = await supabase
        .from('whatsapp_outbound_messages')
        .select('message_body, created_at')
        .eq('transporteur_id', gp.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setResponse(data?.message_body ?? '(aucune reponse)');
    } catch (e) {
      toast.error('Echec simulation', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simuler une commande bot</DialogTitle>
          <DialogDescription>Le bot envoie une vraie reponse WhatsApp au GP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Commande</Label>
            <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="AIDE, MES MISSIONS, DEP Paris 28/05 25kg..." />
          </div>
          {response !== null && (
            <div className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap text-foreground">
              <div className="text-[10px] font-bold text-muted-foreground mb-1">Reponse bot</div>
              {response}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={run} disabled={running || !cmd.trim()} style={{ background: '#F5C518', color: '#000' }}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bot className="w-4 h-4 mr-1" />}
            Executer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// GP HISTORY — All WhatsApp messages with this GP + saved addresses
// ============================================================================
function GpHistoryDialog({ gp, onClose }: { gp: Transporteur; onClose: () => void }) {
  const [q, setQ] = useState('');
  const phoneDigits = (gp.telephone_1 || '').replace(/\D/g, '');
  const phoneTail = phoneDigits.slice(-9);

  const { data: inbound = [], isLoading: loadingIn } = useQuery({
    queryKey: ['gp-history-in', gp.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_inbound_messages' as any)
        .select('id, from_phone, message_body, bot_intent, received_at, dossier_id')
        .or(`transporteur_id.eq.${gp.id},from_phone.ilike.%${phoneTail}`)
        .order('received_at', { ascending: false })
        .limit(500);
      return (data ?? []) as any[];
    },
  });

  const { data: outbound = [], isLoading: loadingOut } = useQuery({
    queryKey: ['gp-history-out', gp.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_outbound_messages' as any)
        .select('id, to_phone, message_body, template_name, status, created_at')
        .or(`transporteur_id.eq.${gp.id},to_phone.ilike.%${phoneTail}`)
        .order('created_at', { ascending: false })
        .limit(500);
      return (data ?? []) as any[];
    },
  });

  const { data: trData } = useQuery({
    queryKey: ['gp-addresses', gp.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('transporteurs' as any)
        .select('adresse_collecte_dakar, adresses_remise')
        .eq('id', gp.id)
        .maybeSingle();
      return data as unknown as { adresse_collecte_dakar: string | null; adresses_remise: Record<string, string> | null } | null;
    },
  });

  const merged = [
    ...inbound.map((m: any) => ({ kind: 'in' as const, id: m.id, body: m.message_body || `[${m.bot_intent ?? 'media'}]`, at: m.received_at })),
    ...outbound.map((m: any) => ({ kind: 'out' as const, id: m.id, body: m.message_body || `[template: ${m.template_name}]`, at: m.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const filtered = !q.trim() ? merged : merged.filter((m) => (m.body || '').toLowerCase().includes(q.trim().toLowerCase()));

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => toast.success('Copie'));
  };

  const addrCollecte = trData?.adresse_collecte_dakar ?? null;
  const addrRemise = (trData?.adresses_remise ?? {}) as Record<string, string>;
  const hasSaved = !!addrCollecte || Object.keys(addrRemise).length > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Historique conversations — {gp.prenom ?? ''} {gp.nom}</DialogTitle>
          <DialogDescription>Toutes les conversations WhatsApp et adresses sauvegardees</DialogDescription>
        </DialogHeader>

        {hasSaved && (
          <div className="rounded-lg border border-[#F5C518]/30 bg-[#F5C518]/5 p-3 space-y-2">
            <div className="text-xs font-bold text-[#F5C518] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Adresses sauvegardees
            </div>
            {addrCollecte && (
              <div className="flex items-start justify-between gap-2 text-xs">
                <div>
                  <div className="font-medium text-foreground">Collecte Dakar</div>
                  <div className="text-muted-foreground">{addrCollecte}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(addrCollecte)} className="h-7 px-2">
                  <Copy className="w-3 h-3 mr-1" /> Copier
                </Button>
              </div>
            )}
            {Object.entries(addrRemise).map(([city, addr]) => (
              <div key={city} className="flex items-start justify-between gap-2 text-xs">
                <div>
                  <div className="font-medium text-foreground">Remise {city}</div>
                  <div className="text-muted-foreground">{addr}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(addr)} className="h-7 px-2">
                  <Copy className="w-3 h-3 mr-1" /> Copier
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans les messages..." className="pl-8 h-9 text-xs" />
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1.5">
          {(loadingIn || loadingOut) ? (
            <div className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Aucun message</p>
          ) : (
            filtered.map((m) => (
              <div key={`${m.kind}-${m.id}`} className={cnHist(m.kind)}>
                <div className="flex items-center justify-between mb-0.5">
                  <Badge variant={m.kind === 'in' ? 'secondary' : 'default'} className="h-4 text-[9px]">
                    {m.kind === 'in' ? 'Recu' : 'Envoye'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(m.at).toLocaleString('fr-FR')}</span>
                </div>
                <div className="text-xs whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnHist(kind: 'in' | 'out') {
  return kind === 'in'
    ? 'rounded-lg border border-border bg-muted/30 p-2'
    : 'rounded-lg border border-[#F5C518]/30 bg-[#F5C518]/5 p-2';
}

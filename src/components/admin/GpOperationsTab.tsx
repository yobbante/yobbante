import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plane, Package, AlertTriangle, MessageSquareWarning, UserPlus, Bell, CheckCircle2, Loader2, Truck, Smartphone, Search, ExternalLink, Check, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { useTransporteurs } from '@/hooks/useTransporteurs';
import { useGpBotActive } from '@/hooks/useGpBotActive';
import { sendGpMessage } from '@/lib/sendGpMessage';
import { WeighingDialog, type WeighingDossier } from './WeighingDialog';
import { parseDepartureMessage } from '@/lib/parseDepartureMessage';
import { CreateGpFromContactDialog } from './CreateGpFromContactDialog';

const YOBBANTE_BOT_NUMBER = '+221781221891';

const SECTIONS = [
  { id: 'departures', label: 'Departs du jour', icon: Plane },
  { id: 'pending', label: 'Collectes en attente', icon: Package },
  { id: 'weighing', label: 'À peser', icon: Scale },
  { id: 'transit', label: 'Livraisons en cours', icon: Truck },
  { id: 'unknown_intent', label: 'Commandes non reconnues', icon: MessageSquareWarning },
  { id: 'unknown_contacts', label: 'Nouveaux contacts inconnus', icon: UserPlus },
  { id: 'onboarding', label: 'Onboarding GP', icon: Smartphone },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

export function GpOperationsTab() {
  const [section, setSection] = useState<SectionId>('departures');

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#F5C518]" />
          Operations GP
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Vue globale des operations transporteurs du jour</p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              section === id
                ? 'bg-[#F5C518] text-black'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {section === 'departures' && <DeparturesToday />}
      {section === 'pending' && <PendingCollects />}
      {section === 'weighing' && <WeighingQueue />}
      {section === 'transit' && <InTransit />}
      {section === 'unknown_intent' && <UnknownIntent />}
      {section === 'unknown_contacts' && <UnknownContacts />}
      {section === 'onboarding' && <OnboardingGp />}
    </div>
  );
}

// ---------------- Section : pesée ----------------
function WeighingQueue() {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<WeighingDossier | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gp-ops-weighing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, tracking_id, reference, buyer_name, contact_phone, estimated_weight, estimated_cost, destination_country, user_id, collected_at')
        .eq('status', 'COLLECTED')
        .order('collected_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <Empty label="Aucun colis à peser" />;

  return (
    <>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.id} className="border border-border rounded-lg p-3 bg-card flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{d.tracking_id || d.reference}</div>
              <div className="text-xs text-muted-foreground">
                {d.buyer_name} · est. {d.estimated_weight ?? '—'}kg → {d.destination_country}
              </div>
            </div>
            <Button size="sm" onClick={() => setPicked(d as WeighingDossier)} className="bg-[#F5C518] text-black hover:bg-[#e4b614]">
              <Scale className="w-3.5 h-3.5 mr-1" /> Peser
            </Button>
          </div>
        ))}
      </div>
      <WeighingDialog
        dossier={picked}
        open={!!picked}
        onClose={() => setPicked(null)}
        onDone={() => { refetch(); qc.invalidateQueries({ queryKey: ['gp-ops-in-transit'] }); }}
      />
    </>
  );
}

// ---------------- Section 6 : onboarding GP ----------------
function buildInviteMessage(prenom: string) {
  return `Salam ${prenom},

J'ai mis en place un nouveau systeme pour gerer nos colis plus facilement.

Enregistre ce numero : ${YOBBANTE_BOT_NUMBER}
Nom : Yobbante GP

Envoie-lui AIDE pour voir comment ca marche.

Pour nos echanges habituels je reste disponible sur ce numero.`;
}

function OnboardingGp() {
  const { list } = useTransporteurs();
  const { data: botActive } = useGpBotActive();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sentLocal, setSentLocal] = useState<Record<string, string>>({});

  const all = list.data ?? [];
  const activeGps = all.filter((t) => t.actif);
  const onboardedCount = activeGps.filter((t) => botActive?.has(t.id)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeGps
      .filter((t) => !botActive?.has(t.id))
      .filter((t) => !q || `${t.prenom ?? ''} ${t.nom} ${t.telephone_1}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const aSent = !!(sentLocal[a.id] || a.invitation_bot_sent_at);
        const bSent = !!(sentLocal[b.id] || b.invitation_bot_sent_at);
        if (aSent !== bSent) return aSent ? 1 : -1;
        return a.nom.localeCompare(b.nom);
      });
  }, [activeGps, botActive, search, sentLocal]);

  async function markSent(id: string) {
    const now = new Date().toISOString();
    setSentLocal((p) => ({ ...p, [id]: now }));
    await supabase.from('transporteurs' as any).update({ invitation_bot_sent_at: now }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['transporteurs'] });
  }

  async function openWa(t: any) {
    const prenom = (t.prenom?.trim() || t.nom.split(' ')[0] || 'cher partenaire');
    const res = await sendGpMessage({
      phone: t.telephone_1,
      message: buildInviteMessage(prenom),
      transporteur_id: t.id,
      trigger_type: 'admin_onboard_bot',
    });
    if (res.ok) toast.success('Invitation envoyée');
    markSent(t.id);
  }

  if (list.isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-semibold text-foreground">
          <span className="text-[#F5C518]">{onboardedCount}</span> GP onboardés / {activeGps.length} GP actifs
        </div>
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher GP..." className="pl-8 h-8 text-xs" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty label="Tous les GP actifs sont déjà onboardés 🎉" />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const sentAt = sentLocal[t.id] || t.invitation_bot_sent_at;
            const hasReplied = botActive?.has(t.id);
            return (
              <div key={t.id} className="border border-border rounded-lg p-3 bg-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {(t.prenom ? `${t.prenom} ` : '') + t.nom}
                    <span className="ml-2 text-[10px] text-muted-foreground font-mono">{t.reference}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{t.telephone_1}</span>
                    {t.ville && <span>· {t.ville}</span>}
                    {hasReplied && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] h-4">✅ A répondu</Badge>}
                    {sentAt && !hasReplied && (
                      <Badge variant="secondary" className="text-[9px] h-4">
                        📤 Invité {new Date(sentAt).toLocaleDateString('fr-FR')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openWa(t)} className="text-xs">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ouvrir WhatsApp
                  </Button>
                  {!sentAt && (
                    <Button size="sm" variant="ghost" onClick={() => markSent(t.id)} className="text-xs">
                      <Check className="w-3.5 h-3.5 mr-1" /> Marquer invité
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------- Section 1 : départs du jour ----------------
function DeparturesToday() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gp-ops-departures-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_departures')
        .select('id, short_ref, transporteur_ref, destination_city, departure_date, total_capacity_kg, available_capacity_kg, status')
        .eq('departure_date', today)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function notify(ref: string, phone?: string | null) {
    if (!phone) { toast.error('Pas de telephone GP'); return; }
    const res = await sendGpMessage({
      phone,
      message: `📦 Rappel : votre depart ${ref} est aujourd'hui. Bonne route !`,
      trigger_type: 'admin_remind_departure',
    });
    if (res.ok) toast.success('GP notifie');
  }

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <Empty label="Aucun depart programme aujourd'hui" />;

  return (
    <div className="space-y-2">
      {data.map((d: any) => {
        const used = (d.total_capacity_kg ?? 0) - (d.available_capacity_kg ?? 0);
        return (
          <div key={d.id} className="border border-border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-semibold">#{d.short_ref}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  GP {d.transporteur_ref ?? '—'} · {d.destination_city ?? '—'} · {used}/{d.total_capacity_kg}kg
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={async () => {
                const { data: gp } = await supabase.from('transporteurs').select('telephone_1').eq('reference', d.transporteur_ref).maybeSingle();
                notify(d.short_ref, gp?.telephone_1);
              }}>
                <Bell className="w-3.5 h-3.5 mr-1" /> Notifier
              </Button>
              <Button size="sm" variant="outline" onClick={async () => {
                await supabase.from('manual_departures').update({ status: 'full' }).eq('id', d.id);
                toast.success('Marque comme parti');
                refetch();
              }}>
                Marquer parti
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Section 2 : collectes en attente ----------------
function PendingCollects() {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gp-ops-pending-collects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, tracking_id, buyer_name, assigned_transporteur_ref, updated_at, contact_phone')
        .eq('status', 'ASSIGNED')
        .lt('updated_at', yesterday)
        .order('updated_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function relancer(ref: string | null, tracking: string) {
    if (!ref) return;
    const { data: gp } = await supabase.from('transporteurs').select('telephone_1, id').eq('reference', ref).maybeSingle();
    if (!gp?.telephone_1) { toast.error('Pas de telephone'); return; }
    const res = await sendGpMessage({
      phone: gp.telephone_1,
      message: `Rappel : merci de confirmer la collecte du colis ${tracking}. Envoyez : COLLECTE ${tracking}`,
      transporteur_id: gp.id,
      trigger_type: 'admin_remind_collect',
    });
    if (res.ok) toast.success('GP relance');
  }

  async function markCollected(id: string) {
    await supabase.from('dossiers').update({ status: 'COLLECTED', collected_at: new Date().toISOString() }).eq('id', id);
    toast.success('Marque collecte');
    refetch();
  }

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <Empty label="Aucune collecte en attente" />;

  return (
    <div className="space-y-2">
      {data.map((d: any) => (
        <div key={d.id} className="border border-border rounded-lg p-3 bg-card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{d.tracking_id}</div>
              <div className="text-xs text-muted-foreground">{d.buyer_name} · GP {d.assigned_transporteur_ref}</div>
            </div>
            <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> &gt;24h</Badge>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => relancer(d.assigned_transporteur_ref, d.tracking_id)}>
              <Bell className="w-3.5 h-3.5 mr-1" /> Relancer GP
            </Button>
            <Button size="sm" variant="outline" onClick={() => markCollected(d.id)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Collecte manuelle
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Section 3 : livraisons en cours ----------------
function InTransit() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({
    queryKey: ['gp-ops-in-transit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, tracking_id, buyer_name, assigned_transporteur_ref, destination_city, destination_country, estimated_delivery_date')
        .eq('status', 'IN_TRANSIT')
        .lt('estimated_delivery_date', today)
        .order('estimated_delivery_date', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function contactGp(ref: string | null, tracking: string) {
    if (!ref) return;
    const { data: gp } = await supabase.from('transporteurs').select('telephone_1, id').eq('reference', ref).maybeSingle();
    if (!gp?.telephone_1) { toast.error('Pas de telephone'); return; }
    const res = await sendGpMessage({
      phone: gp.telephone_1,
      message: `Bonjour, ou en est la livraison de ${tracking} ? La date prevue est depassee.`,
      transporteur_id: gp.id,
      trigger_type: 'admin_late_delivery',
    });
    if (res.ok) toast.success('GP contacte');
  }

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <Empty label="Aucune livraison en retard" />;

  return (
    <div className="space-y-2">
      {data.map((d: any) => (
        <div key={d.id} className="border border-amber-500/40 rounded-lg p-3 bg-amber-500/5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{d.tracking_id} → {d.destination_city ?? d.destination_country}</div>
              <div className="text-xs text-amber-500/80 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                ETA depassee ({d.estimated_delivery_date})
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => contactGp(d.assigned_transporteur_ref, d.tracking_id)}>
              <Bell className="w-3.5 h-3.5 mr-1" /> Contacter GP
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Section 4 : commandes bot non reconnues ----------------
function UnknownIntent() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gp-ops-unknown-intent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_inbound_messages')
        .select('id, from_phone, from_name, message_body, received_at, is_read, transporteur_id')
        .eq('channel', 'gp')
        .eq('bot_intent', 'unknown')
        .eq('is_read', false)
        .order('received_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function markHandled(id: string) {
    await supabase.from('whatsapp_inbound_messages').update({ is_read: true, replied_at: new Date().toISOString() }).eq('id', id);
    toast.success('Traite');
    refetch();
  }

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <Empty label="Aucune commande non reconnue" />;

  return (
    <div className="space-y-2">
      {data.map((m: any) => (
        <div key={m.id} className="border border-border rounded-lg p-3 bg-card">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-medium">{m.from_name ?? m.from_phone}</div>
            <span className="text-[10px] text-muted-foreground">{new Date(m.received_at).toLocaleString('fr-FR')}</span>
          </div>
          <div className="text-sm bg-muted/50 rounded px-2 py-1.5 mt-1 italic">"{m.message_body}"</div>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => markHandled(m.id)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marquer traite
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Section 5 : contacts inconnus ----------------
function UnknownContacts() {
  const [picked, setPicked] = useState<{ contact: any; parsed: any } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gp-ops-unknown-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gp_unknown_contacts' as any)
        .select('*')
        .eq('followed_up', false)
        .order('contacted_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function markHandled(id: string) {
    await supabase.from('gp_unknown_contacts' as any).update({
      followed_up: true,
      followed_up_at: new Date().toISOString(),
    }).eq('id', id);
    toast.success('Marqué traité');
    refetch();
  }

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <Empty label="Aucun nouveau contact" />;

  return (
    <>
      <div className="space-y-2">
        {data.map((c: any) => {
          const parsed = parseDepartureMessage(c.message);
          const isDeparture = !!parsed;
          return (
            <div
              key={c.id}
              className={`border rounded-lg p-3 ${
                isDeparture
                  ? 'border-[#F5C518]/60 bg-[#F5C518]/5'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  {isDeparture && (
                    <div className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Plane className="w-3.5 h-3.5" /> Départ potentiel détecté
                    </div>
                  )}
                  <div className="text-sm font-medium">{c.from_name ?? c.phone}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.phone} · {new Date(c.contacted_at).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>

              {c.message && (
                <div className="text-sm bg-muted/50 rounded px-2 py-1.5 mt-2 italic">"{c.message}"</div>
              )}

              {isDeparture && (
                <div className="text-xs text-muted-foreground mt-2">
                  Détecté :{' '}
                  {parsed.origin?.city && <span>de <b>{parsed.origin.city}</b> </span>}
                  {parsed.destination?.city && <span>vers <b>{parsed.destination.city}</b> </span>}
                  {parsed.departureDate && (
                    <span>· le <b>{new Date(parsed.departureDate).toLocaleDateString('fr-FR')}</b></span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-2">
                {isDeparture && (
                  <Button
                    size="sm"
                    className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
                    onClick={() => setPicked({ contact: c, parsed })}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Ajouter ce GP + Créer le départ
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => markHandled(c.id)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {isDeparture ? 'Ignorer' : 'Marquer traité'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {picked && (
        <CreateGpFromContactDialog
          open={!!picked}
          onOpenChange={(o) => { if (!o) setPicked(null); }}
          contact={picked.contact}
          parsed={picked.parsed}
          onDone={() => { setPicked(null); refetch(); }}
        />
      )}
    </>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-12 text-sm text-muted-foreground">{label}</div>;
}

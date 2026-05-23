import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Search, Send, CheckCheck, User, Truck, Package, Loader2, ExternalLink, MapPin, PauseCircle, Link2, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WA_TEMPLATES_CLIENT, getTemplate, type WaTemplateKey } from '@/lib/whatsappTemplates';
import { LinkDossierDialog, type LinkableDossier } from './messages/LinkDossierDialog';
import { AudioMessage } from './messages/AudioMessage';

interface LinkedDossier {
  id: string;
  reference: string | null;
  tracking_id: string | null;
  status: string;
  origin_country: string | null;
  destination_country: string | null;
  estimated_weight: number | null;
  assigned_transporteur_ref: string | null;
  estimated_delivery_date: string | null;
  buyer_name: string | null;
  contact_phone: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_address: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  final_amount_xof: number | null;
}

const DOSSIER_SELECT = 'id, reference, tracking_id, status, origin_country, destination_country, estimated_weight, assigned_transporteur_ref, estimated_delivery_date, buyer_name, contact_phone, sender_name, sender_phone, sender_address, recipient_name, recipient_phone, recipient_address, final_amount_xof';

interface GpTemplate {
  key: string;
  label: string;
  build: (ctx: GpCtx) => string;
}

interface GpCtx {
  gp_prenom: string;
  client_name: string;
  tracking_id: string;
  route: string;
  origin: string;
  destination: string;
  poids: string;
  pickup_address: string;
  date: string;
  departure_date: string;
}

/** Templates GP contextuels (utilisés quand un dossier est lié). */
function gpTemplatesForDossier(): GpTemplate[] {
  return [
    { key: 'recap', label: '📋 Récap mission', build: (c) =>
      `Salam ${c.gp_prenom},\n\nRecap dossier ${c.tracking_id} :\nRoute : ${c.origin} → ${c.destination}\nClient : ${c.client_name}\nPoids : ${c.poids}kg\nAdresse collecte : ${c.pickup_address}`,
    },
    { key: 'collecte', label: '🔵 Confirmer collecte', build: (c) =>
      `Salam ${c.gp_prenom}, avez-vous collecte le colis ${c.tracking_id} chez ${c.client_name} ?\n\nConfirmez en repondant : COLLECTE ${c.tracking_id}`,
    },
    { key: 'poids', label: '🟡 Enregistrer poids', build: (c) =>
      `Salam ${c.gp_prenom}, pensez a enregistrer le poids reel du colis ${c.tracking_id}.\n\nFormat : POIDS ${c.tracking_id} [poids]kg`,
    },
    { key: 'livre', label: '✅ Confirmer livraison', build: (c) =>
      `Salam ${c.gp_prenom}, le colis ${c.tracking_id} est-il livre a ${c.destination} ?\n\nConfirmez en repondant : LIVRE ${c.tracking_id}`,
    },
  ];
}

/** Fallback générique quand aucun dossier n'est lié. */
function gpTemplatesGeneric(): GpTemplate[] {
  return [
    { key: 'hello', label: 'Salutation', build: (c) => `Salam ${c.gp_prenom}, comment tu vas ?` },
    { key: 'cap', label: 'Demander capacite', build: (c) => `Salam ${c.gp_prenom}, j'ai un colis a envoyer. Tu as de la place sur ton prochain depart ?` },
    { key: 'next', label: 'Prochain depart', build: (c) => `Quand est ton prochain depart ?` },
  ];
}

type Channel = 'client' | 'gp';

interface InboundMsg {
  id: string;
  from_phone: string;
  from_name: string | null;
  to_number: string | null;
  message_body: string | null;
  message_type: string;
  media_url: string | null;
  channel: Channel;
  dossier_id: string | null;
  transporteur_id: string | null;
  bot_intent: string | null;
  bot_response: string | null;
  is_read: boolean;
  received_at: string;
  replied_at: string | null;
}
interface OutboundMsg {
  id: string;
  to_phone: string;
  template_name: string | null;
  message_body: string | null;
  status: string;
  created_at: string;
}

interface ConversationGroup {
  phone: string;
  name: string | null;
  channel: Channel;
  lastAt: string;
  lastBody: string;
  unread: number;
  dossier_id: string | null;
}

function initials(name: string | null | undefined, phone: string) {
  const src = (name || phone || '').trim();
  if (!src) return '??';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(-2).toUpperCase();
}

function colorForPhone(phone: string) {
  const hash = Array.from(phone).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [217, 35, 152, 280, 12, 198];
  return `hsl(${hues[hash % hues.length]} 70% 45%)`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function MessagesTab() {
  const [searchParams] = useSearchParams();
  const [inbound, setInbound] = useState<InboundMsg[]>([]);
  const [outbound, setOutbound] = useState<OutboundMsg[]>([]);
  const [tab, setTab] = useState<'all' | 'client' | 'gp'>('all');
  const [search, setSearch] = useState('');
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateKey, setTemplateKey] = useState<WaTemplateKey>('PACKAGE_COLLECTED');
  const [params, setParams] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [gpMode, setGpMode] = useState<'libre' | 'templates'>('libre');
  const [gpText, setGpText] = useState('');
  const [linkedDossier, setLinkedDossier] = useState<LinkedDossier | null>(null);
  const [availableDossiers, setAvailableDossiers] = useState<LinkableDossier[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [transporteurInfo, setTransporteurInfo] = useState<{ id: string; reference: string; prenom: string | null; nom: string; ville: string; adresse_collecte_dakar: string | null; adresses_remise: Record<string, string>; bot_paused_until: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pauseTimerRef = useRef<number | null>(null);

  // ---------- Initial load + realtime subscriptions ----------
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [{ data: inData }, { data: outData }] = await Promise.all([
        supabase.from('whatsapp_inbound_messages').select('*').order('received_at', { ascending: false }).limit(500),
        supabase.from('whatsapp_outbound_messages').select('*').order('created_at', { ascending: false }).limit(500),
      ]);
      if (!mounted) return;
      setInbound((inData ?? []) as InboundMsg[]);
      setOutbound((outData ?? []) as OutboundMsg[]);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel('admin-wa-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_inbound_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as InboundMsg;
          setInbound((prev) => [row, ...prev]);
          toast(`Nouveau message de ${row.from_name || row.from_phone}`, {
            description: (row.message_body || '').slice(0, 60),
            action: { label: 'Ouvrir', onClick: () => setOpenPhone(row.from_phone) },
          });
        } else if (payload.eventType === 'UPDATE') {
          setInbound((prev) => prev.map((m) => (m.id === (payload.new as InboundMsg).id ? (payload.new as InboundMsg) : m)));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_outbound_messages' }, (payload) => {
        setOutbound((prev) => [payload.new as OutboundMsg, ...prev]);
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  // ---------- Deep-link: ?gp=<transporteur_id> opens that GP conversation ----------
  useEffect(() => {
    const gpId = searchParams.get('gp');
    if (!gpId || inbound.length === 0) return;
    const msg = inbound.find((m) => m.transporteur_id === gpId);
    if (msg) setOpenPhone(msg.from_phone);
  }, [searchParams, inbound]);


  // ---------- Group inbound by phone ----------
  const conversations: ConversationGroup[] = useMemo(() => {
    const map = new Map<string, ConversationGroup>();
    for (const m of inbound) {
      const existing = map.get(m.from_phone);
      if (!existing) {
        map.set(m.from_phone, {
          phone: m.from_phone,
          name: m.from_name,
          channel: m.channel,
          lastAt: m.received_at,
          lastBody: m.message_body || m.bot_intent || '(média)',
          unread: m.is_read ? 0 : 1,
          dossier_id: m.dossier_id,
        });
      } else {
        if (!existing.name && m.from_name) existing.name = m.from_name;
        if (m.received_at > existing.lastAt) {
          existing.lastAt = m.received_at;
          existing.lastBody = m.message_body || m.bot_intent || '(média)';
        }
        if (!m.is_read) existing.unread += 1;
        if (!existing.dossier_id && m.dossier_id) existing.dossier_id = m.dossier_id;
      }
    }
    return Array.from(map.values())
      .filter((c) => (tab === 'all' ? true : c.channel === tab))
      .filter((c) =>
        !search ? true :
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      )
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [inbound, tab, search]);

  const unreadTotal = conversations.reduce((s, c) => s + c.unread, 0);

  const activeConv = openPhone ? conversations.find((c) => c.phone === openPhone) : null;

  // Threaded messages for active conversation (in + out interleaved by time)
  const thread = useMemo(() => {
    if (!openPhone) return [];
    const inMsgs = inbound.filter((m) => m.from_phone === openPhone).map((m) => ({
      kind: 'in' as const, id: m.id, body: m.message_body || `🤖 ${m.bot_intent || ''}`, at: m.received_at, m,
    }));
    const outMsgs = outbound
      .filter((m) => m.to_phone.replace(/\D/g, '').endsWith(openPhone.replace(/\D/g, '').slice(-9)))
      .map((m) => ({ kind: 'out' as const, id: m.id, body: m.message_body || `📋 ${m.template_name || ''}`, at: m.created_at, m }));
    return [...inMsgs, ...outMsgs].sort((a, b) => a.at.localeCompare(b.at));
  }, [openPhone, inbound, outbound]);

  // Mark unread inbound as read when opening
  useEffect(() => {
    if (!openPhone) return;
    const unreadIds = inbound.filter((m) => m.from_phone === openPhone && !m.is_read).map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase.from('whatsapp_inbound_messages').update({ is_read: true }).in('id', unreadIds).then(() => {
      setInbound((prev) => prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m)));
    });
  }, [openPhone]); // eslint-disable-line

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, openPhone]);

  // ---------- Send template ----------
  const tpl = getTemplate(templateKey);
  const previewBody = `[${tpl.label}]\n${tpl.params.map((p) => `${p}: ${params[p] || '—'}`).join('\n')}`;

  async function handleSend() {
    if (!openPhone) return;
    setSending(true);
    try {
      const orderedParams = tpl.params.map((p) => params[p] || '');
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: openPhone,
          recipient_type: 'client',
          template_name: tpl.name,
          template_params: orderedParams,
          trigger_type: 'admin_manual',
        },
      });
      if (error) throw error;
      toast.success('Message envoyé');
      setParams({});
    } catch (e) {
      toast.error('Échec envoi', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  async function handleMarkHandled() {
    if (!openPhone) return;
    const ids = inbound.filter((m) => m.from_phone === openPhone).map((m) => m.id);
    await supabase.from('whatsapp_inbound_messages').update({ is_read: true, replied_at: new Date().toISOString() }).in('id', ids);
    setInbound((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m)));
    toast.success('Conversation marquée comme traitée');
  }

  // ---------- Persist a dossier link for the whole conversation ----------
  const linkDossierToConv = useCallback(async (d: LinkableDossier | LinkedDossier) => {
    if (!openPhone) return;
    try {
      await supabase
        .from('whatsapp_inbound_messages')
        .update({ dossier_id: d.id })
        .eq('from_phone', openPhone);
      setInbound((prev) => prev.map((m) => (m.from_phone === openPhone ? { ...m, dossier_id: d.id } : m)));
      // Re-fetch full dossier for templates
      const { data: full } = await supabase
        .from('dossiers')
        .select(DOSSIER_SELECT)
        .eq('id', d.id)
        .maybeSingle();
      if (full) setLinkedDossier(full as unknown as LinkedDossier);
      toast.success(`Dossier ${(d as any).tracking_id || (d as any).reference || ''} lié`);
    } catch (e) {
      toast.error('Echec liaison', { description: e instanceof Error ? e.message : String(e) });
    }
  }, [openPhone]);

  // ---------- Load linked dossier + transporteur for active conversation ----------
  useEffect(() => {
    setLinkedDossier(null);
    setAvailableDossiers([]);
    setTransporteurInfo(null);
    setGpText('');
    if (!openPhone) return;
    const conv = inbound.find((m) => m.from_phone === openPhone);
    if (!conv) return;

    (async () => {
      // 1) Dossier déjà lié sur l'inbound
      if (conv.dossier_id) {
        const { data } = await supabase
          .from('dossiers')
          .select(DOSSIER_SELECT)
          .eq('id', conv.dossier_id)
          .maybeSingle();
        if (data) setLinkedDossier(data as unknown as LinkedDossier);
      }

      // 2) GP : résoudre transporteur par id OU par téléphone
      if (conv.channel === 'gp') {
        let trData: any = null;
        if (conv.transporteur_id) {
          const { data } = await supabase
            .from('transporteurs' as any)
            .select('id, reference, prenom, nom, ville, adresse_collecte_dakar, adresses_remise, bot_paused_until')
            .eq('id', conv.transporteur_id)
            .maybeSingle();
          trData = data;
        }
        if (!trData) {
          const tail = openPhone.replace(/\D/g, '').slice(-9);
          const { data } = await supabase
            .from('transporteurs' as any)
            .select('id, reference, prenom, nom, ville, adresse_collecte_dakar, adresses_remise, bot_paused_until')
            .or(`telephone_1.ilike.%${tail}%,telephone_2.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
            .limit(1)
            .maybeSingle();
          trData = data;
        }
        if (trData) {
          setTransporteurInfo({
            ...trData,
            adresses_remise: (trData.adresses_remise ?? {}) as Record<string, string>,
          });

          // 3) Dossiers actifs assignés à ce GP
          const { data: dList } = await supabase
            .from('dossiers')
            .select(DOSSIER_SELECT)
            .eq('assigned_transporteur_ref', trData.reference)
            .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')
            .order('created_at', { ascending: false })
            .limit(20);
          const list = (dList ?? []) as unknown as LinkableDossier[];
          setAvailableDossiers(list);

          // 4) Auto-link si exactement 1 et rien encore lié
          if (!conv.dossier_id && list.length === 1) {
            await linkDossierToConv(list[0]);
          }
        }
      }

      // 5) Client : si non lié, chercher dossier par téléphone
      if (conv.channel === 'client' && !conv.dossier_id) {
        const tail = openPhone.replace(/\D/g, '').slice(-9);
        const { data: dList } = await supabase
          .from('dossiers')
          .select(DOSSIER_SELECT)
          .or(`contact_phone.ilike.%${tail}%,sender_phone.ilike.%${tail}%,recipient_phone.ilike.%${tail}%,buyer_contact.ilike.%${tail}%`)
          .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')
          .order('created_at', { ascending: false })
          .limit(10);
        const list = (dList ?? []) as unknown as LinkableDossier[];
        setAvailableDossiers(list);
        if (list.length === 1) await linkDossierToConv(list[0]);
      }
    })();
  }, [openPhone, inbound, linkDossierToConv]);

  // ---------- Pause/resume GP bot ----------
  const pauseBot = useCallback(async (minutes = 5) => {
    if (!transporteurInfo) return;
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    await supabase.from('transporteurs' as any).update({ bot_paused_until: until }).eq('id', transporteurInfo.id);
    setTransporteurInfo((prev) => prev ? { ...prev, bot_paused_until: until } : prev);
  }, [transporteurInfo]);

  const onGpTyping = (v: string) => {
    setGpText(v);
    if (pauseTimerRef.current) window.clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = window.setTimeout(() => { pauseBot(5); }, 400);
  };

  const resumeBot = async () => {
    if (!transporteurInfo) return;
    await supabase.from('transporteurs' as any).update({ bot_paused_until: null }).eq('id', transporteurInfo.id);
    setTransporteurInfo((prev) => prev ? { ...prev, bot_paused_until: null } : prev);
    toast.success('Bot GP reactive');
  };

  async function sendGpFree(text: string) {
    if (!openPhone || !text.trim()) return;
    setSending(true);
    try {
      await pauseBot(5);
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { recipient_phone: openPhone, recipient_type: 'gp', message: text, trigger_type: 'admin_free_text', transporteur_id: transporteurInfo?.id ?? null },
      });
      if (error) throw error;
      toast.success('Message envoye au GP');
      setGpText('');
    } catch (e) {
      toast.error('Echec envoi', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  const gpCtx = useMemo(() => {
    const prenom = transporteurInfo?.prenom || activeConv?.name?.split(' ')[0] || 'GP';
    const dest = linkedDossier?.destination_country || 'destination';
    const orig = linkedDossier?.origin_country || 'origine';
    return {
      gp_prenom: prenom,
      route: `${orig} - ${dest}`,
      poids: linkedDossier?.estimated_weight ? String(linkedDossier.estimated_weight) : '?',
      destination: dest,
      tracking_id: linkedDossier?.tracking_id || linkedDossier?.reference || '',
      date: linkedDossier?.estimated_delivery_date || 'bientot',
      departure_date: linkedDossier?.estimated_delivery_date || 'bientot',
    };
  }, [transporteurInfo, linkedDossier, activeConv]);

  async function saveAddress(kind: 'collecte' | 'remise', value: string, city?: string) {
    if (!transporteurInfo) {
      toast.error('Transporteur introuvable');
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      if (kind === 'collecte') {
        await supabase.from('transporteurs' as any).update({ adresse_collecte_dakar: trimmed }).eq('id', transporteurInfo.id);
        setTransporteurInfo((prev) => prev ? { ...prev, adresse_collecte_dakar: trimmed } : prev);
        toast.success('Adresse de collecte Dakar sauvegardee');
      } else {
        const c = (city || linkedDossier?.destination_country || 'Autre').trim();
        const next = { ...(transporteurInfo.adresses_remise ?? {}), [c]: trimmed };
        await supabase.from('transporteurs' as any).update({ adresses_remise: next }).eq('id', transporteurInfo.id);
        setTransporteurInfo((prev) => prev ? { ...prev, adresses_remise: next } : prev);
        toast.success(`Adresse remise ${c} sauvegardee`);
      }
    } catch (e) {
      toast.error('Echec sauvegarde', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  const botPaused = !!(transporteurInfo?.bot_paused_until && new Date(transporteurInfo.bot_paused_until) > new Date());

  function intentPill(intent: string | null) {
    if (!intent) return null;
    const i = intent.toLowerCase();
    const map: Array<{ test: (s: string) => boolean; label: string; cls: string }> = [
      { test: (s) => s.startsWith('dep'), label: '🟢 Départ enregistré', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
      { test: (s) => s.startsWith('collecte'), label: '🔵 Collecte confirmée', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
      { test: (s) => s.startsWith('poids'), label: '🟡 Poids enregistré', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
      { test: (s) => s.startsWith('livre'), label: '✅ Livraison confirmée', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
      { test: (s) => s === 'unknown', label: '❓ Non compris', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
      { test: (s) => s.startsWith('mes_') || s === 'help' || s === 'start' || s === 'cancel', label: '⚙️ Commande bot', cls: 'bg-muted text-muted-foreground border-border' },
      { test: (s) => s.startsWith('address'), label: '📍 Adresse', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    ];
    const m = map.find((x) => x.test(i));
    if (!m) return <span className="text-[9px] px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">🤖 {intent}</span>;
    return <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-semibold', m.cls)}>{m.label}</span>;
  }

  async function takeOver() {
    if (!transporteurInfo) return;
    const until = new Date(Date.now() + 60 * 60_000).toISOString();
    await supabase.from('transporteurs' as any).update({ bot_paused_until: until }).eq('id', transporteurInfo.id);
    setTransporteurInfo((prev) => prev ? { ...prev, bot_paused_until: until } : prev);
    toast.success('Bot en pause pour 1 heure');
  }

  // ---------- Render ----------
  return (
    <div className="flex flex-col h-full min-h-[500px] w-full">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card/30">
        <div>
          <h1 className="text-base font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Messages WhatsApp
            {unreadTotal > 0 && (
              <span className="text-[10px] bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                {unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Clients : 607 · GP : 122</p>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 bg-card overflow-hidden">
        {/* ===== LEFT — conversations ===== */}
        <aside className={cn('w-full md:w-[320px] flex-shrink-0 border-r border-border flex flex-col', openPhone && 'hidden md:flex')}>

          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-8 h-8 text-xs" />
            </div>
            <div className="flex gap-1">
              {(['all', 'client', 'gp'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition-colors',
                    tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'all' ? 'Tous' : t === 'client' ? 'Clients' : 'GP'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Aucune conversation</div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => setOpenPhone(c.phone)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors',
                    openPhone === c.phone && 'bg-muted'
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: colorForPhone(c.phone) }}
                  >
                    {initials(c.name, c.phone)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                        {c.name || c.phone}
                        {c.channel === 'gp' && <Truck className="w-3 h-3 text-emerald-500" />}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(c.lastAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">{c.lastBody.slice(0, 50)}</span>
                      {c.unread > 0 && (
                        <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ===== RIGHT — conversation ===== */}
        <section className={cn('flex-1 flex flex-col min-w-0', !openPhone && 'hidden md:flex')}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <MessageSquare className="w-12 h-12 opacity-30 mb-3" />
              <p className="text-sm">Sélectionnez une conversation</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setOpenPhone(null)} className="md:hidden text-muted-foreground text-sm">←</button>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: colorForPhone(activeConv.phone) }}
                  >
                    {initials(activeConv.name, activeConv.phone)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                      {activeConv.name || activeConv.phone}
                      <Badge variant={activeConv.channel === 'gp' ? 'default' : 'secondary'} className={cn('h-4 text-[9px]', activeConv.channel === 'gp' && 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30')}>
                        {activeConv.channel === 'gp' ? (<><Truck className="w-2.5 h-2.5 mr-0.5" />Transporteur</>) : (<><User className="w-2.5 h-2.5 mr-0.5" />Client</>)}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{activeConv.phone}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleMarkHandled} className="text-xs">
                  <CheckCheck className="w-3.5 h-3.5 mr-1" /> Traité
                </Button>
              </header>

              {/* Linked dossier mini-card */}
              {activeConv.dossier_id && (
                <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Package className="w-3.5 h-3.5" /> Dossier lié
                  </span>
                  <a href={`/admin/orders?dossier=${activeConv.dossier_id}`} className="text-primary hover:underline flex items-center gap-1">
                    Voir <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Thread */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/50">
                {thread.map((t) => {
                  const isAudio = t.kind === 'in' && (t.m as InboundMsg).message_type === 'audio' && (t.m as InboundMsg).media_url;
                  return (
                  <div key={`${t.kind}-${t.id}`} className={cn('flex flex-col', t.kind === 'out' ? 'items-end' : 'items-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap break-words shadow-sm',
                        t.kind === 'in'
                          ? 'bg-muted text-foreground rounded-bl-sm'
                          : 'text-black rounded-br-sm'
                      )}
                      style={t.kind === 'out' ? { background: '#F5C518' } : undefined}
                    >
                      {isAudio ? (
                        <audio
                          controls
                          preload="metadata"
                          src={(t.m as InboundMsg).media_url!}
                          className="w-[240px] max-w-full"
                        />
                      ) : (
                        t.body
                      )}
                      <div className={cn('text-[9px] mt-1 opacity-60', t.kind === 'out' ? 'text-black/60' : 'text-muted-foreground')}>
                        {formatTime(t.at)}
                      </div>
                    </div>
                    {activeConv.channel === 'gp' && t.kind === 'in' && (t.m as InboundMsg).bot_intent && (
                      <div className="mt-1">{intentPill((t.m as InboundMsg).bot_intent)}</div>
                    )}
                    {activeConv.channel === 'gp' && t.kind === 'in' && t.body && t.body.length > 8 && !((t.m as InboundMsg).bot_intent) && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <button
                          onClick={() => saveAddress('collecte', t.body)}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card hover:bg-muted/50 text-muted-foreground flex items-center gap-1"
                        >
                          <MapPin className="w-2.5 h-2.5" /> Adr. collecte Dakar
                        </button>
                        <button
                          onClick={() => saveAddress('remise', t.body, linkedDossier?.destination_country || undefined)}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card hover:bg-muted/50 text-muted-foreground flex items-center gap-1"
                        >
                          <MapPin className="w-2.5 h-2.5" /> Adr. remise {linkedDossier?.destination_country || ''}
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
                {thread.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">Aucun message</p>}
              </div>

              {/* Composer */}
              {activeConv.channel === 'client' ? (
                <div className="border-t border-border p-3 space-y-2 bg-card">
                  <select
                    value={templateKey}
                    onChange={(e) => { setTemplateKey(e.target.value as WaTemplateKey); setParams({}); }}
                    className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                  >
                    {WA_TEMPLATES_CLIENT.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {tpl.params.map((p) => (
                      <Input
                        key={p}
                        value={params[p] || ''}
                        onChange={(e) => setParams((prev) => ({ ...prev, [p]: e.target.value }))}
                        placeholder={p}
                        className="h-8 text-xs"
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap font-mono">{previewBody}</div>
                  <Button onClick={handleSend} disabled={sending} size="sm" className="w-full">
                    {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                    Envoyer
                  </Button>
                </div>
              ) : (
                <div className="border-t border-border bg-card">
                  {/* Bot status bar */}
                  <div className="px-3 py-1.5 flex items-center justify-between text-[10px] border-b border-border/50 gap-2">
                    <span className={cn('flex items-center gap-1 font-semibold', botPaused ? 'text-amber-400' : 'text-emerald-400')}>
                      {botPaused
                        ? <>⏸️ Bot en pause jusqu'à {formatTime(transporteurInfo!.bot_paused_until!)}</>
                        : <>🤖 Bot actif</>}
                    </span>
                    {botPaused ? (
                      <button onClick={resumeBot} className="text-primary hover:underline font-medium">Réactiver le bot</button>
                    ) : (
                      <button onClick={takeOver} className="text-[#F5C518] hover:underline font-medium flex items-center gap-1">
                        <PauseCircle className="w-3 h-3" /> Prendre le relais (1h)
                      </button>
                    )}
                  </div>
                  {/* Mode switch */}
                  <div className="flex gap-1 p-2 border-b border-border/50">
                    {(['libre', 'templates'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setGpMode(m)}
                        className={cn(
                          'flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition-colors',
                          gpMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {m === 'libre' ? 'Mode libre' : 'Templates GP'}
                      </button>
                    ))}
                  </div>
                  {gpMode === 'libre' ? (
                    <div className="p-3 space-y-2">
                      <Textarea
                        value={gpText}
                        onChange={(e) => onGpTyping(e.target.value)}
                        placeholder="Tapez votre message au GP (envoye depuis le 122)..."
                        rows={3}
                        className="text-xs resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Le bot sera mis en pause 5 min</span>
                        <Button onClick={() => sendGpFree(gpText)} disabled={sending || !gpText.trim()} size="sm">
                          {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                          Envoyer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 space-y-1.5">
                      {!linkedDossier && (
                        <p className="text-[10px] text-muted-foreground text-center pb-1">
                          Aucun dossier lie — templates generiques affiches
                        </p>
                      )}
                      {gpTemplatesForStatus(linkedDossier?.status).map((tpl) => {
                        const msg = tpl.build(gpCtx);
                        return (
                          <button
                            key={tpl.key}
                            onClick={() => sendGpFree(msg)}
                            disabled={sending}
                            className="w-full text-left text-[11px] px-2.5 py-2 rounded-md border border-border hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50"
                          >
                            <div className="font-semibold text-foreground mb-0.5">{tpl.label}</div>
                            <div className="text-muted-foreground line-clamp-2">{msg}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

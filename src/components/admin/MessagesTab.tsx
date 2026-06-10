import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Search, Send, CheckCheck, User, Truck, Package, Loader2, ExternalLink, MapPin, PauseCircle, Link2, RefreshCcw, Plus, Clock, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WA_TEMPLATES_CLIENT, getTemplate, type WaTemplateKey } from '@/lib/whatsappTemplates';
import { TEMPLATE_CATEGORIES, buildAutoFill, computeWindowStatus } from '@/lib/whatsappTemplateHelpers';
import { LinkDossierDialog, type LinkableDossier } from './messages/LinkDossierDialog';
import { NewMessageDialog } from './messages/NewMessageDialog';
import { AudioMessage } from './messages/AudioMessage';
import { MediaMessage } from './messages/MediaMessage';

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

const DOSSIER_SELECT = 'id, reference, tracking_id, status, origin_country, destination_country, origin_city, destination_city, estimated_weight, assigned_transporteur_ref, estimated_delivery_date, buyer_name, contact_phone, sender_name, sender_phone, sender_address, recipient_name, recipient_phone, recipient_address, final_amount_xof';

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

/** Numéros du super admin Yobbanté — exclus des conversations affichées. */
const SUPER_ADMIN_PHONES = new Set(['221784604003']);
const SUPER_ADMIN_NAMES = new Set(['ANB']);
function isSuperAdmin(m: { from_phone?: string | null; from_name?: string | null }): boolean {
  const p = (m.from_phone || '').replace(/\D/g, '');
  if (SUPER_ADMIN_PHONES.has(p)) return true;
  if (m.from_name && SUPER_ADMIN_NAMES.has(m.from_name.trim().toUpperCase())) return true;
  return false;
}

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
  /** 'in' = received, 'out' = sent by us */
  lastDir: 'in' | 'out';
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
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [clientFreeText, setClientFreeText] = useState('');
  const [clientComposerTab, setClientComposerTab] = useState<'free' | 'templates'>('free');
  const [transporteurInfo, setTransporteurInfo] = useState<{ id: string; reference: string; prenom: string | null; nom: string; ville: string; adresse_collecte_dakar: string | null; adresses_remise: Record<string, string>; bot_paused_until: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pauseTimerRef = useRef<number | null>(null);

  // ---------- Initial load + realtime subscriptions ----------
  const [reloading, setReloading] = useState(false);
  const mountedRef = useRef(true);

  const loadMessages = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setReloading(true);
    const [{ data: inData }, { data: outData }] = await Promise.all([
      supabase.from('whatsapp_inbound_messages').select('*').order('received_at', { ascending: false }).limit(500),
      supabase.from('whatsapp_outbound_messages').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    if (!mountedRef.current) return;
    setInbound(((inData ?? []) as InboundMsg[]).filter((m) => !isSuperAdmin(m)));
    setOutbound((outData ?? []) as OutboundMsg[]);
    setLoading(false);
    if (!opts?.silent) setReloading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadMessages({ silent: true });

    const ch = supabase
      .channel('admin-wa-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_inbound_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as InboundMsg;
          if (isSuperAdmin(row)) return;
          setInbound((prev) => prev.some((m) => m.id === row.id) ? prev : [row, ...prev]);
          toast(`Nouveau message de ${row.from_name || row.from_phone}`, {
            description: (row.message_body || '').slice(0, 60),
            action: { label: 'Ouvrir', onClick: () => setOpenPhone(row.from_phone) },
          });
        } else if (payload.eventType === 'UPDATE') {
          setInbound((prev) => prev.map((m) => (m.id === (payload.new as InboundMsg).id ? (payload.new as InboundMsg) : m)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_outbound_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as OutboundMsg;
          setOutbound((prev) => prev.some((m) => m.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setOutbound((prev) => prev.map((m) => (m.id === (payload.new as OutboundMsg).id ? (payload.new as OutboundMsg) : m)));
        }
      })
      .subscribe();

    // Refresh quand l'onglet redevient visible (filet de sécurité)
    const onVisible = () => { if (document.visibilityState === 'visible') loadMessages({ silent: true }); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadMessages]);


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
      const body = m.message_body || (m.message_type === 'audio' ? '🎤 Message vocal' : m.bot_intent || '(média)');
      if (!existing) {
        map.set(m.from_phone, {
          phone: m.from_phone,
          name: m.from_name,
          channel: m.channel,
          lastAt: m.received_at,
          lastBody: body,
          lastDir: 'in',
          unread: m.is_read ? 0 : 1,
          dossier_id: m.dossier_id,
        });
      } else {
        if (!existing.name && m.from_name) existing.name = m.from_name;
        if (m.received_at > existing.lastAt) {
          existing.lastAt = m.received_at;
          existing.lastBody = body;
          existing.lastDir = 'in';
        }
        if (!m.is_read) existing.unread += 1;
        if (!existing.dossier_id && m.dossier_id) existing.dossier_id = m.dossier_id;
      }
    }
    // Merge outbound — only attach to existing convs (phone match), update if newer
    for (const o of outbound) {
      const digits = (o.to_phone || '').replace(/\D/g, '');
      // Find matching conv by phone tail (last 9 digits)
      const tail = digits.slice(-9);
      let conv: ConversationGroup | undefined;
      for (const c of map.values()) {
        if (c.phone.replace(/\D/g, '').endsWith(tail)) { conv = c; break; }
      }
      if (!conv) continue;
      if (o.created_at > conv.lastAt) {
        conv.lastAt = o.created_at;
        conv.lastBody = o.message_body || (o.template_name ? `📋 ${o.template_name}` : '(envoyé)');
        conv.lastDir = 'out';
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
  }, [inbound, outbound, tab, search]);

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

  const gpCtx: GpCtx = useMemo(() => {
    const prenom = transporteurInfo?.prenom || activeConv?.name?.split(' ')[0] || 'GP';
    const dest = linkedDossier?.destination_country || 'destination';
    const orig = linkedDossier?.origin_country || 'origine';
    return {
      gp_prenom: prenom,
      client_name: linkedDossier?.buyer_name || linkedDossier?.sender_name || 'le client',
      tracking_id: linkedDossier?.tracking_id || linkedDossier?.reference || '—',
      route: `${orig} - ${dest}`,
      origin: orig,
      destination: dest,
      poids: linkedDossier?.estimated_weight ? String(linkedDossier.estimated_weight) : '?',
      pickup_address: linkedDossier?.sender_address || transporteurInfo?.adresse_collecte_dakar || 'a confirmer',
      date: linkedDossier?.estimated_delivery_date || 'bientot',
      departure_date: linkedDossier?.estimated_delivery_date || 'bientot',
    };
  }, [transporteurInfo, linkedDossier, activeConv]);

  // ---------- Auto-fill client template params from linked dossier ----------
  useEffect(() => {
    if (!activeConv || activeConv.channel !== 'client') return;
    const tpl = getTemplate(templateKey);
    const map = buildAutoFill(linkedDossier as any);
    // Inject client_name fallback to the conversation contact name
    if (!map.client_name && activeConv.name) map.client_name = activeConv.name;
    if (!map.prenom && activeConv.name) map.prenom = activeConv.name.split(' ')[0] || '';
    const next: Record<string, string> = {};
    tpl.params.forEach((p) => { if (map[p]) next[p] = map[p]; });
    // Reset (don't preserve previous template's residual values)
    setParams(next);
  }, [linkedDossier, templateKey, activeConv]);

  // ---------- WhatsApp 24h window status for active conversation ----------
  const lastInboundAt = useMemo(() => {
    if (!openPhone) return null;
    const msgs = inbound.filter((m) => m.from_phone === openPhone);
    if (msgs.length === 0) return null;
    return msgs.reduce((a, b) => (a.received_at > b.received_at ? a : b)).received_at;
  }, [openPhone, inbound]);
  const windowStatus = useMemo(() => computeWindowStatus(lastInboundAt), [lastInboundAt]);

  async function sendClientFree() {
    if (!openPhone || !clientFreeText.trim()) return;
    if (windowStatus !== 'open') {
      toast.error('Fenêtre WhatsApp fermée — utilisez un template.');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: openPhone,
          recipient_type: 'client',
          message: clientFreeText.trim(),
          trigger_type: 'admin_free_text_client',
        },
      });
      if (error) throw error;
      toast.success('Message envoyé');
      setClientFreeText('');
    } catch (e) {
      toast.error('Échec envoi', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
  }

  // Default composer tab based on WhatsApp window status
  useEffect(() => {
    if (!openPhone) return;
    setClientComposerTab(windowStatus === 'open' ? 'free' : 'templates');
  }, [windowStatus, openPhone]);
  }


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
          <p className="text-[10px] text-muted-foreground mt-0.5">Mise à jour en temps réel · Clients : 607 · GP : 926</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setNewMsgOpen(true)}
            aria-label="Nouveau message"
            className="h-8 px-2 md:px-3 text-xs gap-1.5 bg-[#F5C518] text-zinc-950 hover:bg-[#F5C518]/90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nouveau message</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMessages().then(() => toast.success('Messagerie rechargée'))}
            disabled={reloading}
            aria-label="Recharger"
            className="h-8 px-2 md:px-3 text-xs gap-1.5"
          >
            <RefreshCcw className={cn('w-3.5 h-3.5', reloading && 'animate-spin')} />
            <span className="hidden md:inline">Recharger</span>
          </Button>
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
              conversations.map((c) => {
                const isUnread = c.unread > 0;
                return (
                <button
                  key={c.phone}
                  onClick={() => setOpenPhone(c.phone)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors',
                    openPhone === c.phone && 'bg-muted',
                    isUnread && openPhone !== c.phone && 'bg-primary/5 border-l-2 border-l-primary',
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
                      <span className={cn(
                        'text-xs truncate flex items-center gap-1',
                        isUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground',
                      )}>
                        {c.name || c.phone}
                        {c.channel === 'gp' && <Truck className="w-3 h-3 text-emerald-500" />}
                      </span>
                      <span className={cn(
                        'text-[10px] flex-shrink-0',
                        isUnread ? 'text-primary font-semibold' : 'text-muted-foreground',
                      )}>
                        {formatTime(c.lastAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={cn(
                        'text-[11px] truncate flex items-center gap-1',
                        isUnread ? 'text-foreground font-medium' : 'text-muted-foreground',
                      )}>
                        {c.lastDir === 'out' && (
                          <CheckCheck className="w-3 h-3 text-primary/70 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {c.lastDir === 'out' ? 'Vous : ' : ''}{c.lastBody.slice(0, 60)}
                        </span>
                      </span>
                      {c.unread > 0 && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full flex-shrink-0 font-bold min-w-[18px] text-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                );
              })
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeConv.channel === 'client' && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-5 text-[9px] gap-1 hidden sm:inline-flex',
                        windowStatus === 'open' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                        windowStatus === 'closed' && 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                        windowStatus === 'unknown' && 'bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {windowStatus === 'open' && <><Unlock className="w-2.5 h-2.5" />Fenêtre ouverte</>}
                      {windowStatus === 'closed' && <><Lock className="w-2.5 h-2.5" />Fenêtre fermée</>}
                      {windowStatus === 'unknown' && <><Clock className="w-2.5 h-2.5" />Nouveau contact</>}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleMarkHandled} className="text-xs">
                    <CheckCheck className="w-3.5 h-3.5 mr-1" /> Traité
                  </Button>
                </div>
              </header>

              {/* Linked dossier card */}
              <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between gap-2 text-xs">
                {linkedDossier ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="font-semibold text-foreground truncate">
                        {linkedDossier.tracking_id || linkedDossier.reference}
                      </span>
                      <span className="text-muted-foreground hidden sm:inline truncate">
                        · {(linkedDossier as any).origin_city || linkedDossier.origin_country || '—'} → {(linkedDossier as any).destination_city || linkedDossier.destination_country || '—'}
                      </span>
                      <Badge variant="outline" className="h-4 text-[9px] flex-shrink-0">{linkedDossier.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setLinkDialogOpen(true)} className="text-muted-foreground hover:text-primary flex items-center gap-1">
                        <RefreshCcw className="w-3 h-3" /> Changer
                      </button>
                      <a href={`/admin/orders?dossier=${linkedDossier.id}`} className="text-primary hover:underline flex items-center gap-1">
                        Voir <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Package className="w-3.5 h-3.5" />
                      Aucun dossier lié
                      {availableDossiers.length > 1 && (
                        <Badge variant="outline" className="h-4 text-[9px]">{availableDossiers.length} candidats</Badge>
                      )}
                    </span>
                    <button
                      onClick={() => setLinkDialogOpen(true)}
                      className="text-[#F5C518] hover:underline flex items-center gap-1 font-medium"
                    >
                      <Link2 className="w-3 h-3" /> Lier un dossier
                    </button>
                  </>
                )}
              </div>

              {/* Multi-dossier picker (when several active dossiers found) */}
              {!linkedDossier && availableDossiers.length > 1 && (
                <div className="px-4 py-2 border-b border-border bg-card/40 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">
                    Plusieurs dossiers actifs trouvés. Choisissez celui à lier à la conversation :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDossiers.slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => linkDossierToConv(d)}
                        className="text-[11px] px-2.5 py-1.5 rounded-md border border-border hover:border-[#F5C518] hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-semibold text-foreground">{d.tracking_id || d.reference}</span>
                        <span className="text-muted-foreground"> · {(d as any).origin_city || d.origin_country} → {(d as any).destination_city || d.destination_country}</span>
                        <Badge variant="outline" className="ml-1 h-3.5 text-[9px]">{d.status}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Thread */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/50">
                {thread.map((t) => {
                  const inMsg = t.kind === 'in' ? (t.m as InboundMsg) : null;
                  const mediaKinds = new Set(['image', 'audio', 'voice', 'video', 'document', 'sticker']);
                  const isMedia = !!(inMsg && inMsg.media_url && mediaKinds.has(inMsg.message_type));
                  const hasTextBody = !!(inMsg?.message_body && inMsg.message_body !== `[${inMsg.message_type}]`);
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
                      {isMedia && inMsg ? (
                        <MediaMessage
                          mediaUrl={inMsg.media_url!}
                          messageType={inMsg.message_type}
                          caption={hasTextBody ? inMsg.message_body : null}
                          wamid={(inMsg as any).wamid ?? null}
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
                <div className="border-t border-border bg-card">
                  {/* Tabs */}
                  <div className="flex gap-1 p-2 border-b border-border/50">
                    {(['free', 'templates'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setClientComposerTab(t)}
                        className={cn(
                          'flex-1 text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors',
                          clientComposerTab === t
                            ? 'bg-[#F5C518] text-zinc-950'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {t === 'free' ? 'Message libre' : 'Templates'}
                      </button>
                    ))}
                  </div>

                  {clientComposerTab === 'free' ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Message libre
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-4 text-[9px] gap-1',
                            windowStatus === 'open' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                            windowStatus === 'closed' && 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                            windowStatus === 'unknown' && 'bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {windowStatus === 'open' && 'Fenêtre ouverte (< 24h)'}
                          {windowStatus === 'closed' && 'Fenêtre fermée — templates uniquement'}
                          {windowStatus === 'unknown' && 'Nouveau contact — templates uniquement'}
                        </Badge>
                      </div>
                      {windowStatus === 'open' ? (
                        <>
                          <Textarea
                            value={clientFreeText}
                            onChange={(e) => setClientFreeText(e.target.value)}
                            placeholder="Écrire un message..."
                            rows={2}
                            className="text-xs resize-none"
                          />
                          <div className="flex justify-end">
                            <Button onClick={sendClientFree} disabled={sending || !clientFreeText.trim()} size="sm" className="bg-[#F5C518] text-zinc-950 hover:bg-[#F5C518]/90">
                              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                              Envoyer
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-orange-400/90 italic">
                          Le client n'a pas écrit dans les dernières 24h. Utilisez un template ci-dessous.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Template approuvé
                      </span>
                      <select
                        value={templateKey}
                        onChange={(e) => setTemplateKey(e.target.value as WaTemplateKey)}
                        className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                      >
                        {TEMPLATE_CATEGORIES.map((cat) => (
                          <optgroup key={cat.label} label={cat.label}>
                            {cat.keys.map((k) => {
                              const t = WA_TEMPLATES_CLIENT.find((x) => x.key === k);
                              if (!t) return null;
                              return <option key={k} value={k}>{t.label}</option>;
                            })}
                          </optgroup>
                        ))}
                      </select>
                      {!linkedDossier && (
                        <p className="text-[10px] text-orange-400/80 italic">
                          Aucun dossier lié — les champs ne seront pas pré-remplis automatiquement.
                        </p>
                      )}
                      {tpl.params.length > 0 && (
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
                      )}
                      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap font-mono max-h-28 overflow-y-auto">{previewBody}</div>
                      <Button onClick={handleSend} disabled={sending} size="sm" className="w-full">
                        {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                        Envoyer template
                      </Button>
                    </div>
                  )}
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
                        placeholder="Tapez votre message au GP (envoye depuis le 926)..."
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
                      {(linkedDossier ? gpTemplatesForDossier() : gpTemplatesGeneric()).map((tpl) => {
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
      <LinkDossierDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        transporteurRef={transporteurInfo?.reference ?? null}
        phone={openPhone}
        onPick={(d) => linkDossierToConv(d)}
      />
      <NewMessageDialog open={newMsgOpen} onOpenChange={setNewMsgOpen} />
    </div>
  );
}

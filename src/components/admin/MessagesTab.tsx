import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { MessageSquare, Search, Send, CheckCheck, User, Truck, Package, Loader2, ExternalLink, MapPin, PauseCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WA_TEMPLATES_CLIENT, getTemplate, type WaTemplateKey } from '@/lib/whatsappTemplates';

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
}

interface GpTemplate {
  key: string;
  label: string;
  build: (ctx: { gp_prenom: string; route: string; poids: string; destination: string; tracking_id: string; date: string; departure_date: string }) => string;
}

function gpTemplatesForStatus(status: string | undefined): GpTemplate[] {
  const map: Record<string, GpTemplate[]> = {
    NEW: [
      { key: 'cap', label: 'Demander capacite', build: (c) => `Salam ${c.gp_prenom}, j'ai un colis ${c.route} ${c.poids}kg, tu as de la place ?` },
      { key: 'next', label: 'Prochain depart', build: (c) => `Quand est ton prochain depart pour ${c.destination} ?` },
    ],
    SUBMITTED: [
      { key: 'cap', label: 'Demander capacite', build: (c) => `Salam ${c.gp_prenom}, j'ai un colis ${c.route} ${c.poids}kg, tu as de la place ?` },
      { key: 'next', label: 'Prochain depart', build: (c) => `Quand est ton prochain depart pour ${c.destination} ?` },
    ],
    CONFIRMED: [
      { key: 'cap', label: 'Demander capacite', build: (c) => `Salam ${c.gp_prenom}, j'ai un colis ${c.route} ${c.poids}kg, tu as de la place ?` },
      { key: 'next', label: 'Prochain depart', build: (c) => `Quand est ton prochain depart pour ${c.destination} ?` },
    ],
    AWAITING_ADDRESS: [
      { key: 'pickup', label: 'Adresse collecte Dakar', build: () => `C'est quoi ton adresse de collecte a Dakar ?` },
      { key: 'dropoff', label: 'Adresse remise', build: (c) => `Et l'adresse de remise a ${c.destination} ?` },
    ],
    ASSIGNED: [
      { key: 'confirm', label: 'Confirmer la mission', build: (c) => `Salam ${c.gp_prenom}, je t'amene le colis ${c.tracking_id} le ${c.date}. Confirme-moi que c'est bon.` },
      { key: 'dep', label: 'Confirmer le depart', build: (c) => `Tu pars bien le ${c.departure_date} ?` },
    ],
    COLLECTED: [
      { key: 'ok', label: 'Collecte ok ?', build: () => `Tout s'est bien passe pour la collecte ?` },
      { key: 'flight', label: 'Vol confirme ?', build: () => `Tu es parti ? Le vol est confirme ?` },
    ],
  };
  return map[status ?? ''] ?? [
    { key: 'hello', label: 'Salutation', build: (c) => `Salam ${c.gp_prenom}, comment tu vas ?` },
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
  const [inbound, setInbound] = useState<InboundMsg[]>([]);
  const [outbound, setOutbound] = useState<OutboundMsg[]>([]);
  const [tab, setTab] = useState<'all' | 'client' | 'gp'>('all');
  const [search, setSearch] = useState('');
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateKey, setTemplateKey] = useState<WaTemplateKey>('PACKAGE_COLLECTED');
  const [params, setParams] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // ---------- Render ----------
  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Messages WhatsApp
            {unreadTotal > 0 && (
              <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                {unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Clients : 607 · GP : 122</p>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden">
        {/* ===== LEFT — conversations ===== */}
        <aside className={cn('w-full md:w-[340px] flex-shrink-0 border-r border-border flex flex-col', openPhone && 'hidden md:flex')}>
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
                {thread.map((t) => (
                  <div key={`${t.kind}-${t.id}`} className={cn('flex', t.kind === 'out' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap break-words shadow-sm',
                        t.kind === 'in'
                          ? 'bg-muted text-foreground rounded-bl-sm'
                          : 'text-black rounded-br-sm'
                      )}
                      style={t.kind === 'out' ? { background: '#F5C518' } : undefined}
                    >
                      {activeConv.channel === 'gp' && t.kind === 'in' && (t.m as InboundMsg).bot_intent && (
                        <div className="text-[10px] font-bold text-emerald-600 mb-1">🤖 {(t.m as InboundMsg).bot_intent}</div>
                      )}
                      {t.body}
                      <div className={cn('text-[9px] mt-1 opacity-60', t.kind === 'out' ? 'text-black/60' : 'text-muted-foreground')}>
                        {formatTime(t.at)}
                      </div>
                    </div>
                  </div>
                ))}
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
                <div className="border-t border-border p-3 bg-muted/20 text-center text-[11px] text-muted-foreground">
                  🤖 Conversation gérée automatiquement par le bot GP
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

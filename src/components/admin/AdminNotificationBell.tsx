import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, Package, Wallet, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type NotifKind = 'message' | 'dossier' | 'payment';

interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  navigate: string;
}

const SUPER_ADMIN_PHONE = '221784604003';
const SUPER_ADMIN_NAME = 'ANB';
const STORAGE_KEY = 'admin_notif_read_ids_v1';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-500)));
  } catch { /* noop */ }
}

export function AdminNotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());

  const load = async () => {
    const since = new Date(Date.now() - 72 * 3600_000).toISOString();
    const [msgs, dossiers, payments] = await Promise.all([
      supabase
        .from('whatsapp_inbound_messages')
        .select('id, from_name, from_phone, message_body, received_at, is_read')
        .gte('received_at', since)
        .order('received_at', { ascending: false })
        .limit(30),
      supabase
        .from('dossiers')
        .select('id, tracking_id, reference, sender_name, buyer_name, status, created_at, payment_status, paid_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('dossiers')
        .select('id, tracking_id, reference, paid_at, sender_name, buyer_name')
        .eq('payment_status', 'paid')
        .gte('paid_at', since)
        .order('paid_at', { ascending: false })
        .limit(30),
    ]);

    const out: Notif[] = [];

    (msgs.data ?? []).forEach((m: any) => {
      const phone = (m.from_phone || '').replace(/\D/g, '');
      if (phone === SUPER_ADMIN_PHONE) return;
      if ((m.from_name || '').trim().toUpperCase() === SUPER_ADMIN_NAME) return;
      out.push({
        id: `msg-${m.id}`,
        kind: 'message',
        title: `Message — ${m.from_name || m.from_phone}`,
        body: (m.message_body || '').slice(0, 80) || '(média)',
        at: m.received_at,
        read: m.is_read,
        navigate: '/admin/messages',
      });
    });

    (dossiers.data ?? []).forEach((d: any) => {
      const ref = d.tracking_id || d.reference || d.id.slice(0, 8);
      out.push({
        id: `dos-${d.id}`,
        kind: 'dossier',
        title: `Nouveau dossier ${ref}`,
        body: d.sender_name || d.buyer_name || 'Client',
        at: d.created_at,
        read: false,
        navigate: `/admin/dossiers?tracking=${ref}`,
      });
    });

    (payments.data ?? []).forEach((d: any) => {
      const ref = d.tracking_id || d.reference || d.id.slice(0, 8);
      out.push({
        id: `pay-${d.id}`,
        kind: 'payment',
        title: `Paiement reçu — ${ref}`,
        body: d.sender_name || d.buyer_name || '',
        at: d.paid_at,
        read: false,
        navigate: `/admin/dossiers?tracking=${ref}`,
      });
    });

    out.sort((a, b) => (a.at < b.at ? 1 : -1));
    setItems(out.slice(0, 40));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`admin-notif-bell-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_inbound_messages' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dossiers' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dossiers' }, () => load())
      .subscribe();
    const t = window.setInterval(load, 60_000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
  }, []);

  const unread = useMemo(
    () => items.filter((i) => !i.read && !readIds.has(i.id)).length,
    [items, readIds],
  );

  const markAllRead = () => {
    const next = new Set(readIds);
    items.forEach((i) => next.add(i.id));
    setReadIds(next);
    saveReadIds(next);
  };

  const handleClick = (n: Notif) => {
    const next = new Set(readIds);
    next.add(n.id);
    setReadIds(next);
    saveReadIds(next);
    setOpen(false);
    navigate(n.navigate);
  };

  const Icon = (k: NotifKind) =>
    k === 'message' ? MessageSquare : k === 'dossier' ? Package : Wallet;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className={cn(
            'relative inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
            className,
          )}
        >
          <Bell className="w-[18px] h-[18px]" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 max-h-[480px] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="w-3 h-3" /> Tout marquer lu
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Aucune notification récente.
            </div>
          ) : (
            items.map((n) => {
              const I = Icon(n.kind);
              const isUnread = !n.read && !readIds.has(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex gap-2.5 border-b border-border/40 hover:bg-secondary/60 transition-colors',
                    isUnread && 'bg-primary/5',
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center',
                    n.kind === 'message' && 'bg-yellow-500/15 text-yellow-500',
                    n.kind === 'dossier' && 'bg-primary/15 text-primary',
                    n.kind === 'payment' && 'bg-emerald-500/15 text-emerald-500',
                  )}>
                    <I className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[13px] truncate', isUnread ? 'font-semibold text-foreground' : 'text-foreground')}>
                        {n.title}
                      </span>
                      {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground truncate">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(n.at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

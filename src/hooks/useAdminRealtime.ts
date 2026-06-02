import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type LiveStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * One global Supabase realtime channel for the admin console.
 * - Subscribes to dossiers, manual_departures, whatsapp_inbound_messages
 * - Invalidates the react-query cache on any change (coalesced)
 * - Surfaces discreet toasts for new orders / payments / inbound messages
 * - Auto-reconnects after 3s on disconnect
 */
export function useAdminRealtime(): LiveStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const invalidateTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const seenDossierRef = useRef<Set<string>>(new Set());
  const seenPaidRef = useRef<Set<string>>(new Set());
  const seenMsgRef = useRef<Set<string>>(new Set());
  // Hydrate guard — first snapshot from server is treated as "already seen" so we don't spam toasts
  const hydratedRef = useRef(false);

  function scheduleInvalidate() {
    if (invalidateTimer.current !== null) window.clearTimeout(invalidateTimer.current);
    invalidateTimer.current = window.setTimeout(() => {
      qc.invalidateQueries();
      invalidateTimer.current = null;
    }, 300);
  }

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function hydrateGuards() {
      try {
        const [{ data: recentDossiers }, { data: recentPaid }, { data: recentMsgs }] = await Promise.all([
          supabase.from('dossiers').select('id').order('created_at', { ascending: false }).limit(50),
          supabase.from('dossiers').select('id').eq('payment_status', 'paid').order('paid_at', { ascending: false }).limit(50),
          supabase.from('whatsapp_inbound_messages').select('id').order('received_at', { ascending: false }).limit(50),
        ]);
        (recentDossiers ?? []).forEach((r: any) => seenDossierRef.current.add(r.id));
        (recentPaid ?? []).forEach((r: any) => seenPaidRef.current.add(r.id));
        (recentMsgs ?? []).forEach((r: any) => seenMsgRef.current.add(r.id));
      } catch {
        /* noop — toasts may fire on first load but that's acceptable */
      } finally {
        hydratedRef.current = true;
      }
    }

    function connect() {
      if (cancelled) return;
      setStatus('connecting');

      channel = supabase
        .channel('admin-global')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dossiers' },
          (payload) => {
            const row = payload.new as { id: string; tracking_id?: string; reference?: string };
            if (seenDossierRef.current.has(row.id) || !hydratedRef.current) {
              seenDossierRef.current.add(row.id);
              scheduleInvalidate();
              return;
            }
            seenDossierRef.current.add(row.id);
            const ref = row.tracking_id || row.reference || row.id.slice(0, 8);
            toast(`Nouvelle commande ${ref}`, {
              id: `new-${row.id}`,
              duration: 3000,
              className: 'border-[#F5C518]/40 bg-[#F5C518]/10',
              action: {
                label: 'Voir →',
                onClick: () => { window.location.href = `/admin/dossiers?tracking=${ref}`; },
              },
            });
            scheduleInvalidate();
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'dossiers' },
          (payload) => {
            const row = payload.new as { id: string; tracking_id?: string; reference?: string; payment_status?: string };
            const prev = payload.old as { payment_status?: string };
            if (
              hydratedRef.current
              && row.payment_status === 'paid'
              && prev?.payment_status !== 'paid'
              && !seenPaidRef.current.has(row.id)
            ) {
              seenPaidRef.current.add(row.id);
              const ref = row.tracking_id || row.reference || row.id.slice(0, 8);
              toast.success(`Paiement reçu ${ref}`, { id: `paid-${row.id}`, duration: 3000 });
            }
            scheduleInvalidate();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'manual_departures' },
          () => scheduleInvalidate(),
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whatsapp_inbound_messages' },
          (payload) => {
            const row = payload.new as { id: string; from_name?: string | null; from_phone?: string; direction?: string };
            if (seenMsgRef.current.has(row.id) || !hydratedRef.current) {
              seenMsgRef.current.add(row.id);
              scheduleInvalidate();
              return;
            }
            seenMsgRef.current.add(row.id);
            if (row.direction && row.direction !== 'inbound') {
              scheduleInvalidate();
              return;
            }
            const who = (row.from_name || row.from_phone || 'inconnu').toString().split(' ')[0];
            toast(`Message de ${who}`, {
              id: `msg-${row.id}`,
              duration: 3000,
              className: 'border-primary/40 bg-primary/10',
            });
            scheduleInvalidate();
          },
        )
        .subscribe((s) => {
          if (cancelled) return;
          if (s === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            setStatus('disconnected');
            if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
            reconnectTimer.current = window.setTimeout(() => {
              if (channel) supabase.removeChannel(channel);
              connect();
            }, 3000);
          }
        });
    }

    hydrateGuards().then(connect);

    return () => {
      cancelled = true;
      if (invalidateTimer.current !== null) window.clearTimeout(invalidateTimer.current);
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  return status;
}

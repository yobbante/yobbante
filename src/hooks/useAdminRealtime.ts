import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type LiveStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * One global Supabase realtime channel for the admin console.
 * Singleton — multiple components can call useAdminRealtime() and share
 * the same channel + status (otherwise Supabase throws
 * "cannot add postgres_changes callbacks after subscribe()" and the
 * second instance stays stuck in "connecting").
 */

let channel: ReturnType<typeof supabase.channel> | null = null;
let refCount = 0;
let currentStatus: LiveStatus = 'connecting';
const listeners = new Set<(s: LiveStatus) => void>();
const seenDossier = new Set<string>();
const seenPaid = new Set<string>();
const seenMsg = new Set<string>();
let hydrated = false;
let invalidateTimer: number | null = null;
let reconnectTimer: number | null = null;
let qcRef: QueryClient | null = null;

function setStatus(s: LiveStatus) {
  currentStatus = s;
  listeners.forEach((l) => l(s));
}

function scheduleInvalidate() {
  if (invalidateTimer !== null) window.clearTimeout(invalidateTimer);
  invalidateTimer = window.setTimeout(() => {
    qcRef?.invalidateQueries();
    invalidateTimer = null;
  }, 300);
}

async function hydrateGuards() {
  try {
    const [{ data: recentDossiers }, { data: recentPaid }, { data: recentMsgs }] = await Promise.all([
      supabase.from('dossiers').select('id').order('created_at', { ascending: false }).limit(50),
      supabase.from('dossiers').select('id').eq('payment_status', 'paid').order('paid_at', { ascending: false }).limit(50),
      supabase.from('whatsapp_inbound_messages').select('id').order('received_at', { ascending: false }).limit(50),
    ]);
    (recentDossiers ?? []).forEach((r: any) => seenDossier.add(r.id));
    (recentPaid ?? []).forEach((r: any) => seenPaid.add(r.id));
    (recentMsgs ?? []).forEach((r: any) => seenMsg.add(r.id));
  } catch {
    /* noop */
  } finally {
    hydrated = true;
  }
}

function connect() {
  setStatus('connecting');
  channel = supabase
    .channel('admin-global')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dossiers' }, (payload) => {
      const row = payload.new as { id: string; tracking_id?: string; reference?: string };
      if (seenDossier.has(row.id) || !hydrated) {
        seenDossier.add(row.id);
        scheduleInvalidate();
        return;
      }
      seenDossier.add(row.id);
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
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dossiers' }, (payload) => {
      const row = payload.new as { id: string; tracking_id?: string; reference?: string; payment_status?: string };
      const prev = payload.old as { payment_status?: string };
      if (hydrated && row.payment_status === 'paid' && prev?.payment_status !== 'paid' && !seenPaid.has(row.id)) {
        seenPaid.add(row.id);
        const ref = row.tracking_id || row.reference || row.id.slice(0, 8);
        toast.success(`Paiement reçu ${ref}`, { id: `paid-${row.id}`, duration: 3000 });
      }
      scheduleInvalidate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_departures' }, () => scheduleInvalidate())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_inbound_messages' }, (payload) => {
      const row = payload.new as { id: string; from_name?: string | null; from_phone?: string; direction?: string };
      if (seenMsg.has(row.id) || !hydrated) {
        seenMsg.add(row.id);
        scheduleInvalidate();
        return;
      }
      seenMsg.add(row.id);
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
    })
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        setStatus('connected');
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        setStatus('disconnected');
        if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          if (channel) supabase.removeChannel(channel);
          channel = null;
          connect();
        }, 3000);
      }
    });
}

export function useAdminRealtime(): LiveStatus {
  const qc = useQueryClient();
  const [status, setLocal] = useState<LiveStatus>(currentStatus);

  useEffect(() => {
    qcRef = qc;
    refCount += 1;
    listeners.add(setLocal);
    setLocal(currentStatus);

    if (refCount === 1 && !channel) {
      hydrateGuards().then(connect);
    }

    return () => {
      listeners.delete(setLocal);
      refCount -= 1;
      if (refCount === 0) {
        if (invalidateTimer !== null) window.clearTimeout(invalidateTimer);
        if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
        if (channel) supabase.removeChannel(channel);
        channel = null;
        hydrated = false;
        setStatus('connecting');
      }
    };
  }, [qc]);

  return status;
}

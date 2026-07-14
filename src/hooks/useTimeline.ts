import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { TimelineEvent } from '@/lib/types';

/**
 * Timeline — stream-first.
 * Initial fetch loads the last 50 events; a single app-wide Supabase Realtime
 * channel mutates the cache directly (insert/update/delete). We ref-count
 * consumers so multiple mounts (StrictMode, sibling components) share ONE
 * subscription — no reconnection loop, no duplicate events.
 */

// Module-level singleton — one channel per app instance, ref-counted.
let sharedChannel: RealtimeChannel | null = null;
let refCount = 0;
let boundQc: QueryClient | null = null;

function attachChannel(qc: QueryClient) {
  refCount += 1;
  if (sharedChannel) return;
  boundQc = qc;
  sharedChannel = supabase
    .channel('timeline-stream')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'timeline_events' },
      (payload) => {
        const incoming = payload.new as TimelineEvent;
        boundQc?.setQueryData<TimelineEvent[]>(['timeline'], (prev = []) => {
          if (prev.some(e => e.id === incoming.id)) return prev;
          return [incoming, ...prev].slice(0, 50);
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'timeline_events' },
      (payload) => {
        const updated = payload.new as TimelineEvent;
        boundQc?.setQueryData<TimelineEvent[]>(['timeline'], (prev = []) =>
          prev.map(e => (e.id === updated.id ? updated : e))
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'timeline_events' },
      (payload) => {
        const oldId = (payload.old as { id?: string })?.id;
        if (!oldId) return;
        boundQc?.setQueryData<TimelineEvent[]>(['timeline'], (prev = []) =>
          prev.filter(e => e.id !== oldId)
        );
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'packages' },
      () => boundQc?.invalidateQueries({ queryKey: ['packages'] })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shipments' },
      () => boundQc?.invalidateQueries({ queryKey: ['shipments'] })
    )
    .subscribe();
}

function detachChannel() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && sharedChannel) {
    supabase.removeChannel(sharedChannel);
    sharedChannel = null;
    boundQc = null;
  }
}

export function useTimeline() {
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['timeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as TimelineEvent[];
    },
  });

  useEffect(() => {
    attachChannel(queryClient);
    return () => { detachChannel(); };
  }, [queryClient]);

  const addEvent = useMutation({
    mutationFn: async (event: { event_type: string; title: string; description?: string | null; metadata?: Record<string, unknown>; related_package_id?: string | null; related_shipment_id?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('timeline_events')
        .insert({
          event_type: event.event_type,
          title: event.title,
          description: event.description ?? null,
          metadata: event.metadata as never ?? {},
          related_package_id: event.related_package_id ?? null,
          related_shipment_id: event.related_shipment_id ?? null,
          user_id: user.id,
        });
      if (error) throw error;
    },
  });

  return { events, isLoading, addEvent };
}


import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TimelineEvent } from '@/lib/types';

/**
 * Timeline — stream-first.
 * Initial fetch loads the last 50 events; a Supabase Realtime channel
 * then mutates the cache directly (insert/update/delete) so the timeline
 * stays in chronological order without polling glitches or full re-fetches.
 */
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

  // True realtime: mutate the cache in place, in-order.
  useEffect(() => {
    const channel = supabase
      .channel('timeline-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'timeline_events' },
        (payload) => {
          const incoming = payload.new as TimelineEvent;
          queryClient.setQueryData<TimelineEvent[]>(['timeline'], (prev = []) => {
            if (prev.some(e => e.id === incoming.id)) return prev;
            // Newest first, capped at 50.
            return [incoming, ...prev].slice(0, 50);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'timeline_events' },
        (payload) => {
          const updated = payload.new as TimelineEvent;
          queryClient.setQueryData<TimelineEvent[]>(['timeline'], (prev = []) =>
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
          queryClient.setQueryData<TimelineEvent[]>(['timeline'], (prev = []) =>
            prev.filter(e => e.id !== oldId)
          );
        }
      )
      // Package / shipment state changes can affect the timeline indirectly
      // (server-side triggers may insert events). We refresh those caches too.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packages' },
        () => queryClient.invalidateQueries({ queryKey: ['packages'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        () => queryClient.invalidateQueries({ queryKey: ['shipments'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    // No invalidate — realtime delivers the new row.
  });

  return { events, isLoading, addEvent };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TimelineEvent } from '@/lib/types';

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
          metadata: event.metadata as any ?? {},
          related_package_id: event.related_package_id ?? null,
          related_shipment_id: event.related_shipment_id ?? null,
          user_id: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });

  return { events, isLoading, addEvent };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the set of transporteur_ids that have sent at least one WhatsApp
 * inbound message on the GP channel (i.e. they are "active" on the bot).
 */
export function useGpBotActive() {
  return useQuery({
    queryKey: ['gp-bot-active-ids'],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('whatsapp_inbound_messages' as any)
        .select('transporteur_id')
        .eq('channel', 'gp')
        .not('transporteur_id', 'is', null)
        .limit(5000);
      if (error) return new Set<string>();
      const ids = new Set<string>();
      (data as any[] | null)?.forEach((r) => r.transporteur_id && ids.add(r.transporteur_id));
      return ids;
    },
    staleTime: 60_000,
  });
}

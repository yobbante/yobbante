import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Interrupteur global : met en pause / relance TOUS les bots WhatsApp
 * (bot-client + gp-bot) en un clic.
 */
export function useGlobalBotPause() {
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bot_global_settings' as any)
      .select('paused')
      .maybeSingle();
    setPaused(!!(data as any)?.paused);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('bot-global-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bot_global_settings' },
        (payload) => setPaused(!!(payload.new as any)?.paused),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const toggle = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    const next = !paused;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('bot_global_settings' as any)
      .update({ paused: next, updated_at: new Date().toISOString(), updated_by: userData.user?.id ?? null })
      .eq('id', true);
    setSaving(false);
    if (error) throw error;
    setPaused(next);
    return next;
  }, [paused]);

  return { paused, loading, saving, toggle, reload: load };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Interrupteur global : met en pause / relance TOUS les bots WhatsApp
 * (bot-client + gp-bot) en un clic.
 * Second interrupteur : réponse automatique aux NOUVEAUX clients uniquement.
 */
export function useGlobalBotPause() {
  const [paused, setPaused] = useState(false);
  const [autoreply, setAutoreply] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAutoreply, setSavingAutoreply] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bot_global_settings' as any)
      .select('paused, new_client_autoreply')
      .maybeSingle();
    setPaused(!!(data as any)?.paused);
    setAutoreply((data as any)?.new_client_autoreply !== false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('bot-global-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bot_global_settings' },
        (payload) => {
          setPaused(!!(payload.new as any)?.paused);
          setAutoreply((payload.new as any)?.new_client_autoreply !== false);
        },
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

  const toggleAutoreply = useCallback(async (): Promise<boolean> => {
    setSavingAutoreply(true);
    const next = !autoreply;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('bot_global_settings' as any)
      .update({ new_client_autoreply: next, updated_at: new Date().toISOString(), updated_by: userData.user?.id ?? null })
      .eq('id', true);
    setSavingAutoreply(false);
    if (error) throw error;
    setAutoreply(next);
    return next;
  }, [autoreply]);

  return { paused, autoreply, loading, saving, savingAutoreply, toggle, toggleAutoreply, reload: load };
}

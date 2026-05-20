import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-save intake form data into `intake_drafts` every 10s.
 * One latest draft per user is kept (we update the same row).
 */
export function useIntakeDraft<T extends object>(initial: T) {
  const [data, setData] = useState<T>(initial);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const lastSerialized = useRef<string>(JSON.stringify(initial));

  // Load latest existing draft on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase
        .from('intake_drafts')
        .select('id, draft_data')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (row?.id) {
        setDraftId(row.id);
        setHasExisting(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Periodic save
  useEffect(() => {
    const t = setInterval(async () => {
      const serialized = JSON.stringify(data);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (draftId) {
        await supabase.from('intake_drafts')
          .update({ draft_data: data as any })
          .eq('id', draftId);
      } else {
        const { data: row } = await supabase
          .from('intake_drafts')
          .insert({ user_id: user.id, draft_data: data as any })
          .select('id')
          .single();
        if (row?.id) setDraftId(row.id);
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [data, draftId]);

  const loadExisting = async (): Promise<T | null> => {
    if (!draftId) return null;
    const { data: row } = await supabase
      .from('intake_drafts')
      .select('draft_data')
      .eq('id', draftId)
      .maybeSingle();
    const loaded = row?.draft_data as T | undefined;
    if (loaded) setData(loaded);
    return loaded ?? null;
  };

  const clearDraft = async () => {
    if (draftId) {
      await supabase.from('intake_drafts').delete().eq('id', draftId);
      setDraftId(null);
      setHasExisting(false);
    }
  };

  return { data, setData, hasExisting, loadExisting, clearDraft };
}

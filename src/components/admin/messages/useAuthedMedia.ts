import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * The whatsapp-media-proxy edge function requires a staff JWT, which a plain
 * <img src="..."> can never send. So we fetch the bytes with the session token
 * and expose an object URL instead.
 */
export function useAuthedMedia(mediaUrl: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function go() {
      setLoading(true);
      setError(false);
      setUrl(null);

      // Already a direct URL (storage/public) → use as is
      if (/^https?:\/\//i.test(mediaUrl)) {
        if (!cancelled) {
          setUrl(mediaUrl);
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('no session');

        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/whatsapp-media-proxy?id=${encodeURIComponent(mediaUrl)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(`proxy ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    go();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaUrl]);

  return { url, error, loading };
}

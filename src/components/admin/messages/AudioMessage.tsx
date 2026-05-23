import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  /** Either a Supabase Storage URL, a storage path, or a legacy WhatsApp media id */
  mediaUrl: string;
  /** Used as filename fallback when media_url is just a WhatsApp media id */
  wamid?: string | null;
}

const BUCKET = 'voice-messages';
const EXT_FALLBACKS = ['ogg', 'mp3', 'm4a'];

function extractStoragePath(url: string): string | null {
  // Matches /storage/v1/object/{public|sign}/voice-messages/<path>
  const m = url.match(/\/(?:object|sign)\/(?:public\/|authenticated\/)?voice-messages\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AudioMessage({ mediaUrl, wamid }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      setLoading(true);
      setErr(false);
      setSignedUrl(null);

      const candidates: string[] = [];
      const fromUrl = mediaUrl ? extractStoragePath(mediaUrl) : null;
      if (fromUrl) candidates.push(fromUrl);
      if (wamid) EXT_FALLBACKS.forEach((e) => candidates.push(`${wamid}.${e}`));
      // Legacy: media_url itself might be a path like "{id}.ogg"
      if (mediaUrl && !mediaUrl.startsWith('http')) candidates.push(mediaUrl);

      for (const path of candidates) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        if (!cancelled && data?.signedUrl && !error) {
          setSignedUrl(data.signedUrl);
          setLoading(false);
          return;
        }
      }
      if (!cancelled) {
        // Last resort: use original URL (may be public and just work)
        if (mediaUrl?.startsWith('http')) setSignedUrl(mediaUrl);
        else setErr(true);
        setLoading(false);
      }
    }
    go();
    return () => { cancelled = true; };
  }, [mediaUrl, wamid]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground w-[240px]">
        <Loader2 className="w-3 h-3 animate-spin" /> Chargement de l'audio…
      </div>
    );
  }
  if (err || !signedUrl) {
    return <div className="text-[10px] text-destructive">Audio indisponible</div>;
  }
  return (
    <audio
      controls
      preload="metadata"
      src={signedUrl}
      className="w-[240px] max-w-full"
      onError={() => setErr(true)}
    />
  );
}

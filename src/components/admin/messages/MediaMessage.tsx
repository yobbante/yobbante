import { useState } from 'react';
import { FileText, Download, Play, X, Loader2 } from 'lucide-react';
import { AudioMessage } from './AudioMessage';
import { useAuthedMedia } from './useAuthedMedia';

interface Props {
  mediaUrl: string;
  messageType: 'image' | 'audio' | 'voice' | 'video' | 'document' | 'sticker' | string;
  caption?: string | null;
  wamid?: string | null;
}

export function MediaMessage({ mediaUrl, messageType, caption, wamid }: Props) {
  if (messageType === 'audio' || messageType === 'voice') {
    return <AudioMessage mediaUrl={mediaUrl} wamid={wamid ?? null} />;
  }
  return <ProxiedMedia mediaUrl={mediaUrl} messageType={messageType} caption={caption} wamid={wamid} />;
}

function ProxiedMedia({ mediaUrl, messageType, caption, wamid }: Props) {
  const [lightbox, setLightbox] = useState(false);
  const { url: src, error, loading } = useAuthedMedia(mediaUrl);

  const isVisual = messageType === 'image' || messageType === 'sticker' || messageType === 'video';

  if (isVisual && loading) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground w-[240px]">
        <Loader2 className="w-3 h-3 animate-spin" /> Chargement du média…
      </div>
    );
  }

  if (isVisual && (error || !src)) {
    return (
      <div className="text-[10px] text-destructive max-w-[240px]">
        Média indisponible — il n'a pas pu être récupéré auprès de WhatsApp
        (token expiré ou média supprimé côté Meta après ~5 jours).
        {caption && <p className="mt-1 text-muted-foreground">{caption}</p>}
      </div>
    );
  }

  if (messageType === 'image' || messageType === 'sticker') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block overflow-hidden rounded-lg bg-black/10 hover:opacity-90 transition-opacity"
        >
          <img
            src={src!}
            alt={caption ?? 'image'}
            loading="lazy"
            className="max-h-60 max-w-[260px] object-cover"
          />
        </button>
        {caption && <p className="mt-1 text-[11px] opacity-80">{caption}</p>}
        {lightbox && (
          <div
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-white/90 hover:text-white"
              onClick={() => setLightbox(false)}
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={src!}
              alt={caption ?? 'image'}
              className="max-h-[90vh] max-w-[95vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  if (messageType === 'video') {
    return (
      <div className="space-y-1">
        <video
          src={src!}
          controls
          preload="metadata"
          className="max-h-60 max-w-[260px] rounded-lg bg-black"
        >
          <a href={src!} target="_blank" rel="noreferrer">
            <Play className="inline w-4 h-4" /> Voir la vidéo
          </a>
        </video>
        {caption && <p className="text-[11px] opacity-80">{caption}</p>}
      </div>
    );
  }

  // document & fallback
  const fname = caption || (wamid ? `${wamid}` : 'document');
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2 max-w-[260px]">
      <FileText className="w-5 h-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-foreground">{fname}</p>
        <p className="text-[10px] text-muted-foreground">{messageType.toUpperCase()}</p>
      </div>
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : src ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          download={fname}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-[#F5C518] px-2 py-1 text-[10px] font-semibold text-zinc-950 hover:brightness-110"
        >
          <Download className="w-3 h-3" /> Télécharger
        </a>
      ) : (
        <span className="text-[10px] text-destructive">Indispo.</span>
      )}
    </div>
  );
}

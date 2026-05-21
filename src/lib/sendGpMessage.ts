// Helper unifié pour envoyer un message WhatsApp à un GP via l'API send-whatsapp,
// avec fallback automatique sur wa.me en cas d'échec (hors fenêtre 24h, etc.).
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SendGpMessageOptions {
  phone: string;
  message: string;
  transporteur_id?: string;
  dossier_id?: string;
  trigger_type?: string;
  /** Si true, n'affiche pas de toast et n'ouvre pas wa.me automatiquement. */
  silent?: boolean;
  /** Si true, ouvre wa.me en fallback (par défaut true sauf en mode silent). */
  openFallback?: boolean;
}

export interface SendGpMessageResult {
  ok: boolean;
  fallback: boolean;
  waLink: string;
}

export function buildWaLink(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function sendGpMessage(opts: SendGpMessageOptions): Promise<SendGpMessageResult> {
  const digits = (opts.phone || '').replace(/\D/g, '');
  const waLink = buildWaLink(opts.phone, opts.message);

  if (!digits || digits.length < 6) {
    if (!opts.silent) toast.error('Numéro de téléphone manquant');
    return { ok: false, fallback: false, waLink };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        recipient_phone: opts.phone,
        recipient_type: 'gp',
        message: opts.message,
        transporteur_id: opts.transporteur_id,
        dossier_id: opts.dossier_id,
        trigger_type: opts.trigger_type ?? 'admin_direct',
      },
    });

    const status = (data as any)?.status;
    if (!error && status === 'sent') {
      return { ok: true, fallback: false, waLink };
    }
  } catch {
    // bascule en fallback ci-dessous
  }

  const shouldOpen = opts.openFallback !== false && !opts.silent;
  if (shouldOpen) {
    toast.info('Envoi direct impossible, ouverture WhatsApp...');
    window.open(waLink, '_blank', 'noopener,noreferrer');
  }
  return { ok: false, fallback: true, waLink };
}

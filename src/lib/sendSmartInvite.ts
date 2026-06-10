// Wrapper pour appeler gp-smart-invite (premier contact via template hello_world
// si le GP n'a jamais ecrit, sinon texte libre). Notifie le super admin.
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SmartInviteOptions {
  phone: string;
  message: string;
  gp_name?: string;
  gp_ref?: string;
  transporteur_id?: string;
  kind?: 'bot_onboard' | 'konnekt_invite' | 'konnekt_signup';
  trigger_type?: string;
  silent?: boolean;
}

export interface SmartInviteResult {
  ok: boolean;
  fallback_required: boolean;
  wa_link: string;
  has_history?: boolean;
  template_ok?: boolean;
  message_ok?: boolean;
}

export function waLinkFor(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function sendSmartInvite(opts: SmartInviteOptions): Promise<SmartInviteResult> {
  const fallback = waLinkFor(opts.phone, opts.message);
  try {
    const { data, error } = await supabase.functions.invoke('gp-smart-invite', {
      body: {
        phone: opts.phone,
        message: opts.message,
        gp_name: opts.gp_name,
        gp_ref: opts.gp_ref,
        transporteur_id: opts.transporteur_id,
        kind: opts.kind,
        trigger_type: opts.trigger_type,
      },
    });
    if (error) throw error;
    const ok = !!(data as any)?.ok;
    const fallback_required = !!(data as any)?.fallback_required;
    const wa_link = (data as any)?.wa_link ?? fallback;
    if (!opts.silent) {
      if (ok) {
        toast.success('Invitation envoyée via WhatsApp (926)');
      } else {
        toast.error('Hors fenêtre 24h. Envoyez depuis le compte WhatsApp 926 (+221 78 926 97 56).', {
          duration: 8000,
          action: { label: 'Ouvrir wa.me', onClick: () => window.open(wa_link, '_blank', 'noopener,noreferrer') },
        });
        try { window.open(wa_link, '_blank', 'noopener,noreferrer'); } catch { /* noop */ }
      }
    }
    return { ok, fallback_required, wa_link, has_history: (data as any)?.has_history,
      template_ok: (data as any)?.template_ok, message_ok: (data as any)?.message_ok };
  } catch (e) {
    if (!opts.silent) {
      toast.error('Envoi API impossible. Ouvrez WhatsApp pour envoyer manuellement.', {
        action: { label: 'WhatsApp', onClick: () => window.open(fallback, '_blank', 'noopener,noreferrer') },
      });
    }
    return { ok: false, fallback_required: true, wa_link: fallback };
  }
}

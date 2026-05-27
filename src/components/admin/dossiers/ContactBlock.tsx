import { Phone, MessageCircle, Copy, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ContactBlockProps {
  title: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  extra?: string | null;
  accent?: 'sender' | 'recipient';
  whatsappPrefill?: string;
}

function copy(value: string, label = 'Copié') {
  if (!value) return;
  navigator.clipboard?.writeText(value).then(() => toast.success(label));
}

export function ContactBlock({
  title, name, phone, address, extra, accent = 'sender', whatsappPrefill,
}: ContactBlockProps) {
  const digits = (phone || '').replace(/\D/g, '');
  const waText = encodeURIComponent(whatsappPrefill || `Bonjour ${name?.split(' ')[0] || ''},`);
  const waHref = digits ? `https://wa.me/${digits}?text=${waText}` : '';
  const telHref = phone ? `tel:${phone.replace(/\s+/g, '')}` : '';

  const dotColor = accent === 'sender' ? 'bg-blue-500' : 'bg-[#F5C518]';

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {title}
          </span>
        </div>
        {phone && (
          <div className="flex gap-1">
            {telHref && (
              <a
                href={telHref}
                title="Appeler"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-foreground hover:bg-secondary/70 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
            {waHref && (
              <>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  title="Ouvrir WhatsApp"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-500/15 text-green-500 hover:bg-green-500/25 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => copy(waHref, 'Lien WhatsApp copié')}
                  title="Copier le lien wa.me (envoyer depuis mon téléphone)"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-500/10 text-green-500/80 hover:text-green-500 hover:bg-green-500/20 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => copy(phone, 'Numéro copié')}
              title="Copier le numéro"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="font-semibold text-base text-foreground flex items-center gap-1.5">
        {name ? (
          <span className="truncate">{name}</span>
        ) : (
          <span className="text-muted-foreground italic flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Non renseigné
          </span>
        )}
      </div>

      {phone && (
        <div className="text-xs text-muted-foreground font-mono">{phone}</div>
      )}

      {address && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="leading-snug">{address}</span>
        </div>
      )}

      {extra && (
        <div className="text-xs text-muted-foreground">{extra}</div>
      )}
    </div>
  );
}

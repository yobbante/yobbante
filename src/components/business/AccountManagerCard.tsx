import { Sparkles, Phone, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAccountManager } from '@/hooks/useAccountManager';

interface Props { businessId: string }

export function AccountManagerCard({ businessId }: Props) {
  const { manager, loading } = useAccountManager(businessId);

  // Fallback : équipe générique tant qu'aucun manager n'est assigné.
  const m = manager ?? {
    full_name: 'L\'équipe Yobbanté Business',
    email: 'business@yobbante.com',
    phone: null,
    whatsapp: '221786078080',
    photo_url: null,
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div className="flex items-start gap-4 flex-wrap">
        {m.photo_url ? (
          <img src={m.photo_url} alt={m.full_name} className="w-14 h-14 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Votre chargé de compte
          </div>
          <h3 className="text-lg font-bold mt-0.5">{m.full_name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {manager
              ? 'Disponible pour vous accompagner sur tous vos dossiers.'
              : 'Un chargé dédié vous est assigné dès vos premiers envois.'}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {m.whatsapp && (
              <Button asChild size="sm">
                <a
                  href={`https://wa.me/${m.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Bonjour ${m.full_name.split(' ')[0] || ''}, je vous écris au sujet de mon compte Yobbanté Business.`)}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </a>
              </Button>
            )}
            {m.phone && (
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${m.phone}`}>
                  <Phone className="w-4 h-4 mr-2" /> Appeler
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:${m.email}`}>
                <Mail className="w-4 h-4 mr-2" /> Email
              </a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

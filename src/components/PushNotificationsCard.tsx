import { Bell, BellOff, Loader2, Share, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface Props {
  audience: 'admin' | 'chauffeur';
  chauffeurToken?: string;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Encart d'activation des notifications push (VAPID).
 * La permission est demandée uniquement au clic de l'utilisateur.
 */
export function PushNotificationsCard({
  audience,
  chauffeurToken,
  title = 'Notifications push',
  description = 'Recevez les alertes même téléphone verrouillé ou application fermée.',
  className,
}: Props) {
  const { supported, subscribed, busy, denied, needsIosInstall, ios, enable, disable } =
    usePushNotifications({ audience, chauffeurToken });

  if (!supported && !needsIosInstall) return null;

  return (
    <section className={cn('rounded-2xl border border-border bg-card p-3 space-y-2', className)}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {subscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {needsIosInstall ? (
        <div className="rounded-xl bg-muted/60 p-3 text-xs space-y-1.5">
          <p className="font-medium flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" /> Sur iPhone / iPad
          </p>
          <p className="text-muted-foreground">
            Les notifications ne fonctionnent que si l'app est installée sur l'écran d'accueil
            (Safari seul ne les reçoit pas).
          </p>
          <p className="text-muted-foreground flex items-center gap-1">
            <Share className="w-3.5 h-3.5 shrink-0" />
            Appuyez sur <strong>Partager</strong> puis <strong>« Sur l'écran d'accueil »</strong>,
            rouvrez l'app depuis l'icône, et revenez activer les notifications.
          </p>
        </div>
      ) : denied && !subscribed ? (
        <p className="text-xs text-destructive">
          Notifications bloquées pour ce site. Autorisez-les dans les réglages du navigateur, puis réessayez.
        </p>
      ) : subscribed ? (
        <Button variant="outline" className="w-full h-11" onClick={disable} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BellOff className="w-4 h-4 mr-2" /> Désactiver sur cet appareil</>}
        </Button>
      ) : (
        <Button className="w-full h-11" onClick={enable} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Bell className="w-4 h-4 mr-2" /> Activer les notifications</>}
        </Button>
      )}

      {!needsIosInstall && ios && (
        <p className="text-[11px] text-muted-foreground">
          iPhone : l'app doit rester installée sur l'écran d'accueil pour recevoir les alertes.
        </p>
      )}
    </section>
  );
}

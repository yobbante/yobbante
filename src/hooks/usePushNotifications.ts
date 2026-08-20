import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  disablePush,
  enablePush,
  getExistingSubscription,
  iosNeedsInstall,
  isIosDevice,
  pushSupported,
  type EnableResult,
} from '@/lib/push';

interface Options {
  audience: 'admin' | 'chauffeur';
  chauffeurToken?: string;
}

/**
 * Notifications push (téléphone verrouillé / app fermée).
 * La permission n'est demandée que dans `enable()` — jamais au chargement.
 */
export function usePushNotifications({ audience, chauffeurToken }: Options) {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();
  const needsIosInstall = iosNeedsInstall();
  const ios = isIosDevice();
  const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied';

  useEffect(() => {
    let alive = true;
    getExistingSubscription()
      .then((s) => { if (alive) setSubscribed(!!s); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const res: EnableResult = await enablePush({ audience, chauffeurToken });
      if (res.ok === true) {
        setSubscribed(true);
        toast.success('Notifications activées sur cet appareil');
        return true;
      }
      const { reason, detail } = res;
      if (reason === 'ios_install_required') {
        toast.error("Sur iPhone, installez d'abord l'app : Partager → Ajouter à l'écran d'accueil");
      } else if (reason === 'denied') {
        toast.error('Notifications refusées. Autorisez-les dans les réglages du navigateur.');
      } else if (reason === 'unsupported') {
        toast.error('Ce navigateur ne gère pas les notifications push.');
      } else {
        toast.error(detail || 'Activation impossible');
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, [audience, chauffeurToken]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush({ audience, chauffeurToken });
      setSubscribed(false);
      toast.success('Notifications désactivées sur cet appareil');
    } finally {
      setBusy(false);
    }
  }, [audience, chauffeurToken]);

  return { supported, subscribed, busy, denied, ios, needsIosInstall, enable, disable };
}

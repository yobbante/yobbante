import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { SendFlow } from '@/components/flows/SendFlow';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { FlowCompactHeader } from '@/components/flows/FlowPrimitives';

type Mode = 'envoyer' | 'recevoir';

/**
 * /expedier  → écran fusionné : sélection en haut + flow inline dessous.
 * /expedier/envoyer & /expedier/recevoir restent valides (deep links) et
 * ouvrent directement le flow correspondant.
 */
export default function ExpedierPage() {
  const { mode: urlMode } = useParams<{ mode?: Mode }>();
  // No more selection screen: /expedier defaults directly to "envoyer".
  const [mode, setMode] = useState<Mode>((urlMode as Mode) ?? 'envoyer');

  useEffect(() => { setMode((urlMode as Mode) ?? 'envoyer'); }, [urlMode]);

  useEffect(() => {
    document.title =
      mode === 'envoyer'  ? 'Envoyer un colis · Yobbanté' :
      mode === 'recevoir' ? 'Recevoir une commande · Yobbanté' :
                            'Expédier un colis · Yobbanté';
  }, [mode]);

  function selectMode(m: Mode) {
    setMode(m);
    // sync URL without reload, for shareable deep links
    window.history.replaceState({}, '', `/expedier/${m}`);
  }
  function swapMode() {
    const next: Mode = mode === 'envoyer' ? 'recevoir' : 'envoyer';
    setMode(next);
    window.history.replaceState({}, '', `/expedier/${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─────────── FLOW MODE: render dedicated flow with compact header ───────────
  const header = (
    <FlowCompactHeader
      eyebrow={mode === 'envoyer' ? 'Expédier · Envoyer' : 'Expédier · Recevoir'}
      title={mode === 'envoyer' ? 'Envoyer un colis' : 'Recevoir une commande'}
      onSwap={swapMode}
      swapLabel={mode === 'envoyer' ? 'Recevoir plutôt' : 'Envoyer plutôt'}
      theme={mode === 'envoyer' ? 'light' : 'dark'}
      secondaryAction={
        mode === 'recevoir'
          ? {
              label: 'Mes commandes',
              icon: <ListChecks className="w-3.5 h-3.5" />,
              variant: 'accent',
              onClick: () =>
                window.dispatchEvent(new CustomEvent('yobbante:receive-flow:goto', { detail: { step: 'orders' } })),
            }
          : undefined
      }
    />
  );
  return mode === 'envoyer'
    ? <SendFlow compactHeader={header} />
    : <ReceiveFlow compactHeader={header} />;
}


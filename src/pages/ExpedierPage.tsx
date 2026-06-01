import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SendFlow } from '@/components/flows/SendFlow';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { ExpedierSearchBar, type ExpedierMode } from '@/components/expedier/ExpedierSearchBar';
import { useSeo } from '@/hooks/useSeo';

/**
 * /expedier — barre de recherche unifiée (Envoyer / Sourcing / Réception)
 * toujours visible en haut + flow correspondant en-dessous.
 *
 * Tab Sourcing → redirige vers /sourcing (page dédiée qui monte la même barre).
 */
export default function ExpedierPage() {
  const { mode: urlMode } = useParams<{ mode?: 'envoyer' | 'recevoir' }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'envoyer' | 'recevoir'>(urlMode ?? 'envoyer');
  const [flowKey, setFlowKey] = useState(0);

  useEffect(() => { setMode(urlMode ?? 'envoyer'); }, [urlMode]);

  useSeo(
    mode === 'recevoir'
      ? {
          title: 'Réception Amazon, AliExpress, eBay à Dakar | Yobbanté',
          description: 'Commandez sur Amazon, AliExpress ou eBay avec notre adresse relais. Yobbanté réceptionne et livre à Dakar.',
          path: '/reception',
        }
      : {
          title: 'Envoyer un colis depuis Dakar — Devis gratuit | Yobbanté',
          description: 'Obtenez votre prix en 30 secondes. Paiement Wave et Orange Money. Collecte gratuite.',
          path: '/expedier',
        }
  );

  const handleModeChange = (next: ExpedierMode) => {
    if (next === 'sourcing') { navigate('/sourcing'); return; }
    setMode(next);
    navigate(`/expedier/${next}`, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bar = (
    <ExpedierSearchBar
      mode={mode}
      onModeChange={handleModeChange}
      onApply={() => {
        // For "envoyer", we keep the SendFlow mounted so the user doesn't
        // lose the form they've already filled — SendFlow listens to
        // `send-preset-updated` and refreshes route/poids/mode in place.
        if (mode === 'envoyer') {
          window.dispatchEvent(new Event('send-preset-updated'));
        } else {
          setFlowKey(k => k + 1);
        }
      }}
      defaultExpanded
    />
  );

  return mode === 'envoyer'
    ? <SendFlow key="send" compactHeader={bar} />
    : <ReceiveFlow key={`receive-${flowKey}`} compactHeader={bar} />;
}

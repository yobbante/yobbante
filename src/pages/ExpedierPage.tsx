import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SendFlow } from '@/components/flows/SendFlow';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { ExpedierSearchBar, type ExpedierMode } from '@/components/expedier/ExpedierSearchBar';
import { useSeo } from '@/hooks/useSeo';

/**
 * /expedier  → barre de recherche unifiée (Envoyer / Sourcing / Réception)
 * toujours visible en haut + flow correspondant en-dessous.
 *
 * - /expedier         → mode 'envoyer' par défaut
 * - /expedier/envoyer | /expedier/recevoir → deep links, barre + flow déjà
 *   pré-sélectionné. Sourcing route vers /sourcing (page dédiée).
 * - Au "Continuer" de la barre, le préréglage est écrit dans le store
 *   lu par le flow (sessionStorage send-flow:preset ou localStorage
 *   yobbante.landing.preferredHub + URL ?origin=) et le flow est
 *   remonté via `flowKey` pour consommer le préréglage.
 */
export default function ExpedierPage() {
  const { mode: urlMode } = useParams<{ mode?: ExpedierMode }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<ExpedierMode>((urlMode as ExpedierMode) ?? 'envoyer');
  const [flowKey, setFlowKey] = useState(0);

  useEffect(() => {
    const next = (urlMode as ExpedierMode) ?? 'envoyer';
    setMode(next);
  }, [urlMode]);

  useSeo(
    mode === 'recevoir'
      ? {
          title: 'Réception Amazon, AliExpress, eBay à Dakar | Yobbanté',
          description: 'Commandez sur Amazon, AliExpress ou eBay avec notre adresse relais. Yobbanté réceptionne et livre à Dakar.',
          path: '/reception',
        }
      : {
          title: 'Envoyer un colis à l\'international | Yobbanté',
          description: 'Expédiez vos colis depuis Dakar vers le monde entier. Aérien, maritime, routier — Yobbanté gère tout.',
          path: '/expedier',
        }
  );

  const handleModeChange = (next: ExpedierMode) => {
    setMode(next);
    navigate(`/expedier/${next}`, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bar = (
    <ExpedierSearchBar
      mode={mode}
      onModeChange={handleModeChange}
      onApply={() => setFlowKey(k => k + 1)}
      defaultExpanded
    />
  );

  return mode === 'envoyer'
    ? <SendFlow key={`send-${flowKey}`} compactHeader={bar} />
    : <ReceiveFlow key={`receive-${flowKey}`} compactHeader={bar} />;
}

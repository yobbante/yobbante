import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SourcingFlow } from '@/components/flows/SourcingFlow';
import { ExpedierSearchBar, type ExpedierMode } from '@/components/expedier/ExpedierSearchBar';
import { useSeo } from '@/hooks/useSeo';

/**
 * /sourcing — monte la barre de recherche unifiée (tab Sourcing actif)
 * + SourcingFlow en-dessous. Changer de tab redirige vers /expedier/...
 */
export default function SourcingPage() {
  const navigate = useNavigate();
  const [flowKey, setFlowKey] = useState(0);

  useSeo({
    title: 'Sourcing international — On achète pour vous | Yobbanté',
    description: "Vous cherchez un produit introuvable au Sénégal ? Yobbanté l'achète pour vous en France, Chine, USA et vous le livre à Dakar.",
    path: '/sourcing',
  });

  const handleModeChange = (next: ExpedierMode) => {
    if (next === 'sourcing') return;
    navigate(`/expedier/${next}`);
  };

  return (
    <SourcingFlow
      key={`sourcing-${flowKey}`}
      compactHeader={
        <ExpedierSearchBar
          mode="sourcing"
          onModeChange={handleModeChange}
          onApply={() => setFlowKey(k => k + 1)}
          defaultExpanded
        />
      }
    />
  );
}

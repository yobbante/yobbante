import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SourcingFlow } from '@/components/flows/SourcingFlow';
import { ExpedierSearchBar, type ExpedierMode } from '@/components/expedier/ExpedierSearchBar';
import { useSeo } from '@/hooks/useSeo';
import { useJsonLd } from '@/hooks/useJsonLd';

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
    <>
      <h1 className="sr-only">Sourcing produit international — Yobbanté achète et livre à Dakar</h1>
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
      <SourcingJsonLd />
    </>
  );
}

function SourcingJsonLd() {
  useJsonLd('jsonld-sourcing-service', {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Sourcing produit international Yobbanté',
    serviceType: 'International product sourcing & import',
    provider: { '@type': 'Organization', name: 'Yobbanté', url: 'https://yobbante.com' },
    areaServed: ['SN', 'FR', 'CN', 'US', 'AE'],
    description: "Recherche, achat et import de produits depuis la France, la Chine, les USA et Dubai vers Dakar avec dédouanement inclus.",
    offers: { '@type': 'Offer', priceCurrency: 'XOF', availability: 'https://schema.org/InStock' },
    url: 'https://yobbante.com/sourcing',
  });
  return null;
}

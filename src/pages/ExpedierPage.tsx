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

  // Hydrate sessionStorage preset from URL params so deep-links from WhatsApp
  // (ex: /expedier?destination=FR&destination_city=Paris&weight=5&type=docs)
  // pre-fill SendFlow on mount.
  useEffect(() => {
    if ((urlMode ?? 'envoyer') !== 'envoyer') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const dest = sp.get('destination') || sp.get('country');
      const destCity = sp.get('destination_city') || sp.get('dest_city') || sp.get('dest');
      const origin = sp.get('origin') || (dest || destCity ? 'SN' : null);
      const originCity = sp.get('origin_city') || (origin === 'SN' ? 'Dakar' : undefined);
      const weight = sp.get('weight');
      const transport = (sp.get('transport') || 'AIR').toUpperCase();
      const contentType = sp.get('type') || sp.get('content_type');
      if (!dest && !destCity && !weight && !contentType) return;
      const existing = (() => {
        try { return JSON.parse(sessionStorage.getItem('send-flow:preset') || 'null') || {}; } catch { return {}; }
      })();
      const preset = {
        ...existing,
        ...(origin ? { origin } : {}),
        ...(originCity ? { origin_city: originCity } : {}),
        ...(dest ? { destination: dest } : {}),
        ...(destCity ? { destination_city: destCity } : {}),
        ...(weight ? { weight: Number(weight) || undefined } : {}),
        ...(['AIR', 'SEA', 'ROAD'].includes(transport) ? { transport: transport as 'AIR' | 'SEA' | 'ROAD' } : {}),
        ...(contentType ? { content_type: contentType } : {}),
        source: sp.get('source') || 'whatsapp-bot',
      };
      sessionStorage.setItem('send-flow:preset', JSON.stringify(preset));
    } catch {}
  }, [urlMode]);

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

  const h1Text = mode === 'recevoir'
    ? 'Recevoir un colis depuis Amazon, AliExpress ou eBay à Dakar'
    : 'Expédier un colis depuis Dakar vers le monde';

  return (
    <>
      <h1 className="sr-only">{h1Text}</h1>
      {mode === 'envoyer'
        ? <SendFlow key="send" compactHeader={bar} />
        : <ReceiveFlow key={`receive-${flowKey}`} compactHeader={bar} />}
    </>
  );
}

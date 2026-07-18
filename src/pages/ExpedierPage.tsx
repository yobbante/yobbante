import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SendFlow } from '@/components/flows/SendFlow';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { ExpedierSearchBar, type ExpedierMode } from '@/components/expedier/ExpedierSearchBar';
import { useSeo } from '@/hooks/useSeo';
import { useJsonLd } from '@/hooks/useJsonLd';

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
  // pre-fill SendFlow on mount. All params are validated to avoid injecting
  // garbage from a copy-pasted / tampered link.
  useEffect(() => {
    if ((urlMode ?? 'envoyer') !== 'envoyer') return;
    try {
      const sp = new URLSearchParams(window.location.search);

      // ISO-2 country code: exactly two A-Z letters (uppercased).
      const isCountry = (v: string | null): v is string =>
        !!v && /^[A-Za-z]{2}$/.test(v);
      const asCountry = (v: string | null) => (isCountry(v) ? v!.toUpperCase() : null);

      // City / content_type: keep human-readable but strip control chars,
      // trim, cap to reasonable length.
      const asText = (v: string | null, max = 60) => {
        if (!v) return null;
        const cleaned = v.replace(/[\x00-\x1F<>]/g, '').trim().slice(0, max);
        return cleaned || null;
      };

      // Weight: 0.1 – 100 kg, otherwise ignore.
      const asWeight = (v: string | null) => {
        if (!v) return null;
        const n = Number(v.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0.1 || n > 100) return null;
        return n;
      };

      const dest = asCountry(sp.get('destination') || sp.get('country'));
      const destCity = asText(sp.get('destination_city') || sp.get('dest_city') || sp.get('dest'));
      const origin = asCountry(sp.get('origin')) ?? (dest || destCity ? 'SN' : null);
      const originCity = asText(sp.get('origin_city')) ?? (origin === 'SN' ? 'Dakar' : null);
      const weight = asWeight(sp.get('weight'));
      const transportRaw = (sp.get('transport') || 'AIR').toUpperCase();
      const transport = (['AIR', 'SEA', 'ROAD'] as const).includes(transportRaw as never)
        ? (transportRaw as 'AIR' | 'SEA' | 'ROAD')
        : null;
      const contentType = asText(sp.get('type') || sp.get('content_type'), 40);
      const source = asText(sp.get('source'), 40) || 'whatsapp-bot';

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
        ...(weight !== null ? { weight } : {}),
        ...(transport ? { transport } : {}),
        ...(contentType ? { content_type: contentType } : {}),
        source,
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

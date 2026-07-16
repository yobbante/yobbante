import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ratePerKgForCorridor } from '@/lib/startingPrice';
import {
  calculatePricing, fcfaToEur, assertPriceCoherence,
  type PricingOutput,
} from '@/lib/pricingEngine';
import {
  calculerFraisEnlevement, type DakarZoneCategory,
} from '@/lib/dakarZones';
import { eurFromLocal, type CountryProfile } from '@/lib/countryProfile';

type Forfait = {
  id: string; nom: string; description: string | null;
  destination: string; mode: string; prix_fcfa: number;
};

type CityLite = { city: string; country: string } | null | undefined;

export type UseSendPricingInput = {
  // Route
  originCity: CityLite;
  destCity: CityLite;
  originProfile: CountryProfile;
  direction: 'from_dakar' | 'to_dakar';

  // Adresses (pour zone Dakar)
  pickupAddress: string;
  pickupQuartier: string;
  deliveryAddress: string;

  // Colis
  weight: number;
  goodsType: string | null;
  declaredLocal: string;

  // Transport
  transportMode: 'AIR' | 'SEA' | 'ROAD';
  priority: 'normal' | 'express';
  insurance: 'none' | 'standard' | 'premium';

  // Forfait produit
  forfaitId: string | null;
  forfaitQty: number;
  setForfaitId: (v: string | null) => void;

  // Chosen match option (pour volatilité)
  chosen: { price_eur: number } | null;
  quote: { price_eur: number } | null | undefined;
};

export type UseSendPricingOutput = {
  pricing: PricingOutput;
  totalEur: number;
  toEurFcfa: (fcfa: number) => number;
  fraisEnlevement: {
    zone: DakarZoneCategory;
    surcharge: number;
    gratuit: boolean;
    message: string;
    montant?: number;
  };
  priceVolatilityCoeff: number;
  forfaits: Forfait[];
  selectedForfait: Forfait | null;
  // Diagnostics (rarely consumed, but kept accessible)
  declaredEur: number;
};

/**
 * Encapsule tous les calculs de tarification du flow d'expédition :
 * chargement des forfaits produits, coefficient de volatilité, frais
 * d'enlèvement Dakar, pricing engine v3 (source unique de vérité).
 *
 * Aucun changement de comportement vs. l'inline précédent — même
 * séquence de useMemo/useEffect, mêmes dépendances.
 */
export function useSendPricing(input: UseSendPricingInput): UseSendPricingOutput {
  const {
    originCity, destCity, originProfile, direction,
    pickupAddress, pickupQuartier, deliveryAddress,
    weight, goodsType, declaredLocal,
    transportMode, priority, insurance,
    forfaitId, forfaitQty, setForfaitId,
    chosen, quote,
  } = input;

  // ── Prix transport brut (moteur) + volatilité stable session
  const rawTransportEur = quote
    ? Math.round(quote.price_eur)
    : chosen ? Math.round(chosen.price_eur) : 0;
  const priceVolatilityCoeff = useMemo(() => Math.random() * 0.06 + 0.97, []);
  // (transportPriceEur = chosen ? raw : raw*coeff — actuellement non consommé côté UI)
  void rawTransportEur;

  // ── Coût d'assurance (basé sur valeur déclarée en FCFA)
  const declaredFcfaForInsurance = Math.max(
    0,
    Math.round(
      (declaredLocal ? eurFromLocal(Number(declaredLocal) || 0, originProfile) : 0) * 655,
    ),
  );
  const insuranceCostFcfa = insurance === 'standard'
    ? Math.max(Math.round(declaredFcfaForInsurance * 0.005), 500)
    : insurance === 'premium'
      ? Math.max(Math.round(declaredFcfaForInsurance * 0.01), 1000)
      : 0;

  // ── Surcoût enlèvement / livraison à Dakar
  const isFromDakar = direction === 'from_dakar';
  const dakarAddress = isFromDakar
    ? (pickupQuartier || pickupAddress)
    : (pickupQuartier || deliveryAddress);
  const fraisEnlevement = (isFromDakar
    ? pickupAddress.trim() || pickupQuartier
    : deliveryAddress.trim() || pickupQuartier)
    ? calculerFraisEnlevement(dakarAddress)
    : { montant: 5000, surcharge: 0, gratuit: true, zone: 'dakar_centre' as DakarZoneCategory, message: '' };

  // ── Forfaits produits — fetch actifs pour destination + mode
  const [forfaits, setForfaits] = useState<Forfait[]>([]);
  useEffect(() => {
    const destCountry = destCity?.country;
    if (!destCountry) { setForfaits([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('product_forfaits' as never)
        .select('id, nom, description, destination, mode, prix_fcfa')
        .eq('actif', true)
        .in('destination', [destCountry, 'ALL'])
        .in('mode', [transportMode, 'ALL']);
      if (cancelled || error) return;
      setForfaits((data as unknown as Forfait[]) || []);
    })();
    return () => { cancelled = true; };
  }, [destCity?.country, transportMode]);

  const selectedForfait = useMemo(
    () => forfaits.find(f => f.id === forfaitId) ?? null,
    [forfaits, forfaitId],
  );
  // Reset forfait si plus dispo
  useEffect(() => {
    if (forfaitId && !forfaits.find(f => f.id === forfaitId)) setForfaitId(null);
  }, [forfaits, forfaitId, setForfaitId]);

  // Coefficient marchandise (pour calculer le tarif synthétique)
  const _goodsCoef = (() => {
    const map: Record<string, number> = {
      standard: 1, electronics: 1.08, fragile: 1.10, fashion: 1.02,
      cosmetics: 1.02, food: 0.98, high_value: 1.12, documents: 0.95, auto_parts: 1.07,
    };
    return goodsType ? (map[goodsType] ?? 1) : 1;
  })();

  // ── SOURCE UNIQUE DE VÉRITÉ — pricing engine v3 (FCFA)
  const effectiveTarifGP = useMemo(() => {
    if (selectedForfait) {
      const w = Math.max(0.5, weight);
      const qty = Math.max(1, forfaitQty);
      return Math.max(1, (selectedForfait.prix_fcfa * qty) / (w * _goodsCoef));
    }
    return ratePerKgForCorridor(originCity?.country, destCity?.country);
  }, [selectedForfait, forfaitQty, weight, _goodsCoef, originCity?.country, destCity?.country]);

  const pricing: PricingOutput = useMemo(() => calculatePricing({
    tarifGPFcfa: effectiveTarifGP,
    weightKg: weight,
    marchandise: goodsType,
    enlevementFcfa: fraisEnlevement.surcharge,
    assuranceFcfa: insuranceCostFcfa,
    transportMode: transportMode,
  }, priority === 'express' ? 'express' : 'standard'),
    [effectiveTarifGP, weight, goodsType, fraisEnlevement.surcharge, insuranceCostFcfa, priority, transportMode]);

  const toEurFcfa = (fcfa: number) => fcfaToEur(fcfa);
  const totalEur = toEurFcfa(pricing.total_ttc);

  // ── DEV : garde-fou anti-divergence
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const check = calculatePricing({
      tarifGPFcfa: effectiveTarifGP,
      weightKg: weight,
      marchandise: goodsType,
      enlevementFcfa: fraisEnlevement.surcharge,
      assuranceFcfa: insuranceCostFcfa,
      transportMode: transportMode,
    }, priority === 'express' ? 'express' : 'standard');
    assertPriceCoherence('SendFlow.pricing', check.total_ttc, pricing.total_ttc);
    assertPriceCoherence('SendFlow.prix_standard', check.prix_standard, pricing.prix_standard);
    assertPriceCoherence('SendFlow.prix_express', check.prix_express, pricing.prix_express);
  }, [pricing, originCity?.country, destCity?.country, weight, goodsType, fraisEnlevement.surcharge, insuranceCostFcfa, priority, effectiveTarifGP, transportMode]);

  const declaredEur = declaredLocal ? eurFromLocal(Number(declaredLocal) || 0, originProfile) : 0;

  return {
    pricing,
    totalEur,
    toEurFcfa,
    fraisEnlevement,
    priceVolatilityCoeff,
    forfaits,
    selectedForfait,
    declaredEur,
  };
}

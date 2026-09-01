/**
 * Sourcing / Relais D — tarification.
 *
 * Règle produit : UN SEUL total tout compris = produits (taux de change MAJORÉ)
 * + acheminement estimé (grille Aérien existante selon le pays du relais).
 * Aucune ligne "frais de service" séparée, aucun complément demandé après paiement.
 */

import { supabase } from '@/integrations/supabase/client';
import { AIR_ZONES, estimateAirFreight, type AirZone } from '@/lib/airFreight';

/** Taux de change de base (1 unité de devise -> FCFA). */
export const BASE_FX: Record<string, number> = {
  EUR: 655.957,
  USD: 610,
  GBP: 780,
  CNY: 85,
  AED: 166,
  XOF: 1,
};

export const CURRENCIES = Object.keys(BASE_FX);

/** Pays du relais Yobbanté par marchand (Partie 5 du parcours). */
export const SITE_RELAY: Record<string, 'FR' | 'US' | 'CN'> = {
  amazon: 'FR', zara: 'FR', hm: 'FR', 'h&m': 'FR', decathlon: 'FR',
  nike: 'US', ebay: 'US',
  alibaba: 'CN', aliexpress: 'CN', temu: 'CN', shein: 'CN',
};

export function relayForSite(site: string): 'FR' | 'US' | 'CN' {
  const key = site.trim().toLowerCase().replace(/\s+/g, '');
  return SITE_RELAY[key] ?? 'FR';
}

export const RELAY_LABEL: Record<string, string> = {
  FR: 'Relais Yobbanté France (Paris)',
  US: 'Relais Yobbanté USA (Miami)',
  CN: 'Relais Yobbanté Chine (Guangzhou)',
};

/** Devise usuelle du marchand selon le pays du relais. */
export const RELAY_CURRENCY: Record<string, string> = { FR: 'EUR', US: 'USD', CN: 'CNY' };

/** Zone aérienne utilisée pour l'acheminement relais -> Dakar. */
export function airZoneForRelay(relay: string): AirZone | null {
  const id = relay === 'FR' ? 'A1' : relay === 'US' ? 'A3' : 'A3';
  return AIR_ZONES.find(z => z.id === id) ?? null;
}

/** Marge (%) appliquée au taux de change standard — configurable dans Paramètres. */
export async function fetchFxMarkupPercent(): Promise<number> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'fx_markup')
    .maybeSingle();
  const pct = Number((data?.value as { percent?: number } | null)?.percent);
  return Number.isFinite(pct) ? pct : 8;
}

export async function saveFxMarkupPercent(percent: number) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'fx_markup', value: { percent } }, { onConflict: 'key' });
  if (error) throw error;
}

export function convertToXof(amount: number, currency: string, markupPercent: number): number {
  const rate = BASE_FX[currency] ?? BASE_FX.EUR;
  return Math.round(amount * rate * (1 + markupPercent / 100));
}

export interface SourcingLine {
  site: string;
  relay_country: string;
  qty: number;
  price_amount: number | null;
  price_currency: string | null;
  weight_kg: number | null;
}

export interface SourcingTotals {
  productsXof: number;
  shippingXof: number;
  totalXof: number;
  /** Détail par relais : poids cumulé et coût d'acheminement. */
  perRelay: { relay: string; weightKg: number; shippingXof: number }[];
  allPriced: boolean;
  allWeighed: boolean;
}

export function computeSourcingTotals(lines: SourcingLine[], markupPercent: number): SourcingTotals {
  let productsXof = 0;
  const weights = new Map<string, number>();

  for (const l of lines) {
    const qty = Math.max(1, Number(l.qty) || 1);
    if (l.price_amount != null) {
      productsXof += convertToXof(Number(l.price_amount) * qty, l.price_currency || 'EUR', markupPercent);
    }
    if (l.weight_kg != null) {
      const relay = l.relay_country || 'FR';
      weights.set(relay, (weights.get(relay) ?? 0) + Number(l.weight_kg) * qty);
    }
  }

  const perRelay = [...weights.entries()].map(([relay, weightKg]) => {
    const est = estimateAirFreight({ zone: airZoneForRelay(relay), realKg: weightKg });
    return { relay, weightKg: Math.round(weightKg * 100) / 100, shippingXof: est.price ?? 0 };
  });

  const shippingXof = perRelay.reduce((s, r) => s + r.shippingXof, 0);

  return {
    productsXof,
    shippingXof,
    totalXof: productsXof + shippingXof,
    perRelay,
    allPriced: lines.length > 0 && lines.every(l => l.price_amount != null),
    allWeighed: lines.length > 0 && lines.every(l => l.weight_kg != null && Number(l.weight_kg) > 0),
  };
}

export const fmtXof = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export const SOURCING_QUOTE_DISCLAIMER =
  "Frais d'acheminement estimés et légèrement majorés pour vous garantir qu'aucun complément ne vous sera jamais demandé.";

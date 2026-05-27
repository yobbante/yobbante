// Yobbanté pricing helpers — client-side display logic.
// IMPORTANT : ne jamais exposer le tarif GP brut ou la marge au client.
// Le calcul de référence est dans la fonction SQL `calculate_dossier_pricing`.

import { supabase } from '@/integrations/supabase/client';
import type { DakarZoneCategory } from '@/lib/dakarZones';

export const YOBBANTE_MARGIN_PCT = 0.20;
export const EXPRESS_COEFFICIENT = 1.45;

/**
 * Frais d'enlèvement UNIQUE par zone (jamais cumulés avec un autre surcoût).
 * - dakar_centre   : 5 000  FCFA (intégré)
 * - dakar_banlieue : 10 000 FCFA
 * - hors_dakar     : 15 000 FCFA
 */
export const ENLEVEMENT_BY_ZONE: Record<DakarZoneCategory, number> = {
  dakar_centre: 5000,
  dakar_banlieue: 10000,
  hors_dakar: 15000,
};

// Conservé pour rétro-compat (anciens imports). NE PAS cumuler.
export const ENLEVEMENT_INTEGRE = ENLEVEMENT_BY_ZONE.dakar_centre;

const DAKAR_ZONES = [
  'dakar', 'pikine', 'guediawaye', 'rufisque',
  'bargny', 'sebikotane', 'diamniadio',
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Renvoie true si l'adresse est dans l'agglomération de Dakar (enlèvement gratuit). */
export function isDakarZone(address?: string | null): boolean {
  if (!address || !address.trim()) return true;
  const v = normalize(address);
  return DAKAR_ZONES.some((z) => v.includes(z));
}

/** Retourne le montant unique d'enlèvement selon la zone. */
export function enlevementForZone(
  zone?: DakarZoneCategory | string | null,
): number {
  if (!zone) return ENLEVEMENT_BY_ZONE.dakar_centre;
  const z = String(zone) as DakarZoneCategory;
  return ENLEVEMENT_BY_ZONE[z] ?? ENLEVEMENT_BY_ZONE.dakar_centre;
}

export interface DisplayPrices {
  perKgStandard: number;
  perKgExpress: number;
  totalStandard: number;
  totalExpress: number;
  enlevement: number;
  isEstimate: boolean;
}

/**
 * Formule officielle (cf. spec QA 27/05/2026) :
 *   total = poids × tarif_gp × (1 + marge) + enlevement_zone
 * Un SEUL frais d'enlèvement selon la zone. Pas de cumul.
 */
export function computeDisplayPrices(opts: {
  gpRatePerKg: number;
  weightKg: number;
  zone?: DakarZoneCategory | string | null;
  /** @deprecated utiliser `zone` */
  outsideDakar?: boolean;
  carrierCost?: number;
  isEstimate?: boolean;
  marginPct?: number;
  expressCoeff?: number;
}): DisplayPrices {
  const margin = opts.marginPct ?? YOBBANTE_MARGIN_PCT;
  const exp = opts.expressCoeff ?? EXPRESS_COEFFICIENT;
  const w = Math.max(0.5, opts.weightKg || 0);

  const baseKg = opts.gpRatePerKg * (1 + margin);
  const expressKg = baseKg * exp;

  const zone: DakarZoneCategory =
    (opts.zone as DakarZoneCategory) ??
    (opts.outsideDakar ? 'hors_dakar' : 'dakar_centre');
  const enlevement = enlevementForZone(zone);
  const carrier = opts.carrierCost ?? 0;

  return {
    perKgStandard: Math.round(baseKg),
    perKgExpress: Math.round(expressKg),
    totalStandard: Math.round(baseKg * w + enlevement + carrier),
    totalExpress: Math.round(expressKg * w + enlevement + carrier),
    enlevement,
    isEstimate: opts.isEstimate ?? false,
  };
}

export function formatFcfa(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  return `${v.toLocaleString('fr-FR')} FCFA`;
}

/** Récupère le tarif par défaut d'un pays/ville depuis route_default_rates. */
export async function fetchDefaultRate(country?: string | null, city?: string | null): Promise<{
  ratePerKg: number;
  expressCoeff: number;
  zone: string;
}> {
  try {
    const { data } = await supabase.rpc('lookup_default_rate' as any, {
      p_country: country ?? null,
      p_city: city ?? null,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      return {
        ratePerKg: Number(row.rate_per_kg) || 6000,
        expressCoeff: Number(row.express_coeff) || EXPRESS_COEFFICIENT,
        zone: String(row.zone || 'europe_ouest'),
      };
    }
  } catch {
    // fallback ci-dessous
  }
  return { ratePerKg: 6000, expressCoeff: EXPRESS_COEFFICIENT, zone: 'europe_ouest' };
}

// Yobbanté pricing helpers — client-side display logic.
// IMPORTANT : ne jamais exposer le tarif GP brut ou la marge au client.
// Le calcul de référence est dans la fonction SQL `calculate_dossier_pricing`.

import { supabase } from '@/integrations/supabase/client';

export const YOBBANTE_MARGIN_PCT = 0.20;
export const EXPRESS_COEFFICIENT = 1.45;
export const ENLEVEMENT_INTEGRE = 5000; // FCFA, jamais affiché séparément
export const HORS_DAKAR_SURCHARGE = 5000; // FCFA, affiché séparément

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

export interface DisplayPrices {
  perKgStandard: number;
  perKgExpress: number;
  totalStandard: number;
  totalExpress: number;
  outsideDakarSurcharge: number;
  isEstimate: boolean;
}

/**
 * Calcule les prix affichés au client à partir d'un tarif GP au kg.
 * NE PAS afficher gpRate, ni la marge.
 */
export function computeDisplayPrices(opts: {
  gpRatePerKg: number;
  weightKg: number;
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

  const outsideSurcharge = opts.outsideDakar ? HORS_DAKAR_SURCHARGE : 0;
  const carrier = opts.carrierCost ?? 0;

  return {
    perKgStandard: Math.round(baseKg),
    perKgExpress: Math.round(expressKg),
    totalStandard: Math.round(baseKg * w + ENLEVEMENT_INTEGRE + outsideSurcharge + carrier),
    totalExpress: Math.round(expressKg * w + ENLEVEMENT_INTEGRE + outsideSurcharge + carrier),
    outsideDakarSurcharge: outsideSurcharge,
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

/**
 * Calcul d'un devis — simple ROUTAGE vers les moteurs existants.
 * Aucun barème n'est défini ici : international → `pricingEngine.ts`,
 * Terminal D → `fretPricing.ts` (grilles en base).
 */
import { calculatePricing } from '@/lib/pricingEngine';
import { ratePerKgForCorridor } from '@/lib/startingPrice';
import { countryForCity } from '@/lib/worldCities';
import {
  quoteInternational, quoteNational,
  type ColisSize, type FretDestination, type FretZone,
} from '@/lib/fretPricing';
import type { DevisEngine, DevisLine } from '@/lib/devis';

export interface DevisComputeInput {
  engine: DevisEngine;
  /** Libellé ville "Paris, France" ou nom simple — le pays est dérivé. */
  origin?: string | null;
  destination?: string | null;
  weightKg?: number | null;
  size?: ColisSize | null;
  express?: boolean;
  /** Grilles Terminal D (requises pour les moteurs fret). */
  zones?: FretZone[];
  destinations?: FretDestination[];
}

export interface DevisComputeResult {
  lines: DevisLine[];
  total: number;
  /** Hors grille → devis sur mesure obligatoire, pas de prix. */
  manualQuote: boolean;
  /** Message clair pour l'agent / le client (jamais une erreur technique). */
  message: string | null;
  ok: boolean;
}

/** "Paris, France" → "Paris" */
export function cityNameOf(label?: string | null): string {
  return (label ?? '').split(',')[0].trim();
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function findFretDestination(
  destinations: FretDestination[], label?: string | null,
): FretDestination | null {
  const n = norm(cityNameOf(label));
  if (!n) return null;
  return destinations.find(d => norm(d.name) === n)
    ?? destinations.find(d => norm(d.name).includes(n) || n.includes(norm(d.name)))
    ?? null;
}

export function computeDevis(input: DevisComputeInput): DevisComputeResult {
  const empty = (message: string, manualQuote = false): DevisComputeResult =>
    ({ lines: [], total: 0, manualQuote, message, ok: false });

  if (input.engine === 'international') {
    const originCountry = countryForCity(cityNameOf(input.origin));
    const destCountry = countryForCity(cityNameOf(input.destination));
    if (!input.origin || !input.destination) return empty('Choisissez une origine et une destination.');
    if (!originCountry || !destCountry) {
      return empty('Ville non reconnue dans le catalogue — devis sur mesure nécessaire.', true);
    }
    const w = Number(input.weightKg) || 0;
    if (w <= 0) return empty('Renseignez le poids du colis.');
    const pricing = calculatePricing(
      { tarifGPFcfa: ratePerKgForCorridor(originCountry, destCountry), weightKg: w },
      input.express ? 'express' : 'standard',
    );
    const lines: DevisLine[] = pricing.lines.map(l => ({ label: l.label, amountFcfa: l.amountFcfa }));
    lines.push({ label: 'TVA (18 %)', amountFcfa: pricing.tva });
    return { lines, total: pricing.total_ttc, manualQuote: false, message: null, ok: true };
  }

  const zones = input.zones ?? [];
  const destinations = input.destinations ?? [];
  if (zones.length === 0 || destinations.length === 0) {
    return empty('Grille tarifaire Terminal D indisponible.');
  }
  const scope = input.engine === 'fret_national' ? 'national' : 'international';
  const dest = findFretDestination(destinations.filter(d => d.scope === scope), input.destination);
  if (!dest) {
    return empty(
      scope === 'national'
        ? 'Ville non desservie par le Terminal D — devis sur mesure nécessaire.'
        : 'Pays non desservi par le Terminal D — devis sur mesure nécessaire.',
      true,
    );
  }
  const zone = zones.find(z => z.id === dest.zone_id);
  if (!zone) return empty('Zone tarifaire introuvable pour cette destination.', true);

  if (scope === 'national') {
    if (!input.size) return empty('Choisissez une taille de colis (S / M / L).');
    const q = quoteNational(zone, input.size);
    if (q.price == null) return empty(q.detail, q.manualQuote);
    return {
      lines: [{ label: `Transport routier ${zone.label} · taille ${input.size}`, amountFcfa: q.price }],
      total: q.price, manualQuote: false, message: q.detail, ok: true,
    };
  }

  const w = Number(input.weightKg) || 0;
  const q = quoteInternational(zone, w);
  if (q.price == null) return empty(q.detail, q.manualQuote);
  return {
    lines: [{ label: `Transport routier ${zone.label} · ${q.billableKg} kg facturés`, amountFcfa: q.price }],
    total: q.price, manualQuote: false, message: q.detail, ok: true,
  };
}

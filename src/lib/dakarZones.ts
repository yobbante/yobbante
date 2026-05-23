// Quartiers de Dakar (UI dropdown + bot menu numéroté)
export const DAKAR_ZONES = [
  'Plateau', 'Médina', 'HLM', 'Point E',
  'Liberté 1', 'Liberté 2', 'Liberté 3', 'Liberté 4', 'Liberté 5', 'Liberté 6',
  'Sacré-Cœur', 'Mermoz', 'Almadies', 'Ngor', 'Ouakam', 'Yoff',
  'Pikine', 'Guédiawaye', 'Thiaroye', 'Rufisque', 'Bargny', 'Autre',
] as const;

// Bot menu groupé : 6 choix
export const DAKAR_ZONE_GROUPS: Array<{ key: string; label: string; zones: string[] }> = [
  { key: '1', label: 'Plateau / Médina', zones: ['Plateau', 'Médina'] },
  { key: '2', label: 'HLM / Liberté', zones: ['HLM', 'Liberté 1', 'Liberté 2', 'Liberté 3', 'Liberté 4', 'Liberté 5', 'Liberté 6', 'Point E'] },
  { key: '3', label: 'Sacré-Cœur / Mermoz', zones: ['Sacré-Cœur', 'Mermoz'] },
  { key: '4', label: 'Almadies / Ngor / Yoff', zones: ['Almadies', 'Ngor', 'Ouakam', 'Yoff'] },
  { key: '5', label: 'Pikine / Guédiawaye', zones: ['Pikine', 'Guédiawaye', 'Thiaroye'] },
  { key: '6', label: 'Rufisque / Bargny', zones: ['Rufisque', 'Bargny'] },
];

export const DAKAR_CRENEAUX = [
  { id: 'matin',   label: 'Matin (7h-12h)' },
  { id: 'apresm',  label: 'Après-midi (12h-18h)' },
  { id: 'soir',    label: 'Soir (18h-21h)' },
  { id: 'journee', label: 'Toute la journée' },
] as const;

// Villes desservies, groupées
export const CITIES_BY_REGION: Record<string, string[]> = {
  France: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Strasbourg', 'Lille', 'Nice', 'Montpellier'],
  Europe: ['Madrid', 'Milan', 'Bruxelles', 'Amsterdam', 'Genève', 'Zurich', 'Londres'],
  Amérique: ['New York', 'Montréal', 'Washington DC', 'Boston', 'Miami'],
  Afrique: ['Abidjan', 'Conakry', 'Bamako', 'Lomé', 'Cotonou', 'Libreville', 'Douala'],
  'Asie / ME': ['Dubai', 'Istanbul', 'Pékin', 'Shanghai', 'Guangzhou'],
};

export const ALL_CITIES: string[] = Object.values(CITIES_BY_REGION).flat();

// ----- Navettes typings & helpers --------------------------------------

export interface NavetteEscale {
  ville: string;
  adresse?: string;
  creneau?: string;
}

export interface Navette {
  id: string;
  villes: NavetteEscale[];
}

export function newNavette(): Navette {
  return { id: `nav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, villes: [] };
}

/** Returns the unique set of cities served across all navettes (preserves first-seen order). */
export function uniqueCitiesFromNavettes(navettes: Navette[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (navettes ?? []).forEach(n => (n.villes ?? []).forEach(v => {
    const c = (v.ville || '').trim();
    if (!c) return;
    const k = c.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  }));
  return out;
}

/** Loose match: does the GP's navettes mention a given city or country name? */
export function navettesServeCity(navettes: Navette[] | null | undefined, target: string | null | undefined): boolean {
  if (!target) return true; // no filter
  const t = target.trim().toLowerCase();
  if (!t) return true;
  return uniqueCitiesFromNavettes(navettes).some(c => c.toLowerCase().includes(t) || t.includes(c.toLowerCase()));
}

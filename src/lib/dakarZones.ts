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

// ─────────────────────────────────────────────────────────────────────
// Pricing zones — enlèvement / livraison Dakar
// Base intégrée invisible : 5 000 FCFA. Surcoût affiché client = montant − 5000.
// ─────────────────────────────────────────────────────────────────────

export const ZONES_DAKAR_GRATUITES = {
  centre_ville: [
    'Dakar Plateau', 'Plateau', 'Médina', 'Medina', 'Fann', 'Point E',
    'Amitié', 'Amitie', 'Gueule Tapée', 'Gueule Tapee', 'Fass', 'Colobane', 'Rebeuss',
  ],
  ouakam: [
    'Ouakam', 'Mamelles', 'Almadies', 'Ngor', 'Mermoz',
    'Sacré-Cœur', 'Sacre-Coeur', 'Sacré Cœur', 'Sacre Coeur',
  ],
  grand_dakar: [
    'Liberté', 'Liberte', 'Liberté 1', 'Liberté 2', 'Liberté 3',
    'Liberté 4', 'Liberté 5', 'Liberté 6',
    'Sicap', 'Sicap Baobabs', 'Sicap Karak',
    'Grand Dakar', 'Dieuppeul', 'Derklé', 'Derkle', 'Castors', 'HLM',
  ],
  nord_foire: [
    'Nord Foire', 'Sud Foire', 'Yoff', 'Pères Maristes', 'Peres Maristes',
    'Hann Bel-Air', 'Hann', 'Grand Yoff', 'Scat Urbam',
    'Parcelles Assainies', 'Parcelles', "Patte d'Oie", 'Ouest Foire',
  ],
} as const;

export const ALL_ZONES_GRATUITES: string[] = Object.values(ZONES_DAKAR_GRATUITES).flat() as string[];

export const ZONES_DAKAR_PAYANTES = [
  'Pikine', 'Guédiawaye', 'Guediawaye', 'Thiaroye', 'Mbao',
  'Rufisque', 'Bargny', 'Sébikotane', 'Sebikotane', 'Diamniadio',
  'Keur Massar', 'Sangalkam', 'Malika', 'Yeumbeul', 'Diamaguene',
  'Thiaroye Gare', 'Cambérène', 'Camberene', 'Pout',
] as const;

export type DakarZoneCategory = 'dakar_centre' | 'dakar_banlieue' | 'hors_dakar';

function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function isZoneGratuite(adresse: string): boolean {
  if (!adresse) return false;
  const a = norm(adresse);
  return ALL_ZONES_GRATUITES.some((z) => a.includes(norm(z)));
}

export function isZoneDakarPayante(adresse: string): boolean {
  if (!adresse) return false;
  const a = norm(adresse);
  return ZONES_DAKAR_PAYANTES.some((z) => a.includes(norm(z)));
}

export interface FraisEnlevement {
  montant: number;            // total intégré (base 5000 + surcoût éventuel)
  surcharge: number;          // surcoût visible client (0, 5000, 10000)
  gratuit: boolean;
  zone: DakarZoneCategory;
  message: string;
}

export function calculerFraisEnlevement(adresse: string): FraisEnlevement {
  if (isZoneGratuite(adresse)) {
    return {
      montant: 5000, surcharge: 0, gratuit: true,
      zone: 'dakar_centre',
      message: 'Enlèvement gratuit dans votre zone',
    };
  }
  if (isZoneDakarPayante(adresse)) {
    return {
      montant: 10000, surcharge: 5000, gratuit: false,
      zone: 'dakar_banlieue',
      message: 'Zone périphérique Dakar — Frais de déplacement : +5 000 FCFA',
    };
  }
  return {
    montant: 15000, surcharge: 10000, gratuit: false,
    zone: 'hors_dakar',
    message: 'Adresse hors Dakar — Frais de déplacement : +10 000 FCFA',
  };
}

// Dropdown groupé pour la sélection de quartier (UI)
export const QUARTIER_GROUPS: Array<{ label: string; zone: DakarZoneCategory; surcharge: number; quartiers: string[] }> = [
  {
    label: 'Centre-ville', zone: 'dakar_centre', surcharge: 0,
    quartiers: ['Dakar Plateau', 'Médina', 'Fann / Point E', 'Amitié', 'Gueule Tapée / Fass / Colobane', 'Rebeuss'],
  },
  {
    label: 'Ouakam & Almadies', zone: 'dakar_centre', surcharge: 0,
    quartiers: ['Ouakam', 'Mamelles', 'Almadies', 'Ngor', 'Mermoz', 'Sacré-Cœur 1', 'Sacré-Cœur 2', 'Sacré-Cœur 3'],
  },
  {
    label: 'Grand Dakar & Liberté', zone: 'dakar_centre', surcharge: 0,
    quartiers: ['Liberté 1', 'Liberté 2', 'Liberté 3', 'Liberté 4', 'Liberté 5', 'Liberté 6', 'Sicap Baobabs', 'Sicap Karak', 'Grand Dakar', 'Dieuppeul / Derklé', 'Castors / HLM'],
  },
  {
    label: 'Nord & Parcelles', zone: 'dakar_centre', surcharge: 0,
    quartiers: ['Nord Foire', 'Sud Foire', 'Yoff', 'Hann Bel-Air', 'Grand Yoff', 'Scat Urbam', 'Parcelles Assainies', "Patte d'Oie", 'Ouest Foire'],
  },
  {
    label: 'Banlieue (+5 000 FCFA)', zone: 'dakar_banlieue', surcharge: 5000,
    quartiers: ['Pikine', 'Guédiawaye', 'Thiaroye', 'Mbao', 'Rufisque', 'Bargny', 'Keur Massar', 'Yeumbeul', 'Cambérène'],
  },
  {
    label: 'Hors Dakar (+10 000 FCFA)', zone: 'hors_dakar', surcharge: 10000,
    quartiers: ['Thiès', 'Mbour', 'Saint-Louis', 'Touba', 'Kaolack', 'Ziguinchor', 'Autre'],
  },
];

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

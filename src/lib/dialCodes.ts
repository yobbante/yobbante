/**
 * Indicatifs téléphoniques par pays (ISO-2) — utilisés par les champs téléphone
 * de l'admin. Liste volontairement centrée sur les pays desservis par Yobbanté,
 * complétée par quelques pays fréquents.
 */
export interface DialCode {
  country: string;     // ISO-2
  label: string;       // Nom FR
  dial: string;        // ex. '+221'
  flag: string;
}

export const DIAL_CODES: DialCode[] = [
  { country: 'SN', label: 'Sénégal',                 dial: '+221', flag: '🇸🇳' },
  { country: 'FR', label: 'France',                  dial: '+33',  flag: '🇫🇷' },
  { country: 'ES', label: 'Espagne',                 dial: '+34',  flag: '🇪🇸' },
  { country: 'IT', label: 'Italie',                  dial: '+39',  flag: '🇮🇹' },
  { country: 'DE', label: 'Allemagne',               dial: '+49',  flag: '🇩🇪' },
  { country: 'BE', label: 'Belgique',                dial: '+32',  flag: '🇧🇪' },
  { country: 'CH', label: 'Suisse',                  dial: '+41',  flag: '🇨🇭' },
  { country: 'GB', label: 'Royaume-Uni',             dial: '+44',  flag: '🇬🇧' },
  { country: 'PT', label: 'Portugal',                dial: '+351', flag: '🇵🇹' },
  { country: 'NL', label: 'Pays-Bas',                dial: '+31',  flag: '🇳🇱' },
  { country: 'US', label: 'États-Unis',              dial: '+1',   flag: '🇺🇸' },
  { country: 'CA', label: 'Canada',                  dial: '+1',   flag: '🇨🇦' },
  { country: 'MA', label: 'Maroc',                   dial: '+212', flag: '🇲🇦' },
  { country: 'TR', label: 'Turquie',                 dial: '+90',  flag: '🇹🇷' },
  { country: 'AE', label: 'Émirats Arabes Unis',     dial: '+971', flag: '🇦🇪' },
  { country: 'LB', label: 'Liban',                   dial: '+961', flag: '🇱🇧' },
  { country: 'CN', label: 'Chine',                   dial: '+86',  flag: '🇨🇳' },
  { country: 'CI', label: "Côte d'Ivoire",           dial: '+225', flag: '🇨🇮' },
  { country: 'ML', label: 'Mali',                    dial: '+223', flag: '🇲🇱' },
  { country: 'GN', label: 'Guinée',                  dial: '+224', flag: '🇬🇳' },
  { country: 'GM', label: 'Gambie',                  dial: '+220', flag: '🇬🇲' },
  { country: 'MR', label: 'Mauritanie',              dial: '+222', flag: '🇲🇷' },
  { country: 'CM', label: 'Cameroun',                dial: '+237', flag: '🇨🇲' },
  { country: 'GA', label: 'Gabon',                   dial: '+241', flag: '🇬🇦' },
  { country: 'CG', label: 'République du Congo',     dial: '+242', flag: '🇨🇬' },
  { country: 'CD', label: 'RD Congo',                dial: '+243', flag: '🇨🇩' },
  { country: 'GQ', label: 'Guinée Équatoriale',      dial: '+240', flag: '🇬🇶' },
  { country: 'TD', label: 'Tchad',                   dial: '+235', flag: '🇹🇩' },
];

export const DEFAULT_DIAL = '+221';

export function dialForCountry(country: string | null | undefined): string {
  if (!country) return DEFAULT_DIAL;
  const m = DIAL_CODES.find((d) => d.country === country.toUpperCase());
  return m?.dial ?? DEFAULT_DIAL;
}

/** Découpe un numéro E.164 en (indicatif, reste). Fallback : indicatif fourni. */
export function splitPhone(value: string | null | undefined, fallbackDial = DEFAULT_DIAL): { dial: string; local: string } {
  const v = (value ?? '').trim();
  if (!v) return { dial: fallbackDial, local: '' };
  if (v.startsWith('+')) {
    const sorted = [...new Set(DIAL_CODES.map((d) => d.dial))].sort((a, b) => b.length - a.length);
    const hit = sorted.find((d) => v.startsWith(d));
    if (hit) return { dial: hit, local: v.slice(hit.length).replace(/[^\d]/g, '') };
    return { dial: fallbackDial, local: v.replace(/[^\d]/g, '') };
  }
  if (v.startsWith('00')) return splitPhone('+' + v.slice(2), fallbackDial);
  return { dial: fallbackDial, local: v.replace(/[^\d]/g, '') };
}

export function joinPhone(dial: string, local: string): string {
  const digits = (local ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return `${dial}${digits}`;
}

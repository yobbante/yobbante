// Country profile — devise, format téléphone, langue d'interface, info corridor.
// Utilisé par le SendFlow global pour adapter l'expérience selon le pays d'origine.

export interface CountryProfile {
  code: string;          // ISO-2
  name: string;
  flag: string;
  currency: string;      // code ISO 4217
  currencySymbol: string;
  phonePrefix: string;
  locale: 'fr' | 'en';
  // FCFA fixed parity (XOF/XAF). Other rates are indicative only.
  rateToEur: number;     // 1 EUR = X local
}

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  SN: { code: 'SN', name: 'Sénégal',         flag: '🇸🇳', currency: 'XOF', currencySymbol: 'FCFA', phonePrefix: '+221', locale: 'fr', rateToEur: 655.957 },
  CI: { code: 'CI', name: "Côte d'Ivoire",   flag: '🇨🇮', currency: 'XOF', currencySymbol: 'FCFA', phonePrefix: '+225', locale: 'fr', rateToEur: 655.957 },
  ML: { code: 'ML', name: 'Mali',            flag: '🇲🇱', currency: 'XOF', currencySymbol: 'FCFA', phonePrefix: '+223', locale: 'fr', rateToEur: 655.957 },
  BJ: { code: 'BJ', name: 'Bénin',           flag: '🇧🇯', currency: 'XOF', currencySymbol: 'FCFA', phonePrefix: '+229', locale: 'fr', rateToEur: 655.957 },
  BF: { code: 'BF', name: 'Burkina Faso',    flag: '🇧🇫', currency: 'XOF', currencySymbol: 'FCFA', phonePrefix: '+226', locale: 'fr', rateToEur: 655.957 },
  TG: { code: 'TG', name: 'Togo',            flag: '🇹🇬', currency: 'XOF', currencySymbol: 'FCFA', phonePrefix: '+228', locale: 'fr', rateToEur: 655.957 },
  CM: { code: 'CM', name: 'Cameroun',        flag: '🇨🇲', currency: 'XAF', currencySymbol: 'FCFA', phonePrefix: '+237', locale: 'fr', rateToEur: 655.957 },
  GA: { code: 'GA', name: 'Gabon',           flag: '🇬🇦', currency: 'XAF', currencySymbol: 'FCFA', phonePrefix: '+241', locale: 'fr', rateToEur: 655.957 },
  FR: { code: 'FR', name: 'France',          flag: '🇫🇷', currency: 'EUR', currencySymbol: '€',    phonePrefix: '+33',  locale: 'fr', rateToEur: 1 },
  BE: { code: 'BE', name: 'Belgique',        flag: '🇧🇪', currency: 'EUR', currencySymbol: '€',    phonePrefix: '+32',  locale: 'fr', rateToEur: 1 },
  ES: { code: 'ES', name: 'Espagne',         flag: '🇪🇸', currency: 'EUR', currencySymbol: '€',    phonePrefix: '+34',  locale: 'fr', rateToEur: 1 },
  IT: { code: 'IT', name: 'Italie',          flag: '🇮🇹', currency: 'EUR', currencySymbol: '€',    phonePrefix: '+39',  locale: 'fr', rateToEur: 1 },
  DE: { code: 'DE', name: 'Allemagne',       flag: '🇩🇪', currency: 'EUR', currencySymbol: '€',    phonePrefix: '+49',  locale: 'fr', rateToEur: 1 },
  GB: { code: 'GB', name: 'Royaume-Uni',     flag: '🇬🇧', currency: 'GBP', currencySymbol: '£',    phonePrefix: '+44',  locale: 'en', rateToEur: 0.85 },
  US: { code: 'US', name: 'États-Unis',      flag: '🇺🇸', currency: 'USD', currencySymbol: '$',    phonePrefix: '+1',   locale: 'en', rateToEur: 1.08 },
  CA: { code: 'CA', name: 'Canada',          flag: '🇨🇦', currency: 'CAD', currencySymbol: 'CA$',  phonePrefix: '+1',   locale: 'fr', rateToEur: 1.46 },
  AE: { code: 'AE', name: 'Émirats arabes unis', flag: '🇦🇪', currency: 'AED', currencySymbol: 'د.إ', phonePrefix: '+971', locale: 'en', rateToEur: 3.95 },
  CN: { code: 'CN', name: 'Chine',           flag: '🇨🇳', currency: 'CNY', currencySymbol: '¥',    phonePrefix: '+86',  locale: 'en', rateToEur: 7.8 },
  TR: { code: 'TR', name: 'Turquie',         flag: '🇹🇷', currency: 'TRY', currencySymbol: '₺',    phonePrefix: '+90',  locale: 'en', rateToEur: 38 },
  MA: { code: 'MA', name: 'Maroc',           flag: '🇲🇦', currency: 'MAD', currencySymbol: 'DH',   phonePrefix: '+212', locale: 'fr', rateToEur: 10.8 },
  NG: { code: 'NG', name: 'Nigeria',         flag: '🇳🇬', currency: 'NGN', currencySymbol: '₦',    phonePrefix: '+234', locale: 'en', rateToEur: 1700 },
};

export const FALLBACK_PROFILE: CountryProfile = COUNTRY_PROFILES.FR;

export function getProfile(code?: string | null): CountryProfile {
  if (!code) return FALLBACK_PROFILE;
  return COUNTRY_PROFILES[code.toUpperCase()] ?? FALLBACK_PROFILE;
}

export const COUNTRY_OPTIONS = Object.values(COUNTRY_PROFILES).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function formatLocalAmount(amountEur: number, profile: CountryProfile): string {
  const local = Math.round(amountEur * profile.rateToEur);
  if (profile.currency === 'XOF' || profile.currency === 'XAF') {
    return `${new Intl.NumberFormat('fr-FR').format(local)} ${profile.currencySymbol}`;
  }
  return new Intl.NumberFormat(profile.locale === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'currency', currency: profile.currency, maximumFractionDigits: 0,
  }).format(local);
}

export function eurFromLocal(amountLocal: number, profile: CountryProfile): number {
  if (!profile.rateToEur) return amountLocal;
  return amountLocal / profile.rateToEur;
}

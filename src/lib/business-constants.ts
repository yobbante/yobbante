/* Constants for business B2B flows */

export const INCOTERMS = [
  { code: 'EXW', label: 'EXW — Ex Works (départ usine)' },
  { code: 'FCA', label: 'FCA — Free Carrier' },
  { code: 'FOB', label: 'FOB — Free On Board' },
  { code: 'CFR', label: 'CFR — Cost and Freight' },
  { code: 'CIF', label: 'CIF — Cost, Insurance, Freight' },
  { code: 'CPT', label: 'CPT — Carriage Paid To' },
  { code: 'CIP', label: 'CIP — Carriage and Insurance Paid' },
  { code: 'DAP', label: 'DAP — Delivered At Place' },
  { code: 'DPU', label: 'DPU — Delivered at Place Unloaded' },
  { code: 'DDP', label: 'DDP — Delivered Duty Paid' },
];

export const CURRENCIES = ['EUR', 'XOF', 'USD', 'CNY', 'GBP'];

export const UNITS = ['pcs', 'kg', 'cartons', 'palettes', 'conteneurs', 'tonnes', 'm³'];

export const COUNTRIES = [
  'Sénégal', 'France', 'Chine', 'États-Unis', 'Maroc', 'Côte d\'Ivoire',
  'Mali', 'Mauritanie', 'Guinée', 'Allemagne', 'Espagne', 'Italie',
  'Turquie', 'Émirats Arabes Unis', 'Inde', 'Belgique', 'Pays-Bas', 'Royaume-Uni',
];

export const CUSTOMS_DOCS = [
  { kind: 'proforma_invoice',     label: 'Facture pro forma',      desc: 'Devis officiel avant expédition' },
  { kind: 'commercial_invoice',   label: 'Facture commerciale',    desc: 'Facture définitive pour douane' },
  { kind: 'packing_list',         label: 'Liste de colisage',      desc: 'Détail du contenu et poids' },
  { kind: 'bill_of_lading',       label: 'Connaissement (BL)',     desc: 'Titre de propriété marchandise' },
  { kind: 'customs_declaration',  label: 'Déclaration douanière',  desc: 'Document officiel de dédouanement' },
  { kind: 'certificate_of_origin',label: 'Certificat d\'origine',  desc: 'Origine de la marchandise' },
] as const;

export type CustomsDocKind = typeof CUSTOMS_DOCS[number]['kind'];

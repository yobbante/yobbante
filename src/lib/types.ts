export type WarehouseCountry = 'FR' | 'CN' | 'US' | 'CA' | 'AE' | 'DE';
export type PackageStatus = 'CREATED' | 'RECEIVED' | 'IN_STORAGE' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED';
export type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELIVERED';
export type DossierStatus =
  | 'SUBMITTED' | 'IN_REVIEW' | 'SOURCING' | 'PROCURED'
  | 'IN_TRANSIT' | 'CUSTOMS' | 'DELIVERED' | 'CLOSED';

export const PACKAGE_STATUS_ORDER: PackageStatus[] = [
  'CREATED', 'RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'
];

export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  'PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED'
];

export const DOSSIER_STATUS_ORDER: DossierStatus[] = [
  'SUBMITTED', 'IN_REVIEW', 'SOURCING', 'PROCURED', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED', 'CLOSED'
];

export const DOSSIER_STATUS_LABELS: Record<DossierStatus, string> = {
  SUBMITTED: 'Soumis',
  IN_REVIEW: 'En analyse',
  SOURCING: 'Sourcing',
  PROCURED: 'Acheté',
  IN_TRANSIT: 'En transit',
  CUSTOMS: 'Douane',
  DELIVERED: 'Livré',
  CLOSED: 'Clôturé',
};

export const COUNTRY_FLAGS: Record<WarehouseCountry, string> = {
  FR: '🇫🇷',
  CN: '🇨🇳',
  US: '🇺🇸',
  CA: '🇨🇦',
  AE: '🇦🇪',
  DE: '🇩🇪',
};

export const COUNTRY_NAMES: Record<WarehouseCountry, string> = {
  FR: 'France',
  CN: 'Chine',
  US: 'États-Unis',
  CA: 'Canada',
  AE: 'Dubai',
  DE: 'Allemagne',
};

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  default_delivery_country: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  country: WarehouseCountry;
  address_line: string;
  identifier_code: string;
  created_at: string;
}

export interface Package {
  id: string;
  user_id: string;
  warehouse_country: WarehouseCountry;
  status: PackageStatus;
  weight: number | null;
  shipment_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Shipment {
  id: string;
  user_id: string;
  status: ShipmentStatus;
  total_cost: number | null;
  eta: string | null;
  transport_type: string | null;
  konnekt_id: string | null;
  origin_country: WarehouseCountry;
  destination_country: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  related_package_id: string | null;
  related_shipment_id: string | null;
  created_at: string;
}

export interface Dossier {
  id: string;
  user_id: string;
  reference: string;
  status: DossierStatus;
  product_description: string;
  estimated_weight: number | null;
  origin_country: WarehouseCountry;
  destination_country: string;
  budget_eur: number | null;
  needs_sourcing: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  estimated_cost: number | null;
  estimated_delivery_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartRouteOption {
  key: 'fast' | 'balanced' | 'economy';
  label: string;
  transport: 'air' | 'sea' | 'road';
  transportLabel: string;
  estimatedCost: number;
  estimatedDays: string;
  highlight: string;
}

export interface SmartRecommendation {
  route: string;
  options: SmartRouteOption[];
  recommended: 'fast' | 'balanced' | 'economy';
  reasoning: string;
}

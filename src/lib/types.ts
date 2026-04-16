export type WarehouseCountry = 'FR' | 'CN' | 'US';
export type PackageStatus = 'CREATED' | 'RECEIVED' | 'IN_STORAGE' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED';
export type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELIVERED';

export const PACKAGE_STATUS_ORDER: PackageStatus[] = [
  'CREATED', 'RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'
];

export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  'PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED'
];

export const COUNTRY_FLAGS: Record<WarehouseCountry, string> = {
  FR: '🇫🇷',
  CN: '🇨🇳',
  US: '🇺🇸',
};

export const COUNTRY_NAMES: Record<WarehouseCountry, string> = {
  FR: 'France',
  CN: 'China',
  US: 'United States',
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

export type WarehouseCountry = 'FR' | 'CN' | 'US' | 'CA' | 'AE' | 'DE' | 'SN';
export type PackageStatus = 'CREATED' | 'RECEIVED' | 'IN_STORAGE' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED';
export type ShipmentStatus =
  | 'PENDING' | 'WAITING_FOR_MATCH' | 'CONFIRMED' | 'MATCHED' | 'IN_PREPARATION'
  | 'IN_TRANSIT' | 'CUSTOMS' | 'ARRIVED' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'CANCELLED' | 'ON_HOLD';

/** Full workflow order used by the admin Kanban / state machine. */
export const SHIPMENT_WORKFLOW_ORDER: ShipmentStatus[] = [
  'PENDING', 'WAITING_FOR_MATCH', 'CONFIRMED', 'MATCHED', 'IN_PREPARATION',
  'IN_TRANSIT', 'CUSTOMS', 'ARRIVED', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'ON_HOLD', 'CANCELLED',
];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'En attente',
  WAITING_FOR_MATCH: 'Sans départ',
  CONFIRMED: 'Confirmé',
  MATCHED: 'Assigné',
  IN_PREPARATION: 'Préparation',
  IN_TRANSIT: 'En transit',
  CUSTOMS: 'Douane',
  ARRIVED: 'Arrivé',
  OUT_FOR_DELIVERY: 'En livraison',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
  ON_HOLD: 'À traiter',
};
export type DossierStatus =
  | 'SUBMITTED' | 'IN_REVIEW' | 'SOURCING' | 'PROCURED'
  | 'IN_TRANSIT' | 'CUSTOMS' | 'DELIVERED' | 'CLOSED'
  | 'QUOTE_REQUESTED' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | 'QUOTE_REFUSED';

export const PACKAGE_STATUS_ORDER: PackageStatus[] = [
  'CREATED', 'RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'
];

export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  'PENDING', 'WAITING_FOR_MATCH', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED'
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
  QUOTE_REQUESTED: 'Demande de devis reçue',
  QUOTE_SENT: 'Devis reçu',
  QUOTE_ACCEPTED: 'Devis accepté',
  QUOTE_REFUSED: 'Devis refusé',
};

export const COUNTRY_FLAGS: Record<WarehouseCountry, string> = {
  FR: '🇫🇷',
  CN: '🇨🇳',
  US: '🇺🇸',
  CA: '🇨🇦',
  AE: '🇦🇪',
  DE: '🇩🇪',
  SN: '🇸🇳',
};

export const COUNTRY_NAMES: Record<WarehouseCountry, string> = {
  FR: 'France',
  CN: 'Chine',
  US: 'États-Unis',
  CA: 'Canada',
  AE: 'Dubai',
  DE: 'Allemagne',
  SN: 'Sénégal',
};

export type SourcingProfile = 'individual' | 'business';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  default_delivery_country: string | null;
  sourcing_profile: SourcingProfile | null;
  email: string | null;
  phone: string | null;
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
  dossier_id?: string | null;
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
  tracking_number?: string | null;
  payment_status?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  weight_kg?: number | null;
  priority?: string | null;
  pending_assignment?: boolean | null;
  manual_request?: boolean | null;
  transport_metadata?: Record<string, unknown> | null;
  client_note?: string | null;
  departure_date?: string | null;
  created_at: string;
  updated_at?: string | null;
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
  admin_notes: string | null;
  konnekt_order_id: string | null;
  konnekt_synced_at: string | null;
  gp_id: string | null;
  app_source: string;
  business_id?: string | null;
  dossier_type?: 'individual' | 'business' | null;
  incoterm?: string | null;
  hs_code?: string | null;
  currency?: string | null;
  declared_value?: number | null;
  supplier_name?: string | null;
  supplier_country?: string | null;
  supplier_contact?: string | null;
  buyer_name?: string | null;
  buyer_country?: string | null;
  buyer_contact?: string | null;
  quantity?: number | null;
  unit?: string | null;
  tracking_id?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_address?: string | null;
  pickup_date?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  quote_amount_xof?: number | null;
  quote_currency?: string | null;
  quote_valid_until?: string | null;
  quote_notes_admin?: string | null;
  quote_sent_at?: string | null;
  quote_response?: string | null;
  assigned_transporteur_ref?: string | null;
  assigned_departure_id?: string | null;
  payment_status?: 'pending' | 'paid' | 'refunded' | string | null;
  delivery_mode?: 'partner_pickup' | 'pickup_gp' | 'relay_point' | 'home_delivery' | string | null;
  delivery_carrier?: string | null;
  delivery_cost_xof?: number | null;
  relay_point_name?: string | null;
  relay_point_address?: string | null;
  is_express?: boolean | null;
  is_gift?: boolean | null;
  delivered_at?: string | null;
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

/**
 * Deterministic hub → route mapping.
 *
 * Single source of truth used by ReceiveFlow, SendFlow, ShipNowDialog and Tracking
 * so a hub selection (origin warehouse country) always pre-fills the same
 * destination, city/port and preferred transport.
 *
 * If/when an admin needs to edit these routes, migrate to a Supabase table
 * `hub_routes` keyed on origin_country.
 */
import type { WarehouseCountry } from './types';

export type TransportMode = 'AIR' | 'SEA' | 'ROAD';

export interface HubRoute {
  origin_country: WarehouseCountry;
  origin_city: string;
  origin_port: string;
  destination_country: string;
  destination_city: string;
  destination_port: string;
  preferred_transport: TransportMode;
  /** Typical end-to-end estimate, used for ETA hints. */
  typical_eta_days: number;
}

/** Default destination for the Yobbanté audience (West Africa hub). */
const DEFAULT_DESTINATION = {
  country: 'SN',
  city: 'Dakar',
  port: 'Port Autonome de Dakar',
} as const;

export const HUB_ROUTES: Record<WarehouseCountry, HubRoute> = {
  CN: {
    origin_country: 'CN',
    origin_city: 'Shenzhen',
    origin_port: 'Yantian',
    destination_country: DEFAULT_DESTINATION.country,
    destination_city: DEFAULT_DESTINATION.city,
    destination_port: DEFAULT_DESTINATION.port,
    preferred_transport: 'SEA',
    typical_eta_days: 35,
  },
  FR: {
    origin_country: 'FR',
    origin_city: 'Paris',
    origin_port: 'Le Havre',
    destination_country: DEFAULT_DESTINATION.country,
    destination_city: DEFAULT_DESTINATION.city,
    destination_port: DEFAULT_DESTINATION.port,
    preferred_transport: 'SEA',
    typical_eta_days: 14,
  },
  US: {
    origin_country: 'US',
    origin_city: 'Miami',
    origin_port: 'Port of Miami',
    destination_country: DEFAULT_DESTINATION.country,
    destination_city: DEFAULT_DESTINATION.city,
    destination_port: DEFAULT_DESTINATION.port,
    preferred_transport: 'SEA',
    typical_eta_days: 21,
  },
  CA: {
    origin_country: 'CA',
    origin_city: 'Montréal',
    origin_port: 'Port of Montréal',
    destination_country: DEFAULT_DESTINATION.country,
    destination_city: DEFAULT_DESTINATION.city,
    destination_port: DEFAULT_DESTINATION.port,
    preferred_transport: 'SEA',
    typical_eta_days: 24,
  },
  AE: {
    origin_country: 'AE',
    origin_city: 'Dubai',
    origin_port: 'Jebel Ali',
    destination_country: DEFAULT_DESTINATION.country,
    destination_city: DEFAULT_DESTINATION.city,
    destination_port: DEFAULT_DESTINATION.port,
    preferred_transport: 'AIR',
    typical_eta_days: 7,
  },
  DE: {
    origin_country: 'DE',
    origin_city: 'Hambourg',
    origin_port: 'Port of Hamburg',
    destination_country: DEFAULT_DESTINATION.country,
    destination_city: DEFAULT_DESTINATION.city,
    destination_port: DEFAULT_DESTINATION.port,
    preferred_transport: 'SEA',
    typical_eta_days: 16,
  },
};

export function getHubRoute(origin: WarehouseCountry): HubRoute {
  return HUB_ROUTES[origin];
}

/** Map a transport mode to the lowercase keyword used in shipments.transport_type. */
export function transportToKeyword(t: TransportMode): 'air' | 'sea' | 'road' {
  return t.toLowerCase() as 'air' | 'sea' | 'road';
}

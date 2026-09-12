/** Modèle commun des départs aériens et maritimes (partenaire + admin). */
export type AirSeaMode = 'air' | 'sea_lcl';

export type AirSeaDepartureForm = {
  id?: string;
  transport_mode: AirSeaMode;
  carrier_company: string;
  flight_or_vessel: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  port_origin: string;
  port_destination: string;
  departure_date: string;
  cutoff_date: string;
  arrival_estimate: string;
  transit_days: string;
  total_capacity_kg: string;
  capacity_cbm: string;
  container_type: string;
  price_per_kg_xof: string;
  price_per_cbm_xof: string;
  notes: string;
};

export const EMPTY_AIR_SEA: AirSeaDepartureForm = {
  transport_mode: 'air',
  carrier_company: '', flight_or_vessel: '',
  origin_city: '', origin_country: '', destination_city: 'Dakar', destination_country: 'Sénégal',
  port_origin: '', port_destination: '',
  departure_date: '', cutoff_date: '', arrival_estimate: '', transit_days: '',
  total_capacity_kg: '', capacity_cbm: '', container_type: 'LCL',
  price_per_kg_xof: '', price_per_cbm_xof: '', notes: '',
};

export const CONTAINER_TYPES = ['LCL', "FCL 20'", "FCL 40'", "FCL 40' HC"];

/** Libellés officiels : « cargo aérien » pour ne jamais confondre avec le GP. */
export const AIR_SEA_MODE_LABEL: Record<AirSeaMode, string> = {
  air: 'Cargo aérien',
  sea_lcl: 'Maritime',
};

export function toAirSeaPayload(f: AirSeaDepartureForm): Record<string, unknown> {
  return {
    id: f.id ?? null,
    transport_mode: f.transport_mode,
    carrier_company: f.carrier_company || null,
    flight_or_vessel: f.flight_or_vessel || null,
    origin_city: f.origin_city.trim(),
    origin_country: f.origin_country || null,
    destination_city: f.destination_city.trim(),
    destination_country: f.destination_country || null,
    port_origin: f.port_origin || null,
    port_destination: f.port_destination || null,
    departure_date: f.departure_date,
    cutoff_date: f.cutoff_date || null,
    arrival_estimate: f.arrival_estimate || null,
    transit_days: f.transit_days || null,
    total_capacity_kg: f.total_capacity_kg || '0',
    capacity_cbm: f.capacity_cbm || null,
    container_type: f.transport_mode === 'sea_lcl' ? (f.container_type || null) : null,
    price_per_kg_xof: f.price_per_kg_xof || null,
    price_per_cbm_xof: f.price_per_cbm_xof || null,
    notes: f.notes || null,
  };
}

export function fromAirSeaRow(d: Record<string, any>): AirSeaDepartureForm {
  return {
    id: d.id,
    transport_mode: (d.transport_mode === 'sea_lcl' ? 'sea_lcl' : 'air'),
    carrier_company: d.carrier_company ?? '',
    flight_or_vessel: d.flight_or_vessel ?? '',
    origin_city: d.origin_city ?? '',
    origin_country: d.origin_country ?? '',
    destination_city: d.destination_city ?? '',
    destination_country: d.destination_country ?? '',
    port_origin: d.port_origin ?? '',
    port_destination: d.port_destination ?? '',
    departure_date: d.departure_date ?? '',
    cutoff_date: d.cutoff_date ?? '',
    arrival_estimate: d.arrival_estimate ?? '',
    transit_days: d.transit_days != null ? String(d.transit_days) : '',
    total_capacity_kg: d.total_capacity_kg != null ? String(d.total_capacity_kg) : '',
    capacity_cbm: d.capacity_cbm != null ? String(d.capacity_cbm) : '',
    container_type: d.container_type ?? 'LCL',
    price_per_kg_xof: d.price_per_kg_xof != null ? String(d.price_per_kg_xof) : '',
    price_per_cbm_xof: d.price_per_cbm_xof != null ? String(d.price_per_cbm_xof) : '',
    notes: d.notes ?? '',
  };
}

export function airSeaFormError(f: AirSeaDepartureForm): string | null {
  if (!f.origin_city.trim()) return "Ville de départ requise";
  if (!f.destination_city.trim()) return 'Ville d’arrivée requise';
  if (!f.departure_date) return 'Date de départ requise';
  if (f.transport_mode === 'air' && !f.total_capacity_kg) return 'Capacité (kg) requise';
  if (f.transport_mode === 'sea_lcl' && !f.capacity_cbm && !f.total_capacity_kg) return 'Capacité (CBM ou kg) requise';
  return null;
}

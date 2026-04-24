import { SHIPMENT_STATUS_ORDER, type ShipmentStatus } from './types';

/**
 * Forward-only state machine for shipments:
 * PENDING → IN_TRANSIT → CUSTOMS → DELIVERED
 */
export function shipmentRank(s: ShipmentStatus): number {
  return SHIPMENT_STATUS_ORDER.indexOf(s);
}

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return shipmentRank(to) > shipmentRank(from);
}

export function nextShipmentStatus(from: ShipmentStatus): ShipmentStatus | null {
  const i = shipmentRank(from);
  return i >= 0 && i < SHIPMENT_STATUS_ORDER.length - 1 ? SHIPMENT_STATUS_ORDER[i + 1] : null;
}

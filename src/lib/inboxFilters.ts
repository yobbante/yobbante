import type { InboxDossier } from '@/hooks/useInboxDossiers';
import type { InboxFilterState, InboxStatusFilter, CarrierFilter } from '@/components/admin/inbox/InboxFilters';

const NOW = () => Date.now();

export function ageHours(d: InboxDossier): number {
  return (NOW() - new Date(d.created_at).getTime()) / 36e5;
}

export function isFromKonnekt(d: InboxDossier): boolean {
  return !!(d as any).konnekt_order_id || (d as any).app_source === 'konnekt';
}

export function detectCarrier(d: InboxDossier): CarrierFilter {
  if (isFromKonnekt(d)) return 'konnekt';
  const c = (d.delivery_carrier || '').toLowerCase();
  if (c.includes('dhl')) return 'dhl';
  if (c.includes('fedex')) return 'fedex';
  if (c && !c.includes('gp')) return 'other';
  return 'gp_yobbante';
}

export function matchesStatus(d: InboxDossier, st: InboxStatusFilter): boolean {
  const s = d.status;
  const paid = d.payment_status === 'paid';
  switch (st) {
    case 'new': return s === 'SUBMITTED';
    case 'to_assign': return s === 'IN_REVIEW';
    case 'gp_assigned': return s === 'ASSIGNED' || (!!d.assigned_departure_id && !paid);
    case 'awaiting_payment': return s === 'AWAITING_CLIENT' || (!paid && (s === 'CONFIRMED' || s === 'ASSIGNED'));
    case 'paid': return paid && !['IN_TRANSIT','DELIVERED','CANCELLED','RETURNED'].includes(s as string);
    case 'pickup_scheduled': return !!d.collecte_creneau && !['IN_TRANSIT','DELIVERED'].includes(s as string);
    case 'in_transit': return s === 'IN_TRANSIT';
    case 'delivered': return s === 'DELIVERED';
    case 'cancelled': return s === 'CANCELLED';
    case 'return_requested': return s === 'RETURN_REQUESTED' || s === 'RETURN_IN_PROGRESS';
    case 'returned': return s === 'RETURNED';
  }
}

export function applyInboxFilters(rows: InboxDossier[], f: InboxFilterState): InboxDossier[] {
  return rows.filter(d => {
    if (f.sources.length && !f.sources.includes(d.source as any)) return false;
    if (f.statuses.length && !f.statuses.some(s => matchesStatus(d, s))) return false;
    if (f.carriers.length && !f.carriers.includes(detectCarrier(d))) return false;
    if (f.destinations.length) {
      const dest = (d.destination_city || d.destination_country || '').toLowerCase();
      if (!f.destinations.some(x => dest.includes(x.toLowerCase()))) return false;
    }
    if (f.urgency.length) {
      const isUrgent = ageHours(d) > 48 && !['DELIVERED','CANCELLED'].includes(d.status);
      if (f.urgency.includes('urgent') && !f.urgency.includes('normal') && !isUrgent) return false;
      if (f.urgency.includes('normal') && !f.urgency.includes('urgent') && isUrgent) return false;
    }
    if (f.search.trim()) {
      const q = f.search.toLowerCase();
      const hay = `${d.reference} ${d.buyer_name || ''} ${d.contact_phone || ''} ${d.contact_email || ''} ${d.product_description} ${d.destination_city || ''} ${d.destination_country || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type AgeTone = 'fresh' | 'warn' | 'late' | 'konnekt';
export function cardTone(d: InboxDossier): AgeTone {
  if (isFromKonnekt(d)) return 'konnekt';
  const h = ageHours(d);
  const done = ['DELIVERED', 'CANCELLED', 'RETURNED', 'IN_TRANSIT'].includes(d.status);
  if (done) return 'fresh';
  if (h > 48) return 'late';
  if (h > 24) return 'warn';
  return 'fresh';
}

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Vue unifiée de TOUS les paiements (tous modes de transport confondus) :
 *  - encaissements clients (dossiers)
 *  - reversements GP (dossiers, mode GP)
 *  - reversements transporteurs aérien / maritime (dossiers, carrier_cost_xof)
 *  - reversements chauffeurs routiers (fret_courses)
 *
 * Les données sont rafraîchies en direct (realtime) : toute modification faite
 * dans la fiche dossier se reflète immédiatement ici, et inversement.
 */

export type PaymentDirection = 'in' | 'out';
export type PaymentKind = 'client' | 'gp' | 'carrier' | 'road';
export type TransportMode = 'gp' | 'air' | 'sea' | 'road' | 'other';

export type PaymentRow = {
  key: string;
  kind: PaymentKind;
  direction: PaymentDirection;
  source: 'dossier' | 'course';
  sourceId: string;
  dossierId: string | null;
  ref: string;
  clientName: string;
  route: string;
  mode: TransportMode;
  amountXof: number;
  paid: boolean;
  paidAt: string | null;
  method: string | null;
  date: string; // date de référence (paiement sinon création)
  status: string | null;
};

export const MODE_LABEL: Record<TransportMode, string> = {
  gp: 'GP',
  air: 'Aérien',
  sea: 'Maritime',
  road: 'Routier',
  other: 'Autre',
};

export const KIND_LABEL: Record<PaymentKind, string> = {
  client: 'Encaissement client',
  gp: 'Reversement GP',
  carrier: 'Reversement transporteur',
  road: 'Reversement chauffeur',
};

function normalizeMode(m: string | null | undefined): TransportMode {
  const v = (m || '').toLowerCase();
  if (!v) return 'other';
  if (v.includes('gp') || v.includes('voyageur')) return 'gp';
  if (v.includes('air') || v.includes('aer') || v.includes('aér')) return 'air';
  if (v.includes('sea') || v.includes('mar') || v.includes('lcl') || v.includes('fcl')) return 'sea';
  if (v.includes('road') || v.includes('rout') || v.includes('fret')) return 'road';
  return 'other';
}

const xofOf = (d: any) =>
  Number(d.final_amount_xof ?? (d.estimated_cost != null ? Math.round(Number(d.estimated_cost) * 655.957) : 0)) || 0;

export function useAllPayments(monthsBack = 12) {
  const since = (() => {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - (monthsBack - 1));
    return d.toISOString();
  })();

  return useQuery({
    queryKey: ['all-payments', monthsBack],
    queryFn: async (): Promise<PaymentRow[]> => {
      const [dossiersR, coursesR] = await Promise.all([
        supabase
          .from('dossiers')
          .select(
            'id, reference, tracking_id, transport_mode, sender_name, recipient_name, origin_city, origin_country, destination_city, destination_country, ' +
            'final_amount_xof, estimated_cost, payment_status, payment_method, paid_at, created_at, ' +
            'gp_amount, gp_paid, gp_paid_at, gp_payment_method, ' +
            'carrier_cost_xof, carrier_name, carrier_paid, carrier_paid_at, carrier_payment_method',
          )
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('fret_courses' as any)
          .select('id, ref, status, client_nom, destination, total_fcfa, chauffeur_cost_fcfa, chauffeur_paid, chauffeur_paid_at, dossier_id, delivered_at, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);

      const rows: PaymentRow[] = [];

      for (const d of (dossiersR.data ?? []) as any[]) {
        const mode = normalizeMode(d.transport_mode);
        const ref = d.tracking_id || d.reference || d.id.slice(0, 8);
        const client = d.sender_name || d.recipient_name || '—';
        const route = [
          d.origin_city || d.origin_country || '—',
          d.destination_city || d.destination_country || '—',
        ].join(' → ');
        const amount = xofOf(d);

        if (amount > 0 || d.payment_status) {
          rows.push({
            key: `client:${d.id}`,
            kind: 'client', direction: 'in', source: 'dossier', sourceId: d.id, dossierId: d.id,
            ref, clientName: client, route, mode,
            amountXof: amount,
            paid: d.payment_status === 'paid',
            paidAt: d.paid_at ?? null,
            method: d.payment_method ?? null,
            date: d.paid_at || d.created_at,
            status: d.payment_status ?? null,
          });
        }

        if (d.gp_amount != null && Number(d.gp_amount) !== 0) {
          rows.push({
            key: `gp:${d.id}`,
            kind: 'gp', direction: 'out', source: 'dossier', sourceId: d.id, dossierId: d.id,
            ref, clientName: client, route, mode: 'gp',
            amountXof: Number(d.gp_amount),
            paid: !!d.gp_paid,
            paidAt: d.gp_paid_at ?? null,
            method: d.gp_payment_method ?? null,
            date: d.gp_paid_at || d.created_at,
            status: d.gp_paid ? 'paid' : 'pending',
          });
        }

        if (d.carrier_cost_xof != null && Number(d.carrier_cost_xof) !== 0) {
          rows.push({
            key: `carrier:${d.id}`,
            kind: 'carrier', direction: 'out', source: 'dossier', sourceId: d.id, dossierId: d.id,
            ref, clientName: d.carrier_name || client, route, mode,
            amountXof: Number(d.carrier_cost_xof),
            paid: !!d.carrier_paid,
            paidAt: d.carrier_paid_at ?? null,
            method: d.carrier_payment_method ?? null,
            date: d.carrier_paid_at || d.created_at,
            status: d.carrier_paid ? 'paid' : 'pending',
          });
        }
      }

      for (const c of (coursesR.data ?? []) as any[]) {
        const ref = c.ref || String(c.id).slice(0, 8);
        const client = c.client_nom || '—';
        const route = `Dakar → ${c.destination || '—'}`;

        // Revenu direct uniquement si la course n'est pas rattachée à un dossier
        if (!c.dossier_id && Number(c.total_fcfa || 0) > 0) {
          rows.push({
            key: `course-in:${c.id}`,
            kind: 'client', direction: 'in', source: 'course', sourceId: c.id, dossierId: null,
            ref, clientName: client, route, mode: 'road',
            amountXof: Number(c.total_fcfa),
            paid: c.status === 'LIVRE',
            paidAt: c.delivered_at ?? null,
            method: null,
            date: c.delivered_at || c.created_at,
            status: c.status,
          });
        }

        if (Number(c.chauffeur_cost_fcfa || 0) !== 0 || (!c.chauffeur_paid && c.status === 'LIVRE')) {
          rows.push({
            key: `road:${c.id}`,
            kind: 'road', direction: 'out', source: 'course', sourceId: c.id, dossierId: c.dossier_id ?? null,
            ref, clientName: client, route, mode: 'road',
            amountXof: Number(c.chauffeur_cost_fcfa || 0),
            paid: !!c.chauffeur_paid,
            paidAt: c.chauffeur_paid_at ?? null,
            method: null,
            date: c.chauffeur_paid_at || c.delivered_at || c.created_at,
            status: c.status,
          });
        }
      }

      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return rows;
    },
    staleTime: 30_000,
  });
}

/** Clés de cache à rafraîchir dès qu'un montant / statut de paiement change. */
export const FINANCE_QUERY_KEYS = [
  'all-payments',
  'finance-ledger',
  'road-pay-courses',
  'admin-dossier',
  'dossiers',
  'admin-finances',
  'fret-courses',
  'revenus',
];

export function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  FINANCE_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/**
 * Abonnement realtime : dossiers + fret_courses.
 * Toute écriture (fiche dossier, Terminal D, webhook de paiement) rafraîchit
 * automatiquement l'ensemble des vues financières.
 */
export function useFinanceRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('finance-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dossiers' }, () => invalidateFinance(qc))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fret_courses' }, () => invalidateFinance(qc))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

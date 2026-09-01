import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const TVA_RATE = 0.18;

export type MonthKey = string; // 'YYYY-MM'

export type MonthLedger = {
  month: MonthKey;
  label: string;
  revenueXof: number;      // encaissé (dossiers payés + courses routières hors dossier)
  costGpXof: number;       // dû/payé aux GP
  costRoadXof: number;     // dû/payé aux chauffeurs / transporteurs routiers
  costCarrierXof: number;    // cout compagnies aeriennes / maritimes
  costTotalXof: number;
  marginXof: number;
  tvaXof: number;          // 18 % du bénéfice
};

export type FinanceLedger = {
  months: MonthLedger[];          // du plus ancien au plus récent
  current: MonthLedger;
  dueGpXof: number;               // restant à payer aux GP (toutes périodes)
  dueRoadXof: number;             // restant à payer aux chauffeurs
  dueCarrierXof: number;          // restant à payer aux compagnies aérien/maritime
  missingRoadRateCount: number;   // courses livrées sans coût chauffeur saisi
};

const monthKey = (iso: string | null | undefined): MonthKey | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: MonthKey) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

const xofOf = (d: any) =>
  Number(d.final_amount_xof ?? (d.estimated_cost != null ? Math.round(Number(d.estimated_cost) * 655.957) : 0)) || 0;

export function useFinanceLedger(monthsBack = 6) {
  const since = (() => {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - (monthsBack - 1));
    return d.toISOString();
  })();

  return useQuery({
    queryKey: ['finance-ledger', monthsBack, since],
    queryFn: async (): Promise<FinanceLedger> => {
      const [paidR, gpR, roadR, gpDueR, roadDueR, carrierR, carrierDueR] = await Promise.all([
        // Revenus encaissés
        supabase.from('dossiers')
          .select('final_amount_xof, estimated_cost, paid_at, status')
          .eq('payment_status', 'paid')
          .not('status', 'in', '(CANCELLED,ARCHIVED)')
          .gte('paid_at', since),
        // Coûts GP (rattachés au mois de livraison)
        supabase.from('dossiers')
          .select('gp_amount, delivered_at, created_at, status')
          .not('gp_amount', 'is', null)
          .not('status', 'in', '(CANCELLED,ARCHIVED)')
          .gte('delivered_at', since),
        // Courses routières
        supabase.from('fret_courses' as any)
          .select('total_fcfa, chauffeur_cost_fcfa, dossier_id, delivered_at, created_at, status')
          .gte('created_at', since),
        // Restes à payer GP
        supabase.from('dossiers')
          .select('gp_amount, status')
          .eq('gp_paid', false)
          .not('gp_amount', 'is', null)
          .not('status', 'in', '(CANCELLED,ARCHIVED)'),
        // Restes à payer chauffeurs
        supabase.from('fret_courses' as any)
          .select('chauffeur_cost_fcfa, status')
          .eq('chauffeur_paid', false)
          .neq('status', 'ANNULE'),
        // Coûts transporteurs aérien / maritime
        supabase.from('dossiers')
          .select('carrier_cost_xof, carrier_paid_at, delivered_at, created_at, status')
          .not('carrier_cost_xof', 'is', null)
          .not('status', 'in', '(CANCELLED,ARCHIVED)')
          .gte('created_at', since),
        // Restes à payer transporteurs aérien / maritime
        supabase.from('dossiers')
          .select('carrier_cost_xof, status')
          .eq('carrier_paid', false)
          .not('carrier_cost_xof', 'is', null)
          .not('status', 'in', '(CANCELLED,ARCHIVED)'),
      ]);

      const buckets = new Map<MonthKey, MonthLedger>();
      const now = new Date();
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.set(key, {
          month: key, label: monthLabel(key),
          revenueXof: 0, costGpXof: 0, costRoadXof: 0, costCarrierXof: 0, costTotalXof: 0, marginXof: 0, tvaXof: 0,
        });
      }
      const bucket = (iso: string | null | undefined) => {
        const k = monthKey(iso);
        return k ? buckets.get(k) : undefined;
      };

      (paidR.data || []).forEach((d: any) => {
        const b = bucket(d.paid_at);
        if (b) b.revenueXof += xofOf(d);
      });

      (gpR.data || []).forEach((d: any) => {
        const b = bucket(d.delivered_at ?? d.created_at);
        if (b) b.costGpXof += Number(d.gp_amount || 0);
      });

      (roadR.data || []).forEach((c: any) => {
        if (c.status === 'ANNULE') return;
        const b = bucket(c.delivered_at ?? c.created_at);
        if (!b) return;
        b.costRoadXof += Number(c.chauffeur_cost_fcfa || 0);
        // Une course sans dossier lié n'est comptée nulle part ailleurs : c'est du revenu direct.
        if (!c.dossier_id && c.status === 'LIVRE') b.revenueXof += Number(c.total_fcfa || 0);
      });

      ((carrierR as any).data || []).forEach((d: any) => {
        const b = bucket(d.carrier_paid_at ?? d.delivered_at ?? d.created_at);
        if (b) b.costCarrierXof += Number(d.carrier_cost_xof || 0);
      });

      const months = Array.from(buckets.values()).map((m) => {
        m.costTotalXof = m.costGpXof + m.costRoadXof + m.costCarrierXof;
        m.marginXof = m.revenueXof - m.costTotalXof;
        m.tvaXof = Math.max(0, Math.round(m.marginXof * TVA_RATE));
        return m;
      });

      const dueGpXof = (gpDueR.data || []).reduce((s: number, d: any) => s + Number(d.gp_amount || 0), 0);
      const roadDue = (roadDueR.data || []) as any[];
      const dueRoadXof = roadDue.reduce((s, c) => s + Number(c.chauffeur_cost_fcfa || 0), 0);
      const missingRoadRateCount = roadDue.filter(
        (c) => c.status === 'LIVRE' && !Number(c.chauffeur_cost_fcfa || 0),
      ).length;

      const dueCarrierXof = (((carrierDueR as any).data || []) as any[])
        .reduce((s, d) => s + Number(d.carrier_cost_xof || 0), 0);

      return {
        months,
        current: months[months.length - 1],
        dueGpXof,
        dueRoadXof,
        dueCarrierXof,
        missingRoadRateCount,
      };
    },
    staleTime: 60_000,
  });
}

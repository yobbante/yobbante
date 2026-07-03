import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Compteurs "Morning Brief" — 4 KPI actionnables affichés en haut de la Vue Globale.
 * Aussi utilisé pour les KPI Finances (revenus / coût GP / marge / paiements en attente).
 */
export function useAdminBrief() {
  return useQuery({
    queryKey: ['admin-brief-v1'],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date();
      const day = (now.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(now); monday.setDate(now.getDate() - day); monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
      const som = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [noGpR, unreadR, pendingR, deps1R, deps2R, monthPaidR, monthGpR] = await Promise.all([
        // Dossiers sans GP (à assigner) — actifs, non terminaux
        supabase.from('dossiers')
          .select('id', { count: 'exact', head: true })
          .in('status', ['SUBMITTED', 'IN_REVIEW', 'CONFIRMED', 'ASSIGNED', 'EN_RECHERCHE_DEPART'] as any)
          .is('assigned_transporteur_ref', null),
        // Messages WhatsApp non lus (hors staff Yobbanté)
        supabase.from('whatsapp_inbound_messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .not('from_phone', 'eq', '221784604003')
          .not('from_name', 'eq', 'ANB'),
        // Paiements en attente
        supabase.from('dossiers')
          .select('id, estimated_cost, final_amount_xof', { count: 'exact' })
          .eq('payment_status', 'pending')
          .not('status', 'in', '(DELIVERED,CLOSED,CANCELLED,ARCHIVED)' as any),
        // Départs cette semaine — manuels
        supabase.from('manual_departures')
          .select('id', { count: 'exact', head: true })
          .gte('departure_date', monday.toISOString())
          .lt('departure_date', sunday.toISOString()),
        // Départs cette semaine — konnekt
        supabase.from('konnekt_departures')
          .select('id', { count: 'exact', head: true })
          .gte('departure_date', monday.toISOString())
          .lt('departure_date', sunday.toISOString()),
        // Encaissé ce mois
        supabase.from('dossiers')
          .select('final_amount_xof, estimated_cost, paid_at')
          .eq('payment_status', 'paid')
          .gte('paid_at', som),
        // Coût GP ce mois
        supabase.from('dossiers')
          .select('gp_amount, gp_paid_at, delivered_at')
          .not('gp_amount', 'is', null)
          .gte('delivered_at', som),
      ]);

      const revenuePendingXof = (pendingR.data || []).reduce((s: number, d: any) => {
        const xof = d.final_amount_xof ?? (d.estimated_cost != null ? Math.round(Number(d.estimated_cost) * 655.957) : 0);
        return s + Number(xof || 0);
      }, 0);

      const revenueMonthXof = (monthPaidR.data || []).reduce((s: number, d: any) => {
        const xof = d.final_amount_xof ?? (d.estimated_cost != null ? Math.round(Number(d.estimated_cost) * 655.957) : 0);
        return s + Number(xof || 0);
      }, 0);

      const gpCostMonthXof = (monthGpR.data || []).reduce((s: number, d: any) => s + Number(d.gp_amount || 0), 0);

      return {
        dossiersNoGp: noGpR.count ?? 0,
        unreadMessages: unreadR.count ?? 0,
        pendingPaymentsCount: pendingR.count ?? 0,
        pendingPaymentsXof: revenuePendingXof,
        departuresWeek: (deps1R.count ?? 0) + (deps2R.count ?? 0),
        revenueMonthXof,
        gpCostMonthXof,
        marginMonthXof: revenueMonthXof - gpCostMonthXof,
      };
    },
  });
}

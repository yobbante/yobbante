import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TransportMode } from '@/hooks/useAllPayments';

/**
 * Annuaire unifié des transporteurs, par type :
 *  - `gp`      → table transporteurs (voyageurs GP)
 *  - `road`    → table chauffeurs (fret routier)
 *  - `partner` → table delivery_partners (relais / transitaires, aérien & maritime)
 *
 * Sert au sélecteur « Transporteur alloué » de la fiche paiement.
 */

export type CarrierType = 'gp' | 'road' | 'partner';

export type CarrierEntry = {
  id: string;
  type: CarrierType;
  name: string;
  ref: string | null;
  phone: string | null;
  detail: string | null;
};

export const CARRIER_TYPE_LABEL: Record<CarrierType, string> = {
  gp: 'GP / voyageur',
  road: 'Chauffeur routier',
  partner: 'Partenaire / transitaire',
};

/** Types pertinents selon le mode de transport du dossier. */
export function carrierTypesForMode(mode: TransportMode): CarrierType[] {
  if (mode === 'gp') return ['gp', 'partner'];
  if (mode === 'road') return ['road', 'partner'];
  if (mode === 'air' || mode === 'sea') return ['partner', 'gp'];
  return ['gp', 'road', 'partner'];
}

export function useCarrierDirectory(types: CarrierType[]) {
  const key = [...types].sort().join(',');
  return useQuery({
    queryKey: ['carrier-directory', key],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CarrierEntry[]> => {
      const out: CarrierEntry[] = [];

      if (types.includes('gp')) {
        const { data } = await supabase
          .from('transporteurs')
          .select('id, nom, prenom, reference, telephone_1, whatsapp, ville, actif')
          .eq('actif', true)
          .order('nom')
          .limit(1000);
        for (const t of (data ?? []) as any[]) {
          const name = [t.prenom, t.nom].filter(Boolean).join(' ').trim();
          if (!name && !t.reference) continue;
          out.push({
            id: t.id,
            type: 'gp',
            name: name || `GP ${t.reference}`,
            ref: t.reference ? String(t.reference) : null,
            phone: t.telephone_1 || t.whatsapp || null,
            detail: t.ville || null,
          });
        }
      }

      if (types.includes('road')) {
        const { data } = await supabase
          .from('chauffeurs' as never)
          .select('id, nom_complet, telephone, immatriculation, routes, is_active')
          .eq('is_active', true)
          .limit(500);
        for (const c of (data ?? []) as any[]) {
          out.push({
            id: c.id,
            type: 'road',
            name: c.nom_complet || c.telephone || 'Chauffeur',
            ref: c.immatriculation || null,
            phone: c.telephone || null,
            detail: Array.isArray(c.routes) ? c.routes.join(', ') : null,
          });
        }
      }

      if (types.includes('partner')) {
        const { data } = await supabase
          .from('delivery_partners' as never)
          .select('id, name, phone, destination_country, is_active')
          .eq('is_active', true)
          .limit(500);
        for (const p of (data ?? []) as any[]) {
          out.push({
            id: p.id,
            type: 'partner',
            name: p.name || 'Partenaire',
            ref: null,
            phone: p.phone || null,
            detail: p.destination_country || null,
          });
        }
      }

      return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
  });
}

/**
 * Résolution automatique du transporteur d'un dossier :
 * référence GP assignée → fiche transporteur, sinon chauffeur de la course fret liée.
 */
export function useResolvedCarrier(dossier: {
  id?: string | null;
  assigned_transporteur_ref?: string | null;
  gp_id?: string | null;
  carrier_name?: string | null;
} | null | undefined) {
  const ref = dossier?.assigned_transporteur_ref ?? null;
  const gpId = dossier?.gp_id ?? null;
  const dossierId = dossier?.id ?? null;

  return useQuery({
    queryKey: ['resolved-carrier', ref, gpId, dossierId],
    enabled: !!(ref || gpId || dossierId),
    staleTime: 60_000,
    queryFn: async (): Promise<CarrierEntry | null> => {
      if (ref || gpId) {
        let q = supabase
          .from('transporteurs')
          .select('id, nom, prenom, reference, telephone_1, whatsapp, ville');
        q = ref ? q.eq('reference', ref) : q.eq('id', gpId as string);
        const { data } = await q.maybeSingle();
        if (data) {
          const t = data as any;
          const name = [t.prenom, t.nom].filter(Boolean).join(' ').trim();
          return {
            id: t.id,
            type: 'gp',
            name: name || `GP ${t.reference}`,
            ref: t.reference ? String(t.reference) : null,
            phone: t.telephone_1 || t.whatsapp || null,
            detail: t.ville || null,
          };
        }
      }

      if (dossierId) {
        const { data } = await supabase
          .from('fret_courses' as never)
          .select('chauffeur_id, dossier_id')
          .eq('dossier_id', dossierId)
          .not('chauffeur_id', 'is', null)
          .limit(1)
          .maybeSingle();
        const chauffeurId = (data as any)?.chauffeur_id;
        if (chauffeurId) {
          const { data: c } = await supabase
            .from('chauffeurs' as never)
            .select('id, nom_complet, telephone, immatriculation')
            .eq('id', chauffeurId)
            .maybeSingle();
          if (c) {
            const ch = c as any;
            return {
              id: ch.id,
              type: 'road',
              name: ch.nom_complet || ch.telephone || 'Chauffeur',
              ref: ch.immatriculation || null,
              phone: ch.telephone || null,
              detail: null,
            };
          }
        }
      }

      return null;
    },
  });
}

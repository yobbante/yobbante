import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  devisValidUntil, formatDevisMessage, isDevisExpired,
  type DevisLine, type DevisRow,
} from '@/lib/devis';

const SELECT =
  'id, reference, version, parent_id, is_current, dossier_id, conversation_phone, engine, origin, destination, weight_kg, colis_size, mode, breakdown, total_fcfa, total_manual, notes, status, valid_until, sent_at, created_at';

function normalize(r: Record<string, unknown>): DevisRow {
  const row = r as unknown as DevisRow;
  return {
    ...row,
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
  };
}

export type DevisDraft = {
  dossier_id?: string | null;
  conversation_phone?: string | null;
  engine: DevisRow['engine'];
  origin?: string | null;
  destination?: string | null;
  weight_kg?: number | null;
  colis_size?: string | null;
  mode?: string | null;
  breakdown: DevisLine[];
  total_fcfa: number;
  total_manual?: boolean;
  notes?: string | null;
  valid_until?: string;
};

/** Liste les devis d'une conversation (téléphone) et/ou d'un dossier. */
export function useDevisList(opts: { phone?: string | null; dossierId?: string | null; enabled?: boolean }) {
  const { phone, dossierId, enabled = true } = opts;
  return useQuery({
    queryKey: ['devis', phone ?? null, dossierId ?? null],
    enabled: enabled && !!(phone || dossierId),
    queryFn: async (): Promise<DevisRow[]> => {
      let q = supabase.from('devis').select(SELECT).order('created_at', { ascending: false }).limit(50);
      if (phone && dossierId) q = q.or(`conversation_phone.eq.${phone},dossier_id.eq.${dossierId}`);
      else if (phone) q = q.eq('conversation_phone', phone);
      else if (dossierId) q = q.eq('dossier_id', dossierId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((d) => normalize(d as Record<string, unknown>));
    },
  });
}

/**
 * Crée un devis. Statut TOUJOURS `pending_send` : aucun message WhatsApp
 * n'est envoyé tant qu'un agent n'a pas explicitement cliqué "Envoyer".
 */
export async function createDevis(draft: DevisDraft): Promise<DevisRow | null> {
  const { data, error } = await supabase
    .from('devis')
    .insert({
      dossier_id: draft.dossier_id ?? null,
      conversation_phone: draft.conversation_phone ?? null,
      engine: draft.engine,
      origin: draft.origin ?? null,
      destination: draft.destination ?? null,
      weight_kg: draft.weight_kg ?? null,
      colis_size: draft.colis_size ?? null,
      mode: draft.mode ?? null,
      breakdown: draft.breakdown as unknown as never,
      total_fcfa: Math.round(draft.total_fcfa || 0),
      total_manual: draft.total_manual ?? false,
      notes: draft.notes ?? null,
      status: 'pending_send',
      valid_until: draft.valid_until ?? devisValidUntil(),
    })
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data as Record<string, unknown>) : null;
}

export function useDevisActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['devis'] });

  const create = useMutation({
    mutationFn: (draft: DevisDraft) => createDevis(draft),
    onSuccess: invalidate,
  });

  /**
   * Enregistre une modification :
   * - devis jamais envoyé → mise à jour en place (même version) ;
   * - devis déjà envoyé  → nouvelle version, l'originale est conservée
   *   telle quelle (is_current = false), jamais écrasée.
   */
  const saveEdit = useMutation({
    mutationFn: async ({ base, patch }: { base: DevisRow; patch: Partial<DevisDraft> }) => {
      const merged = {
        engine: patch.engine ?? base.engine,
        origin: patch.origin ?? base.origin,
        destination: patch.destination ?? base.destination,
        weight_kg: patch.weight_kg ?? base.weight_kg,
        colis_size: patch.colis_size ?? base.colis_size,
        mode: patch.mode ?? base.mode,
        breakdown: (patch.breakdown ?? base.breakdown) as unknown as never,
        total_fcfa: Math.round(patch.total_fcfa ?? base.total_fcfa),
        total_manual: patch.total_manual ?? base.total_manual,
        notes: patch.notes ?? base.notes,
        valid_until: patch.valid_until ?? base.valid_until,
      };

      if (base.status === 'pending_send') {
        const { data, error } = await supabase
          .from('devis').update(merged).eq('id', base.id).select(SELECT).maybeSingle();
        if (error) throw error;
        return normalize(data as Record<string, unknown>);
      }

      await supabase.from('devis').update({ is_current: false }).eq('id', base.id);
      const { data, error } = await supabase
        .from('devis')
        .insert({
          ...merged,
          reference: base.reference,
          version: base.version + 1,
          parent_id: base.id,
          dossier_id: base.dossier_id,
          conversation_phone: base.conversation_phone,
          status: 'pending_send',
        })
        .select(SELECT)
        .maybeSingle();
      if (error) throw error;
      return normalize(data as Record<string, unknown>);
    },
    onSuccess: invalidate,
  });

  /** Envoi WhatsApp — unique mécanisme d'envoi pour tous les devis. */
  const send = useMutation({
    mutationFn: async ({ devis, phone }: { devis: DevisRow; phone: string }) => {
      const message = formatDevisMessage(devis);
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: phone,
          recipient_type: 'client',
          message,
          template: 'free_text',
          trigger_type: 'admin_devis',
        },
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from('devis')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          conversation_phone: devis.conversation_phone ?? phone,
        })
        .eq('id', devis.id);
      if (upErr) throw upErr;
      return message;
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DevisRow['status'] }) => {
      const { error } = await supabase.from('devis').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, saveEdit, send, setStatus };
}

export { isDevisExpired, formatDevisMessage };

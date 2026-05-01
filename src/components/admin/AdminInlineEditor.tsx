import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2, ShieldCheck, StickyNote, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  SHIPMENT_WORKFLOW_ORDER, SHIPMENT_STATUS_LABELS, type ShipmentStatus,
  DOSSIER_STATUS_ORDER, DOSSIER_STATUS_LABELS, type DossierStatus,
} from '@/lib/types';

type Kind = 'shipment' | 'dossier' | 'reception_order';

interface Props {
  /** Type d'enregistrement piloté. */
  kind: Kind;
  /** Id de l'enregistrement (shipments.id, dossiers.id, reception_orders.id). */
  id: string;
  /** Statut courant (texte). */
  status: string;
  /** Optionnel — référence affichée dans les toasts. */
  reference?: string | null;
}

/* Statuts disponibles selon le kind. */
const SHIPMENT_OPTIONS: ShipmentStatus[] = SHIPMENT_WORKFLOW_ORDER;
const DOSSIER_OPTIONS: DossierStatus[] = DOSSIER_STATUS_ORDER;
const RECEPTION_OPTIONS = [
  'pending_arrival', 'received', 'measured', 'awaiting_payment',
  'paid', 'shipped', 'delivered', 'cancelled',
] as const;

const RECEPTION_LABELS: Record<string, string> = {
  pending_arrival: 'En attente arrivée',
  received: 'Reçu au hub',
  measured: 'Pesé / mesuré',
  awaiting_payment: 'Paiement en attente',
  paid: 'Payé',
  shipped: 'Expédié',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

/**
 * Bandeau d'édition inline réservé aux admins/staff.
 * Permet de changer le statut d'un envoi, dossier ou commande de réception
 * directement depuis le drawer client, sans quitter le contexte.
 */
export function AdminInlineEditor({ kind, id, status, reference }: Props) {
  const { isStaff } = useUserRole();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const { options, labels, table, statusColumn, ranks } = useMemo(() => {
    if (kind === 'shipment') {
      return {
        options: SHIPMENT_OPTIONS as readonly string[],
        labels: SHIPMENT_STATUS_LABELS as Record<string, string>,
        table: 'shipments' as const,
        statusColumn: 'status' as const,
        ranks: SHIPMENT_OPTIONS as readonly string[],
      };
    }
    if (kind === 'dossier') {
      return {
        options: DOSSIER_OPTIONS as readonly string[],
        labels: DOSSIER_STATUS_LABELS as Record<string, string>,
        table: 'dossiers' as const,
        statusColumn: 'status' as const,
        ranks: DOSSIER_OPTIONS as readonly string[],
      };
    }
    return {
      options: RECEPTION_OPTIONS as readonly string[],
      labels: RECEPTION_LABELS,
      table: 'reception_orders' as const,
      statusColumn: 'status' as const,
      ranks: RECEPTION_OPTIONS as readonly string[],
    };
  }, [kind]);

  if (!isStaff) return null;

  const currentRank = ranks.indexOf(status);
  const nextStatus = currentRank >= 0 && currentRank < ranks.length - 1
    ? ranks[currentRank + 1]
    : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
    queryClient.invalidateQueries({ queryKey: ['dossiers'] });
    queryClient.invalidateQueries({ queryKey: ['reception-orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const updateStatus = async (next: string) => {
    if (next === status) return;
    setPending(next);
    try {
      const { error } = await (supabase.from(table) as any)
        .update({ [statusColumn]: next })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Statut mis à jour → ${labels[next] ?? next}`, {
        description: reference ?? undefined,
      });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise à jour impossible');
    } finally {
      setPending(null);
    }
  };

  const saveNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error('Note vide');
      return;
    }
    setSavingNote(true);
    try {
      if (kind === 'shipment') {
        // Append to shipment_events as internal admin note
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('shipment_events').insert({
          shipment_id: id,
          event_type: 'admin_note',
          triggered_by: 'admin',
          note: trimmed,
          metadata: user ? { admin_user_id: user.id } : {},
        });
        if (error) throw error;
      } else if (kind === 'dossier') {
        // Read current admin_notes, append new line
        const { data: cur, error: readErr } = await supabase
          .from('dossiers').select('admin_notes').eq('id', id).single();
        if (readErr) throw readErr;
        const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const next = `${cur?.admin_notes ? cur.admin_notes + '\n' : ''}[${stamp}] ${trimmed}`;
        const { error } = await supabase.from('dossiers')
          .update({ admin_notes: next }).eq('id', id);
        if (error) throw error;
      } else {
        // reception_orders: append to internal_note
        const { data: cur, error: readErr } = await supabase
          .from('reception_orders').select('internal_note').eq('id', id).single();
        if (readErr) throw readErr;
        const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const next = `${cur?.internal_note ? cur.internal_note + '\n' : ''}[${stamp}] ${trimmed}`;
        const { error } = await supabase.from('reception_orders')
          .update({ internal_note: next }).eq('id', id);
        if (error) throw error;
      }
      toast.success('Note interne enregistrée');
      setNote('');
      setShowNote(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-400" />
        <h4 className="text-[11px] uppercase tracking-[0.18em] font-bold text-amber-400">
          Édition admin
        </h4>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Visible uniquement par le staff
        </span>
      </header>

      {/* Quick advance */}
      {nextStatus && (
        <button
          type="button"
          disabled={!!pending}
          onClick={() => updateStatus(nextStatus)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            {pending === nextStatus
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ArrowRight className="w-4 h-4" />}
            Avancer à : {labels[nextStatus] ?? nextStatus}
          </span>
          <ChevronRight className="w-4 h-4 opacity-70" />
        </button>
      )}

      {/* Status grid (all valid options) */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
          Forcer un statut
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {options.map(opt => {
            const active = opt === status;
            const loading = pending === opt;
            return (
              <button
                key={opt}
                type="button"
                disabled={!!pending || active}
                onClick={() => updateStatus(opt)}
                className={[
                  'group relative inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors',
                  active
                    ? 'bg-primary/15 border-primary/40 text-primary cursor-default'
                    : 'bg-card border-border text-foreground hover:border-foreground/40',
                  pending && !loading && !active && 'opacity-50',
                ].filter(Boolean).join(' ')}
              >
                <span className="truncate text-left">{labels[opt] ?? opt}</span>
                {active && <Check className="w-3 h-3 shrink-0" />}
                {loading && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Internal note */}
      <div>
        {!showNote ? (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <StickyNote className="w-3.5 h-3.5" /> Ajouter une note interne
          </button>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : Client contacté par WhatsApp, dépose colis demain matin…"
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setShowNote(false); setNote(''); }}>
                Annuler
              </Button>
              <Button size="sm" className="flex-1" onClick={saveNote} disabled={savingNote || !note.trim()}>
                {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <StickyNote className="w-3.5 h-3.5 mr-1.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

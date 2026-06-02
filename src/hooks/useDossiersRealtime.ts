import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DOSSIER_STATUS_LABELS, type DossierStatus } from '@/lib/types';

/**
 * Subscribe to realtime status changes on the user's dossiers + dossier_events.
 * - Dedupes rapid status flips (last-write-wins per dossier).
 * - Debounces query invalidations to coalesce bursts (avoids UI thrash).
 * - Surfaces toasts for status changes, new departure assignments,
 *   and admin-side departure decision updates.
 */
export function useDossiersRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const seenStatusRef = useRef<Map<string, DossierStatus>>(new Map());
  const seenDepartureRef = useRef<Map<string, string | null>>(new Map());
  const seenDecisionRef = useRef<Map<string, string | null>>(new Map());
  const seenEventRef = useRef<Set<string>>(new Set());
  const invalidateTimer = useRef<number | null>(null);

  // Coalesce multiple invalidations within a 250ms window
  function scheduleInvalidate(dossierId?: string) {
    if (invalidateTimer.current !== null) window.clearTimeout(invalidateTimer.current);
    invalidateTimer.current = window.setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      if (dossierId) qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['client-audit-log'] });
      invalidateTimer.current = null;
    }, 250);
  }

  useEffect(() => {
    if (!user?.id) return;

    const dossiersChannel = supabase
      .channel(`dossiers-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dossiers', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as {
            id: string;
            reference?: string;
            tracking_id?: string;
            status: DossierStatus;
            assigned_departure_id?: string | null;
            client_departure_decision?: string | null;
          };
          const ref = next.tracking_id || next.reference || '';

          // Status change toast (only if it actually changed vs last seen)
          const prevStatus = seenStatusRef.current.get(next.id);
          seenStatusRef.current.set(next.id, next.status);
          if (prevStatus && prevStatus !== next.status) {
            const CLIENT_STATUS_TOASTS: Record<string, string> = {
              ASSIGNED: 'Pris en charge ✓',
              COLLECTED: 'Collecté ✓',
              IN_TRANSIT: 'En route ✈',
              ARRIVED_HUB: 'Arrivé ✓',
              DELIVERED: 'Livré ✓',
            };
            const customLabel = CLIENT_STATUS_TOASTS[next.status as string];
            const label = customLabel ?? (DOSSIER_STATUS_LABELS[next.status] ?? next.status);
            toast.success(`${ref} — ${label}`, { id: `status-${next.id}`, duration: 3000 });
          }

          // New departure assigned
          const prevDep = seenDepartureRef.current.get(next.id);
          const nextDep = next.assigned_departure_id ?? null;
          seenDepartureRef.current.set(next.id, nextDep);
          if (prevDep !== undefined && prevDep !== nextDep && nextDep) {
            toast(`✈ Un départ a été assigné à votre colis ${ref}. Veuillez confirmer.`, {
              id: `dep-${next.id}`,
              className: 'border-[#F5C518]/40 bg-[#F5C518]/10',
              duration: 8000,
            });
          }

          // Departure decision flipped (confirmed/cancelled via public link)
          const prevDecision = seenDecisionRef.current.get(next.id);
          const nextDecision = next.client_departure_decision ?? null;
          seenDecisionRef.current.set(next.id, nextDecision);
          if (prevDecision !== undefined && prevDecision !== nextDecision && nextDecision && nextDecision !== 'pending') {
            const msg = nextDecision === 'confirmed'
              ? `✅ Départ confirmé pour ${ref}`
              : `⚠ Départ refusé pour ${ref} — à réassigner`;
            toast(msg, { id: `decision-${next.id}`, duration: 6000 });
          }

          scheduleInvalidate(next.id);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dossiers', filter: `user_id=eq.${user.id}` },
        () => scheduleInvalidate(),
      )
      .subscribe();

    // Listen to dossier_events for the client's dossiers so the audit log
    // and any inline timelines refresh immediately. We dedupe by event id.
    const eventsChannel = supabase
      .channel(`dossier-events-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dossier_events' },
        (payload) => {
          const ev = payload.new as { id: string; dossier_id: string; event_type: string };
          if (seenEventRef.current.has(ev.id)) return;
          seenEventRef.current.add(ev.id);
          // Cap memory
          if (seenEventRef.current.size > 500) {
            seenEventRef.current = new Set(Array.from(seenEventRef.current).slice(-250));
          }
          scheduleInvalidate(ev.dossier_id);
        },
      )
      .subscribe();

    return () => {
      if (invalidateTimer.current !== null) window.clearTimeout(invalidateTimer.current);
      supabase.removeChannel(dossiersChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [user?.id, qc]);
}

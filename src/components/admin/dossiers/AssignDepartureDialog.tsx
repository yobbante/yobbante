/**
 * Modal d'assignation : GP -> Départ spécifique -> Confirmation.
 * Lie un dossier à un manual_departures.id et met à jour la capacité réservée.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { Loader2, Truck, Plane, ChevronLeft, AlertTriangle, Plus, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TransporteurReferenceLookup } from '@/components/admin/TransporteurReferenceLookup';
import { assignDossierToDeparture } from '@/lib/assignGpAndNotify';
import { clarityEvent } from '@/lib/clarity';
import { useNavigate } from 'react-router-dom';
import { ManualDepartureForm } from '@/components/admin/ManualDepartureForm';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dossierId: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  weightKg?: number | null;
  /** Optionnel : démarrer directement à l'étape 2 (changer de départ pour un GP déjà assigné). */
  initialTransporteurRef?: string | null;
  initialStep?: 1 | 2;
}

type Step = 1 | 2 | 3;

export function AssignDepartureDialog({
  open, onOpenChange, dossierId,
  destinationCity, destinationCountry, weightKg,
  initialTransporteurRef, initialStep = 1,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(initialStep);
  const [ref, setRef] = useState(initialTransporteurRef ?? '');
  const [gp, setGp] = useState<any>(null);
  const [departureId, setDepartureId] = useState<string | null>(null);
  // CORRECTION #3 — ouverture du formulaire "Nouveau départ" en overlay,
  // sans navigation vers /admin/departures (évite de perdre le dossier en cours).
  const [createDepartureOpen, setCreateDepartureOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setRef(initialTransporteurRef ?? '');
      setDepartureId(null);
    }
  }, [open, initialStep, initialTransporteurRef]);

  // Step 2 — Departures of this GP toward this destination
  const { data: departures, isLoading: depLoading } = useQuery({
    queryKey: ['assign-departures', ref, destinationCity, destinationCountry],
    enabled: open && step >= 2 && /^\d{4}$/.test(ref),
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase
        .from('manual_departures')
        .select('id, departure_date, origin_city, destination_city, destination_country, transport_mode, total_capacity_kg, available_capacity_kg, reserved_capacity_kg, short_ref, status, transporteur_ref')
        .eq('transporteur_ref', ref)
        .gte('departure_date', today)
        .in('status', ['active', 'draft'])
        .order('departure_date', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      const arr = data ?? [];
      const dc = (destinationCity || '').toLowerCase().trim();
      const cc = (destinationCountry || '').toUpperCase().trim();
      const matched = arr.filter((d: any) => {
        const okCity = dc ? (d.destination_city || '').toLowerCase().includes(dc) : true;
        const okCountry = cc ? (d.destination_country || '').toUpperCase() === cc : true;
        return okCity || okCountry;
      });
      return matched.length > 0 ? matched : arr; // fallback : tous départs du GP
    },
  });

  // For each departure, count dossiers already assigned
  const { data: counts } = useQuery({
    queryKey: ['assign-departure-counts', (departures ?? []).map((d: any) => d.id).join(',')],
    enabled: !!departures && departures.length > 0,
    queryFn: async () => {
      const ids = (departures ?? []).map((d: any) => d.id);
      const { data, error } = await supabase
        .from('dossiers')
        .select('assigned_departure_id')
        .in('assigned_departure_id', ids);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((d: any) => {
        map[d.assigned_departure_id] = (map[d.assigned_departure_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const selectedDeparture = useMemo(
    () => (departures ?? []).find((d: any) => d.id === departureId) ?? null,
    [departures, departureId],
  );

  const remainingAfter = useMemo(() => {
    if (!selectedDeparture) return null;
    const w = Number(weightKg ?? 0) || 0;
    return Math.round((selectedDeparture.available_capacity_kg ?? 0) - w);
  }, [selectedDeparture, weightKg]);

  const overCapacity = remainingAfter !== null && remainingAfter < 0;

  const confirm = useMutation({
    mutationFn: async () => {
      if (!departureId) throw new Error('Sélectionnez un départ');
      const res = await assignDossierToDeparture({
        dossierId,
        departureId,
        transporteurRef: ref,
      });
      if (!res.ok) throw new Error('Échec assignation');
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['manual_departures'] });
      const fb = res?.clientFallback;
      if (fb) {
        toast.success('Départ assigné', {
          description: 'Si le client ne reçoit pas le WhatsApp auto, envoyez-le depuis votre téléphone.',
          duration: 12000,
          action: {
            label: 'Envoyer via mon tel',
            onClick: () => {
              clarityEvent('wa_fallback_sent', { dossier_id: dossierId, source: 'assign_dialog' });
              window.open(fb.waHref, '_blank', 'noopener,noreferrer');
            },
          },
        });
      } else {
        toast.success('Départ assigné');
      }
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#F5C518]" />
            Assigner un GP et un départ
          </DialogTitle>
          <DialogDescription>
            Étape {step} sur 3
            {destinationCity || destinationCountry
              ? ` · Destination : ${destinationCity ?? ''} ${destinationCountry ?? ''}`.trim()
              : ''}
          </DialogDescription>
        </DialogHeader>

        {/* ───── Step 1 : choisir le GP ───── */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Saisis la référence à 4 chiffres du transporteur.
            </p>
            <TransporteurReferenceLookup
              value={ref}
              onChange={setRef}
              onMatch={setGp}
              destinationCity={destinationCity ?? null}
              destinationCountry={destinationCountry ?? null}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button
                size="sm"
                onClick={() => setStep(2)}
                disabled={!/^\d{4}$/.test(ref)}
                className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}

        {/* ───── Step 2 : choisir le départ ───── */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Changer de GP
              </Button>
              <Badge variant="secondary" className="font-mono">GP #{ref}</Badge>
            </div>

            {depLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Chargement des départs…
              </div>
            ) : (departures?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4 space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-orange-100">
                      Ce GP n'a pas de départ prévu pour cette destination.
                    </div>
                    <div className="text-xs text-orange-200/80 mt-1">
                      Voulez-vous créer un départ maintenant ?
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
                  onClick={() => setCreateDepartureOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Créer un départ pour ce GP
                </Button>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                {departures!.map((d: any) => {
                  const isSelected = d.id === departureId;
                  const count = counts?.[d.id] ?? 0;
                  const pct = d.total_capacity_kg > 0
                    ? Math.round(((d.total_capacity_kg - d.available_capacity_kg) / d.total_capacity_kg) * 100)
                    : 0;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => setDepartureId(d.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? 'border-[#F5C518] bg-[#F5C518]/10'
                            : 'border-border hover:border-[#F5C518]/40 hover:bg-secondary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Plane className="w-3.5 h-3.5 text-[#F5C518]" />
                            {d.origin_city} → {d.destination_city}
                          </div>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{d.short_ref ?? '----'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {fmtDate(d.departure_date)}
                          </span>
                          <span>{d.available_capacity_kg}kg dispo</span>
                          <span className="inline-flex items-center gap-1">
                            <Package className="w-3 h-3" /> {count} colis
                          </span>
                        </div>
                        <CapacityBar value={pct} ariaLabel="Capacité utilisée" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {(departures?.length ?? 0) > 0 && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
                <Button
                  size="sm"
                  onClick={() => setStep(3)}
                  disabled={!departureId}
                  className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
                >
                  Suivant
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ───── Step 3 : confirmation ───── */}
        {step === 3 && selectedDeparture && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
              <Row label="GP" value={`#${ref} ${gp ? `· ${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() : ''}`} />
              <Row
                label="Départ"
                value={`${selectedDeparture.origin_city} → ${selectedDeparture.destination_city} · ${fmtDate(selectedDeparture.departure_date)}`}
              />
              <Row label="Capacité restante" value={`${selectedDeparture.available_capacity_kg} kg`} />
              <Row label="Poids du colis" value={weightKg ? `${weightKg} kg` : 'À confirmer'} />
              <Row
                label="Capacité après"
                value={
                  remainingAfter !== null
                    ? `${remainingAfter} kg${overCapacity ? ' (dépassement)' : ''}`
                    : '—'
                }
                tone={overCapacity ? 'warn' : 'ok'}
              />
            </div>

            {overCapacity && (
              <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-100 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  ⚠️ Ce départ n'a que {selectedDeparture.available_capacity_kg}kg disponibles.
                  Votre colis pèse {weightKg}kg. Continuer quand même ?
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Retour
              </Button>
              <Button
                size="sm"
                onClick={() => confirm.mutate()}
                disabled={confirm.isPending}
                className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
              >
                {confirm.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Confirmer l'assignation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* CORRECTION #3 — Overlay "Nouveau départ" préremplis (GP + destination). */}
      <ManualDepartureForm
        open={createDepartureOpen}
        onClose={() => {
          setCreateDepartureOpen(false);
          // Refresh available departures so the new one shows up immediately.
          qc.invalidateQueries({ queryKey: ['assign-departures', ref] });
        }}
        departure={null}
        prefill={{
          transporteurRef: ref || null,
          destCity: destinationCity ?? null,
          destCountry: destinationCountry ?? null,
        }}
      />
    </Dialog>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${tone === 'warn' ? 'text-orange-300' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, MessageCircle, Plane, Package, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useGpDepartures, useGpColis, stepOf, GP_STEPS, GP_STEP_TONE } from '@/hooks/useGpTerrain';
import type { Transporteur } from '@/hooks/useTransporteurs';
import { cn } from '@/lib/utils';

export interface GpFiche extends Partial<Transporteur> {
  capacite_kg?: number | null;
}

/** Fiche transporteur GP — consultation, édition et historique des trajets. */
export function GpTransporteurSheet({
  gp, open, onOpenChange,
}: {
  gp: GpFiche | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const isNew = !gp?.id;
  const [form, setForm] = useState<GpFiche>({});
  const { data: departures = [] } = useGpDepartures(open);
  const { data: colis = [] } = useGpColis(open);

  useEffect(() => {
    if (open) setForm(gp ?? { actif: true, capacite_kg: 25 });
  }, [open, gp]);

  const set = (k: keyof GpFiche, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const trajets = useMemo(
    () => departures.filter(d => d.transporteur_ref && d.transporteur_ref === form.reference),
    [departures, form.reference],
  );
  const gpColis = useMemo(
    () => colis.filter(c => c.assigned_transporteur_ref === form.reference),
    [colis, form.reference],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        nom: form.nom?.trim() || null,
        prenom: form.prenom?.trim() || null,
        telephone_1: form.telephone_1?.trim() || '',
        telephone_2: form.telephone_2?.trim() || null,
        ville: form.ville?.trim() || null,
        zone: form.zone?.trim() || null,
        adresse_collecte_dakar: form.adresse_collecte_dakar?.trim() || null,
        capacite_kg: form.capacite_kg ?? 25,
        notes: form.notes?.trim() || null,
        actif: form.actif ?? true,
      };
      if (!payload.telephone_1) throw new Error('Le téléphone est obligatoire.');

      if (isNew) {
        // Référence unique à 4 chiffres.
        let ref = form.reference?.trim() || '';
        if (!/^\d{4}$/.test(ref)) {
          for (let i = 0; i < 25 && !/^\d{4}$/.test(ref); i++) {
            const candidate = String(Math.floor(1000 + Math.random() * 9000));
            const { data } = await supabase
              .from('transporteurs' as any)
              .select('id').eq('reference', candidate).maybeSingle();
            if (!data) ref = candidate;
          }
        }
        const { error } = await supabase.from('transporteurs' as any).insert({ ...payload, reference: ref });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transporteurs' as any).update(payload).eq('id', gp!.id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isNew ? 'Fiche transporteur créée' : 'Fiche mise à jour');
      qc.invalidateQueries({ queryKey: ['transporteurs'] });
      qc.invalidateQueries({ queryKey: ['gp-terrain-list'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erreur'),
  });

  const tel = form.telephone_1 ?? '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2 text-base">
            {isNew ? 'Nouveau transporteur GP' : `${form.nom ?? 'GP'} ${form.prenom ?? ''}`}
            {form.reference && (
              <Badge variant="outline" className="font-mono text-[10px]">#{form.reference}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Actions rapides */}
        {!isNew && tel && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <a href={`tel:${tel}`}><Phone className="w-3.5 h-3.5 mr-1" /> Appeler</a>
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
              </a>
            </Button>
          </div>
        )}

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nom"    value={form.nom ?? ''}    onChange={(v) => set('nom', v)} />
            <Field label="Prénom" value={form.prenom ?? ''} onChange={(v) => set('prenom', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone" value={form.telephone_1 ?? ''} onChange={(v) => set('telephone_1', v)} placeholder="+221…" />
            <Field label="Téléphone 2" value={form.telephone_2 ?? ''} onChange={(v) => set('telephone_2', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ville de destination" value={form.ville ?? ''} onChange={(v) => set('ville', v)} />
            <div>
              <Label className="text-xs">Capacité (kg)</Label>
              <Input
                type="number" inputMode="decimal" className="h-9"
                value={form.capacite_kg ?? 25}
                onChange={(e) => set('capacite_kg', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>
          <Field label="Adresse de collecte à Dakar" value={form.adresse_collecte_dakar ?? ''} onChange={(v) => set('adresse_collecte_dakar', v)} />
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm">Transporteur actif</span>
            <Switch checked={form.actif ?? true} onCheckedChange={(v) => set('actif', v)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="w-4 h-4 mr-1" /> {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Historique */}
        {!isNew && (
          <div className="mt-6 space-y-4">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5" /> Trajets ({trajets.length})
              </h3>
              {trajets.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun trajet enregistré.</p>
              ) : (
                <div className="space-y-1.5">
                  {trajets.slice(0, 15).map((t) => (
                    <div key={t.id} className="rounded-lg border border-border p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {t.origin_city ?? 'Dakar'} → {t.destination_city ?? t.destination_country ?? '—'}
                        </span>
                        <span className="text-muted-foreground">
                          {t.departure_date ? new Date(t.departure_date).toLocaleDateString('fr-FR') : '—'}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        Capacité {Number(t.max_capacity_kg ?? 25)} kg · réservé {Number(t.reserved_capacity_kg ?? 0)} kg
                        {t.arrival_estimate ? ` · arrivée ${new Date(t.arrival_estimate).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Colis confiés ({gpColis.length})
              </h3>
              {gpColis.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun colis confié.</p>
              ) : (
                <div className="space-y-1.5">
                  {gpColis.slice(0, 15).map((c) => {
                    const st = stepOf(c.status);
                    return (
                      <div key={c.id} className="rounded-lg border border-border p-2.5 text-xs flex items-center justify-between gap-2">
                        <span className="truncate">
                          <span className="font-mono text-muted-foreground">{c.reference ?? '—'}</span>{' '}
                          {c.recipient_name ?? c.sender_name ?? 'Client'}
                        </span>
                        <Badge variant="outline" className={cn('h-5 text-[9px] shrink-0', GP_STEP_TONE[st])}>
                          {GP_STEPS.find(s => s.id === st)?.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="h-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

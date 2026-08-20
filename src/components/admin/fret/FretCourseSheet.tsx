import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check, ClipboardCheck, Copy, Loader2, MapPin, MessageCircle, Package, Pencil, Phone, Truck, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FRET_STATUS_LABEL, type FretStatus } from '@/lib/fretApi';
import { useChauffeurs, type AdminFretCourse } from '@/hooks/useFretAdmin';
import { normalizePhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

export const FRET_STATUS_TONE: Record<FretStatus, string> = {
  A_ENLEVER: 'bg-orange-500/15 text-orange-600 border-orange-500/20',
  PENDING_ACCEPT: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  REMIS_CHAUFFEUR: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  EN_ROUTE: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  ARRIVE: 'bg-violet-500/15 text-violet-500 border-violet-500/20',
  LIVRE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  ANNULE: 'bg-muted text-muted-foreground border-border',
};

const FLOW: FretStatus[] = ['A_ENLEVER', 'PENDING_ACCEPT', 'REMIS_CHAUFFEUR', 'EN_ROUTE', 'ARRIVE', 'LIVRE'];

const STAMP_FIELD: Partial<Record<FretStatus, string>> = {
  PENDING_ACCEPT: 'remis_at',
  REMIS_CHAUFFEUR: 'accepted_at',
  EN_ROUTE: 'en_route_at',
  ARRIVE: 'arrived_at',
  LIVRE: 'delivered_at',
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

interface Props {
  course: AdminFretCourse | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Lecture seule : masque l'édition et les changements de statut. */
  readOnly?: boolean;
  onAssign?: (c: AdminFretCourse) => void;
}

export function FretCourseSheet({ course, open, onOpenChange, readOnly = false, onAssign }: Props) {
  const qc = useQueryClient();
  const { data: chauffeurs = [] } = useChauffeurs(open);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    destination: '', client_nom: '', client_phone: '', expediteur_nom: '', expediteur_phone: '',
    colis_description: '', pickup_address: '', weight_kg: '', total_fcfa: '',
  });

  useEffect(() => {
    if (!course) return;
    setEditing(false);
    setForm({
      destination: course.destination ?? '',
      client_nom: course.client_nom ?? '',
      client_phone: course.client_phone ?? '',
      expediteur_nom: course.expediteur_nom ?? '',
      expediteur_phone: course.expediteur_phone ?? '',
      colis_description: course.colis_description ?? '',
      pickup_address: course.pickup_address ?? '',
      weight_kg: course.weight_kg != null ? String(course.weight_kg) : '',
      total_fcfa: course.total_fcfa != null ? String(course.total_fcfa) : '',
    });
  }, [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const chauffeur = useMemo(
    () => chauffeurs.find((c) => c.id === course?.chauffeur_id) ?? null,
    [chauffeurs, course?.chauffeur_id],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['fret-courses'] });
    qc.invalidateQueries({ queryKey: ['chauffeurs'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const patch: Record<string, unknown> = {
        destination: form.destination.trim() || course.destination,
        client_nom: form.client_nom.trim() || null,
        client_phone: form.client_phone.trim() ? normalizePhone(form.client_phone) : null,
        expediteur_nom: form.expediteur_nom.trim() || null,
        expediteur_phone: form.expediteur_phone.trim() ? normalizePhone(form.expediteur_phone) : null,
        colis_description: form.colis_description.trim() || null,
        pickup_address: form.pickup_address.trim() || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        total_fcfa: form.total_fcfa ? Number(form.total_fcfa) : null,
      };
      const { error } = await supabase.from('fret_courses' as any).update(patch).eq('id', course.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Course mise à jour'); setEditing(false); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Mise à jour impossible'),
  });

  const setStatus = useMutation({
    mutationFn: async (next: FretStatus) => {
      if (!course) return;
      const stamp = STAMP_FIELD[next];
      const patch: Record<string, unknown> = { status: next };
      if (stamp) patch[stamp] = new Date().toISOString();
      const { error } = await supabase.from('fret_courses' as any).update(patch).eq('id', course.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Statut mis à jour'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Changement de statut impossible'),
  });

  if (!course) return null;

  const trackUrl = `${window.location.origin}/suivre/${course.ref}`;
  const stepIdx = FLOW.indexOf(course.status);
  const nextStatus = stepIdx >= 0 && stepIdx < FLOW.length - 1 ? FLOW[stepIdx + 1] : null;
  const cancelled = course.status === 'ANNULE';

  const timeline: { label: string; at: string | null }[] = [
    { label: 'Créée', at: course.created_at },
    { label: 'Remise chauffeur', at: course.remis_at },
    { label: 'Acceptée', at: course.accepted_at },
    { label: 'En route', at: course.en_route_at },
    { label: 'Arrivée', at: course.arrived_at },
    { label: 'Livrée', at: course.delivered_at },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-mono text-base">{course.ref}</DialogTitle>
              <DialogDescription className="mt-0.5">
                Dakar → {course.destination} · {course.client_nom || course.expediteur_nom || 'Client'}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={cn('shrink-0 text-[10px]', FRET_STATUS_TONE[course.status])}>
              {FRET_STATUS_LABEL[course.status]}
            </Badge>
          </div>
        </DialogHeader>

        {/* Progression */}
        {!cancelled && (
          <div className="flex items-center gap-1">
            {FLOW.map((s, i) => (
              <div
                key={s}
                title={FRET_STATUS_LABEL[s]}
                className={cn('h-1.5 flex-1 rounded-full', i <= stepIdx ? 'bg-primary' : 'bg-secondary')}
              />
            ))}
          </div>
        )}

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs"
                  onClick={() => { navigator.clipboard?.writeText(trackUrl); toast.success('Lien de suivi copié'); }}>
            <Copy className="w-3 h-3 mr-1" /> Lien suivi
          </Button>
          {course.client_phone && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <a href={`tel:${course.client_phone}`}><Phone className="w-3 h-3 mr-1" /> Appeler</a>
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <a
                  href={`https://wa.me/${course.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Bonjour${course.client_nom ? ' ' + course.client_nom : ''}, votre colis ${course.ref} (Dakar → ${course.destination}) : ${FRET_STATUS_LABEL[course.status]}. Suivi : ${trackUrl}`,
                  )}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                </a>
              </Button>
            </>
          )}
          {!readOnly && !course.chauffeur_id && onAssign && (
            <Button size="sm" className="h-8 text-xs" onClick={() => onAssign(course)}>
              <Truck className="w-3 h-3 mr-1" /> Assigner un chauffeur
            </Button>
          )}
        </div>

        {/* Détails / édition */}
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Informations</p>
            {!readOnly && (
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => setEditing((v) => !v)}>
                {editing ? <><X className="w-3 h-3 mr-1" /> Annuler</> : <><Pencil className="w-3 h-3 mr-1" /> Modifier</>}
              </Button>
            )}
          </div>

          {editing ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Destination" value={form.destination} onChange={(v) => setForm(f => ({ ...f, destination: v }))} />
              <Field label="Poids (kg)" value={form.weight_kg} onChange={(v) => setForm(f => ({ ...f, weight_kg: v }))} type="number" />
              <Field label="Destinataire" value={form.client_nom} onChange={(v) => setForm(f => ({ ...f, client_nom: v }))} />
              <Field label="Tél. destinataire" value={form.client_phone} onChange={(v) => setForm(f => ({ ...f, client_phone: v }))} />
              <Field label="Expéditeur" value={form.expediteur_nom} onChange={(v) => setForm(f => ({ ...f, expediteur_nom: v }))} />
              <Field label="Tél. expéditeur" value={form.expediteur_phone} onChange={(v) => setForm(f => ({ ...f, expediteur_phone: v }))} />
              <Field label="Adresse d'enlèvement" value={form.pickup_address} onChange={(v) => setForm(f => ({ ...f, pickup_address: v }))} className="sm:col-span-2" />
              <Field label="Total (FCFA)" value={form.total_fcfa} onChange={(v) => setForm(f => ({ ...f, total_fcfa: v }))} type="number" />
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[11px] text-muted-foreground">Description du colis</Label>
                <Textarea rows={2} value={form.colis_description}
                          onChange={(e) => setForm(f => ({ ...f, colis_description: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button size="sm" className="h-8 text-xs" disabled={save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <Row k="Destination" v={course.destination + (course.scope === 'international' ? ' (international)' : '')} />
              <Row k="Colis" v={[course.colis_description, course.colis_size, course.weight_kg ? `${course.weight_kg} kg` : null].filter(Boolean).join(' · ') || '—'} />
              <Row k="Destinataire" v={[course.client_nom, course.client_phone].filter(Boolean).join(' · ') || '—'} />
              <Row k="Expéditeur" v={[course.expediteur_nom, course.expediteur_phone].filter(Boolean).join(' · ') || '—'} />
              <Row k="Enlèvement" v={[course.pickup_address, course.pickup_zone, course.pickup_fee_fcfa ? `+${course.pickup_fee_fcfa.toLocaleString('fr-FR')} FCFA` : null].filter(Boolean).join(' · ') || '—'} />
              <Row k="Total" v={course.total_fcfa ? `${course.total_fcfa.toLocaleString('fr-FR')} FCFA` : '—'} />
              <Row k="Chauffeur" v={chauffeur ? `${chauffeur.nom_complet || chauffeur.telephone}${chauffeur.immatriculation ? ` · ${chauffeur.immatriculation}` : ''}` : 'Non assigné'} />
              <Row k="Source" v={course.source || '—'} />
            </div>
          )}
        </div>

        {course.photo_url && (
          <img src={course.photo_url} alt={`Colis ${course.ref}`} loading="lazy"
               className="w-full h-40 object-cover rounded-xl border border-border" />
        )}

        {/* Statut */}
        {!readOnly && !cancelled && (
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Statut</p>
            <div className="flex flex-wrap gap-2">
              {nextStatus && (
                <Button size="sm" className="h-8 text-xs" disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate(nextStatus)}>
                  Passer à « {FRET_STATUS_LABEL[nextStatus]} »
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate('ANNULE')}>
                Annuler la course
              </Button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="rounded-xl border border-border p-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Historique</p>
          {timeline.filter(t => t.at).map((t) => (
            <div key={t.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <Package className="w-3 h-3 text-muted-foreground" /> {t.label}
              </span>
              <span className="text-muted-foreground tabular-nums">{fmt(t.at)}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3" /> Suivi client : /suivre/{course.ref}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = 'text', className }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input className="h-9" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1 last:border-0">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="font-medium text-right text-xs break-all">{v}</span>
    </div>
  );
}

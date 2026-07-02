import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessageCircle, ExternalLink, Phone, User, Package, Copy, Send, Link2 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import type { ManualDeparture } from '@/hooks/useManualDepartures';
import { toast } from 'sonner';
import { DossierLink, GpLink } from '@/components/admin/links/EntityLink';

interface Props {
  departure: ManualDeparture | null;
  onClose: () => void;
}

const MODE_LABEL: Record<string, string> = { air: 'Air', sea_lcl: 'Mer (LCL)', road: 'Route' };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function buildGpRecap(d: ManualDeparture, dossiers: any[]): string {
  const lines = [
    `Bonjour ${d.carrier_name ?? ''}`.trim() + ',',
    '',
    `Confirmation de votre départ Yobbanté Réf #${d.short_ref ?? '----'} :`,
    `Route : ${d.origin_city} → ${d.destination_city}`,
    `Mode : ${MODE_LABEL[d.transport_mode] ?? d.transport_mode}`,
    `Date : ${fmtDate(d.departure_date)}`,
    `Capacité : ${d.total_capacity_kg} kg`,
    '',
  ];
  if (dossiers.length > 0) {
    lines.push(`Colis attribués (${dossiers.length}) :`);
    dossiers.forEach((ds, i) => {
      lines.push(`${i + 1}. ${ds.reference} · ${ds.product_description?.slice(0, 40) ?? ''} · ${ds.estimated_weight ?? '?'}kg`);
    });
    lines.push('');
  }
  lines.push('Merci de confirmer la prise en charge.');
  lines.push('— Yobbanté');
  return lines.join('\n');
}

export function DepartureDetailDrawer({ departure, onClose }: Props) {
  const open = !!departure;
  const qc = useQueryClient();

  const { data: dossiers = [], isLoading } = useQuery({
    enabled: !!departure?.id,
    queryKey: ['departure_dossiers', departure?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, product_description, estimated_weight, status, contact_phone, contact_email, created_at')
        .eq('assigned_departure_id', departure!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalWeight = useMemo(
    () => dossiers.reduce((acc, d) => acc + (Number(d.estimated_weight) || 0), 0),
    [dossiers],
  );

  function notifyGp() {
    if (!departure) return;
    const raw = (departure.carrier_contact ?? '').replace(/\D/g, '');
    if (!raw) {
      toast.error('Aucun numéro WhatsApp pour ce GP');
      return;
    }
    const text = encodeURIComponent(buildGpRecap(departure, dossiers));
    window.open(`https://wa.me/${raw}?text=${text}`, '_blank');
  }

  async function copyRef() {
    if (!departure?.short_ref) return;
    try {
      await navigator.clipboard.writeText(`#${departure.short_ref}`);
      toast.success(`Réf #${departure.short_ref} copiée`);
    } catch { toast.error('Copie impossible'); }
  }

  async function copyGpRecap() {
    if (!departure) return;
    try {
      await navigator.clipboard.writeText(buildGpRecap(departure, dossiers));
      toast.success('Récap GP copié');
    } catch { toast.error('Copie impossible'); }
  }

  async function markPublished() {
    if (!departure) return;
    const { error } = await supabase
      .from('manual_departures')
      .update({ publication_status: 'published', published_at: new Date().toISOString() })
      .eq('id', departure.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['manual_departures'] });
    toast.success(`Réf #${departure.short_ref} publié`);
  }

  async function detachDossier(id: string, reference: string) {
    const { error } = await supabase
      .from('dossiers')
      .update({ assigned_departure_id: null })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['departure_dossiers', departure?.id] });
    qc.invalidateQueries({ queryKey: ['manual_departures'] });
    toast.success(`${reference} détaché du départ`);
  }

  if (!departure) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl">
                {departure.origin_city} → {departure.destination_city}
              </SheetTitle>
              <SheetDescription>
                {MODE_LABEL[departure.transport_mode]} · {fmtDate(departure.departure_date)}
              </SheetDescription>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Réf</div>
              <div className="text-3xl font-bold font-mono" style={{ color: '#F5C518' }}>
                #{departure.short_ref ?? '----'}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Quick actions */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={copyRef} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Réf
            </Button>
            <Button variant="outline" size="sm" onClick={copyGpRecap} className="gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Récap
            </Button>
            <Button
              variant="outline" size="sm" onClick={markPublished}
              disabled={(departure.publication_status ?? 'draft') === 'published'}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {(departure.publication_status ?? 'draft') === 'published' ? 'Publié' : 'Publier'}
            </Button>
            <Button
              variant="outline" size="sm" onClick={notifyGp}
              disabled={!departure.carrier_contact}
              className="gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </Button>
          </section>

          {/* GP card */}
          <section className="rounded-xl border border-border p-4 bg-card">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Transporteur (GP)</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold">
                  <GpLink reference={departure.transporteur_ref} plain>
                    {departure.carrier_name ?? '—'}
                  </GpLink>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {departure.carrier_contact ?? 'Aucun contact'}
                </div>
              </div>
            </div>
            <Button onClick={notifyGp} className="w-full gap-2" disabled={!departure.carrier_contact}>
              <MessageCircle className="w-4 h-4" />
              Notifier le GP sur WhatsApp
            </Button>
          </section>

          {/* Capacity */}
          <section className="rounded-xl border border-border p-4 bg-card">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Capacité</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold">{departure.total_capacity_kg}</div>
                <div className="text-[11px] text-muted-foreground">Total kg</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{totalWeight}</div>
                <div className="text-[11px] text-muted-foreground">Réservé (dossiers)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-500">{Math.max(0, departure.total_capacity_kg - totalWeight)}</div>
                <div className="text-[11px] text-muted-foreground">Restant</div>
              </div>
            </div>
          </section>

          {/* Dossiers attached */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Package className="w-3 h-3" /> Dossiers attribués ({dossiers.length})
              </h3>
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : dossiers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Aucun dossier rattaché à ce départ.
              </div>
            ) : (
              <ul className="space-y-2">
                {dossiers.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg border border-border p-3 bg-card flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{d.reference}</span>
                        <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                      </div>
                      <div className="text-sm truncate mt-0.5">{d.product_description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {d.estimated_weight ?? '?'}kg · {d.contact_phone ?? d.contact_email ?? ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => detachDossier(d.id, d.reference)}
                        className="text-[11px] text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-secondary"
                        title="Détacher du départ"
                      >
                        Détacher
                      </button>
                      <Link
                        to={`/admin/dossiers/${d.id}`}
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {departure.notes_admin && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notes internes</h3>
                <p className="text-sm whitespace-pre-wrap">{departure.notes_admin}</p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

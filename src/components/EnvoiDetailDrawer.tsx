import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Plane, Ship, Truck, Package as PackageIcon, Clock, Hash,
  User, Phone, Mail, MapPin, Calendar, Shield, Wallet, FileText,
  Copy, Share2, X, CheckCircle2, Circle, Loader2, AlertTriangle,
  Send, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type Shipment, type Dossier, type Package as Pkg,
  COUNTRY_FLAGS, COUNTRY_NAMES,
  SHIPMENT_STATUS_LABELS, DOSSIER_STATUS_LABELS,
} from '@/lib/types';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function transportVisual(mode?: string | null) {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('SEA') || m === 'VOLUME') return { Icon: Ship, label: 'Maritime', tone: 'text-sky-400' };
  if (m.includes('ROAD') || m === 'ECONOMY') return { Icon: Truck, label: 'Routier', tone: 'text-amber-400' };
  if (m.includes('AIR') || m === 'FAST') return { Icon: Plane, label: 'Aérien', tone: 'text-primary' };
  return { Icon: Plane, label: mode ?? 'Standard', tone: 'text-primary' };
}

function flagOf(c?: string | null) {
  if (!c) return '🌍';
  return (COUNTRY_FLAGS as Record<string, string>)[c.toUpperCase()] || '🌍';
}
function nameOf(c?: string | null) {
  if (!c) return '—';
  return (COUNTRY_NAMES as Record<string, string>)[c.toUpperCase()] || c;
}

/** 6 customer-facing milestones, mapped from internal statuses. */
type Milestone = { key: string; label: string; desc: string };
const SHIPMENT_MILESTONES: Milestone[] = [
  { key: 'CONFIRMED',   label: 'Confirmé',     desc: 'Dossier enregistré, équipe notifiée' },
  { key: 'MATCHED',     label: 'Départ assigné', desc: 'Un transporteur a été assigné' },
  { key: 'IN_TRANSIT',  label: 'En transit',   desc: 'Acheminement vers la destination' },
  { key: 'CUSTOMS',     label: 'Douane',       desc: 'Dédouanement à l\'arrivée' },
  { key: 'OUT_FOR_DELIVERY', label: 'En livraison', desc: 'Livraison du dernier kilomètre' },
  { key: 'DELIVERED',   label: 'Livré',        desc: 'Remis au destinataire' },
];

const SHIPMENT_RANK: Record<string, number> = {
  PENDING: 0, WAITING_FOR_MATCH: 0, CONFIRMED: 1, MATCHED: 2, IN_PREPARATION: 2,
  IN_TRANSIT: 3, CUSTOMS: 4, ARRIVED: 5, OUT_FOR_DELIVERY: 5, DELIVERED: 6,
  ON_HOLD: -1, CANCELLED: -2,
};

const DOSSIER_RANK: Record<string, number> = {
  SUBMITTED: 1, IN_REVIEW: 1, SOURCING: 2, PROCURED: 2,
  IN_TRANSIT: 3, CUSTOMS: 4, DELIVERED: 6, CLOSED: 6,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment | null;
  dossier?: Dossier | null;
  packages: Pkg[];
}

export function EnvoiDetailDrawer({ open, onOpenChange, shipment, dossier, packages }: Props) {
  const isShipment = !!shipment;
  if (!shipment && !dossier) return null;

  // ────── Resolve display data from either source ──────
  const meta = (shipment?.transport_metadata ?? {}) as Record<string, any>;
  const inner = (meta.meta ?? {}) as Record<string, any>;

  const reference =
    inner?.dossier_reference ?? shipment?.tracking_number ?? dossier?.reference ?? '—';

  const originCountry = shipment?.origin_country ?? dossier?.origin_country ?? null;
  const destCountry = shipment?.destination_country ?? dossier?.destination_country ?? null;
  const originCity =
    shipment?.origin_city ?? inner?.true_direction?.origin_city
    ?? extractCity(dossier?.product_description, 'from') ?? nameOf(originCountry);
  const destCity =
    shipment?.destination_city ?? inner?.true_direction?.destination_city
    ?? extractCity(dossier?.product_description, 'to') ?? nameOf(destCountry);

  const transport = transportVisual(
    inner?.transport_mode
    ?? shipment?.transport_type
    ?? meta.label
    ?? extractFromNotes(dossier?.notes, /Transport:\s*([^·\n]+)/)
  );
  const T = transport.Icon;

  const status = shipment?.status ?? dossier?.status ?? 'PENDING';
  const statusLabel = isShipment
    ? (SHIPMENT_STATUS_LABELS[shipment!.status] ?? shipment!.status)
    : (DOSSIER_STATUS_LABELS[dossier!.status] ?? dossier!.status);
  const rank = isShipment
    ? (SHIPMENT_RANK[shipment!.status] ?? 0)
    : (DOSSIER_RANK[dossier!.status] ?? 0);

  const isOnHold = status === 'ON_HOLD' || status === 'WAITING_FOR_MATCH';
  const isCancelled = status === 'CANCELLED';
  const isDelivered = status === 'DELIVERED' || status === 'CLOSED';

  // ────── Marchandise / parties / logistique ──────
  const description =
    inner?.description
    ?? extractFromNotes(dossier?.notes, /Description:\s*(.+)/)
    ?? cleanProductDescription(dossier?.product_description);

  const weight = inner?.weight_kg ?? shipment?.weight_kg ?? dossier?.estimated_weight ?? null;
  const parcels = inner?.parcel_count ?? Number(extractFromNotes(dossier?.notes, /·\s*(\d+)\s*colis/) ?? 1);
  const goodsType = inner?.goods_type ?? extractFromNotes(dossier?.notes, /Type marchandise:\s*(.+)/);
  const declaredLocal = inner?.declared_local ?? extractFromNotes(dossier?.notes, /Valeur déclarée:\s*([\d.,]+)/);
  const declaredCurrency = inner?.declared_currency ?? '';

  const sender = (inner?.sender ?? extractParty(dossier?.notes, 'sender')) as
    { name?: string; phone?: string; address?: string } | undefined;
  const recipient = (inner?.recipient ?? extractParty(dossier?.notes, 'recipient')) as
    { name?: string; phone?: string; email?: string; address?: string } | undefined;

  const pickupDate = inner?.pickup_date ?? extractFromNotes(dossier?.notes, /Collecte:\s*(\d{4}-\d{2}-\d{2})/);
  const pickupSlot = inner?.pickup_slot ?? extractFromNotes(dossier?.notes, /Collecte:\s*\d{4}-\d{2}-\d{2}\s*·\s*(\w+)/);
  const insurance = inner?.insurance ?? extractFromNotes(dossier?.notes, /Assurance:\s*(.+)/);
  const paymentMethod = inner?.payment_method ?? extractFromNotes(dossier?.notes, /Paiement:\s*(.+)/);
  const priority = inner?.priority ?? extractFromNotes(dossier?.notes, /Transport:\s*[^·]+·\s*(\w+)/);

  const trackingId =
    shipment?.tracking_number ?? shipment?.konnekt_id ?? `YBT-${(shipment?.id ?? dossier?.id ?? '').slice(0, 8).toUpperCase()}`;
  const totalEur = shipment?.total_cost != null ? Number(shipment.total_cost)
                  : dossier?.estimated_cost ?? dossier?.budget_eur ?? null;
  const eta = shipment?.eta ?? dossier?.estimated_delivery_date ?? null;
  const departureDate = shipment?.departure_date ?? null;

  // ────── Live shipment events (timeline) ──────
  const [events, setEvents] = useState<Array<{ id: string; created_at: string; event_type: string; note: string | null; from_status: string | null; to_status: string | null }>>([]);
  const shipmentId = shipment?.id ?? null;
  useEffect(() => {
    if (!open || !shipmentId) { setEvents([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('shipment_events')
        .select('id, created_at, event_type, note, from_status, to_status')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (alive && data) setEvents(data as any);
    })();
    return () => { alive = false; };
  }, [open, shipmentId]);

  const groupedPackages = useMemo(
    () => packages.filter(p => shipmentId && p.shipment_id === shipmentId),
    [packages, shipmentId]
  );

  // ────── Actions ──────
  const copyTracking = () => {
    navigator.clipboard.writeText(trackingId);
    toast.success('Numéro de suivi copié');
  };
  const share = async () => {
    const text = `Suivi Yobbanté: ${originCity} → ${destCity} · ${trackingId}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Suivi Yobbanté', text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Lien copié');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 overflow-y-auto bg-background border-l border-border"
      >
        {/* ─── HERO ─── */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_55%)]" />
          <div className="relative px-5 sm:px-6 pt-5 pb-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 backdrop-blur flex items-center justify-center">
                  <Send className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Envoi</p>
                  <p className="text-[11px] font-mono text-foreground/80 truncate max-w-[180px]">{reference}</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-lg bg-card/60 backdrop-blur border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Route hero */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Départ</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl">{flagOf(originCountry)}</span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{originCity}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{nameOf(originCountry)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center pb-1">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-1.5">
                  <T className={`w-5 h-5 ${transport.tone}`} />
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-primary/60" />
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  <div className="w-1 h-1 rounded-full bg-primary/20" />
                </div>
              </div>

              <div className="min-w-0 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Arrivée</p>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{destCity}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{nameOf(destCountry)}</p>
                  </div>
                  <span className="text-2xl">{flagOf(destCountry)}</span>
                </div>
              </div>
            </div>

            {/* Status + transport pill */}
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <StatusPill status={status} label={statusLabel} />
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card/60 backdrop-blur border border-border/60 px-2 py-1 rounded-md">
                <T className="w-3.5 h-3.5" /> {transport.label}
              </span>
              {!isShipment && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">
                  <Sparkles className="w-3.5 h-3.5" /> En préparation
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── BODY ─── */}
        <div className="px-5 sm:px-6 py-5 space-y-6 pb-12">
          {/* Tracking */}
          <button
            onClick={copyTracking}
            className="w-full flex items-center gap-3 p-3.5 bg-secondary/60 hover:bg-secondary rounded-xl border border-border/60 transition-colors group"
          >
            <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Numéro de suivi</p>
              <p className="text-sm font-mono font-semibold text-foreground truncate">{trackingId}</p>
            </div>
            <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <Kpi label="Total" value={totalEur != null ? fmtEur(totalEur) : '—'} />
            <Kpi
              label="ETA"
              value={eta ? new Date(eta).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
              icon={<Clock className="w-3.5 h-3.5" />}
            />
            <Kpi
              label="Poids"
              value={weight != null ? `${weight} kg` : '—'}
              icon={<PackageIcon className="w-3.5 h-3.5" />}
            />
          </div>

          {/* Alerts */}
          {isOnHold && (
            <Alert tone="amber" icon={<AlertTriangle className="w-4 h-4" />}>
              Notre équipe recherche la meilleure option pour votre envoi. Vous serez notifié dès qu'un départ est confirmé.
            </Alert>
          )}
          {isCancelled && (
            <Alert tone="red" icon={<AlertTriangle className="w-4 h-4" />}>
              Cet envoi a été annulé. Contactez le support si vous avez besoin d'assistance.
            </Alert>
          )}

          {/* Timeline */}
          <Section title="Suivi en direct">
            <div className="relative pl-1">
              {SHIPMENT_MILESTONES.map((m, i) => {
                const isDone = rank > i;
                const isActive = rank === i + 1 || (rank === 0 && i === 0);
                const isLast = i === SHIPMENT_MILESTONES.length - 1;
                const eventForStep = events.find(e => e.to_status === m.key);
                return (
                  <div key={m.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all
                        ${isDone ? 'bg-primary text-primary-foreground' :
                          isActive ? 'bg-primary/15 ring-2 ring-primary text-primary' :
                          'bg-secondary text-muted-foreground'}`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" />
                         : isActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                         : <Circle className="w-3 h-3" />}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 my-1 min-h-[32px] ${isDone ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className={`flex-1 pb-5 ${!isDone && !isActive ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>{m.label}</p>
                        {eventForStep && (
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {new Date(eventForStep.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{eventForStep?.note ?? m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Marchandise */}
          {(description || weight || goodsType || declaredLocal) && (
            <Section title="Marchandise">
              <Card>
                <Row icon={<FileText />} label="Description" value={description} />
                <Row icon={<PackageIcon />} label="Poids & quantité"
                  value={weight ? `${weight} kg · ${parcels} colis` : null} />
                <Row icon={<Sparkles />} label="Type" value={goodsType} />
                <Row icon={<Wallet />} label="Valeur déclarée"
                  value={declaredLocal ? `${declaredLocal} ${declaredCurrency}`.trim() : null} />
              </Card>
            </Section>
          )}

          {/* Expéditeur */}
          {sender && (sender.name || sender.phone || sender.address) && (
            <Section title="Expéditeur">
              <Card>
                <Row icon={<User />} label="Nom" value={sender.name} />
                <Row icon={<Phone />} label="Téléphone" value={sender.phone} copy />
                <Row icon={<MapPin />} label="Adresse de collecte" value={sender.address} />
              </Card>
            </Section>
          )}

          {/* Destinataire */}
          {recipient && (recipient.name || recipient.phone || recipient.address) && (
            <Section title="Destinataire">
              <Card>
                <Row icon={<User />} label="Nom" value={recipient.name} />
                <Row icon={<Phone />} label="Téléphone" value={recipient.phone} copy />
                <Row icon={<Mail />} label="Email" value={recipient.email} copy />
                <Row icon={<MapPin />} label="Adresse de livraison" value={recipient.address} />
              </Card>
            </Section>
          )}

          {/* Logistique & paiement */}
          {(pickupDate || insurance || paymentMethod || priority || departureDate) && (
            <Section title="Logistique & paiement">
              <Card>
                <Row icon={<Calendar />} label="Collecte"
                  value={pickupDate
                    ? `${pickupDate}${pickupSlot ? ` · ${pickupSlot === 'morning' ? 'matin' : pickupSlot === 'afternoon' ? 'après-midi' : pickupSlot}` : ''}`
                    : null} />
                <Row icon={<Calendar />} label="Date de départ"
                  value={departureDate ? new Date(departureDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
                <Row icon={<Shield />} label="Assurance" value={insurance} />
                <Row icon={<Wallet />} label="Paiement" value={paymentMethod} />
                <Row icon={<Clock />} label="Priorité" value={priority} />
              </Card>
            </Section>
          )}

          {/* Colis groupés */}
          {groupedPackages.length > 0 && (
            <Section title={`Colis groupés (${groupedPackages.length})`}>
              <div className="space-y-2">
                {groupedPackages.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                    <PackageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.description || 'Colis sans description'}</p>
                      <p className="text-xs text-muted-foreground">{p.weight ? `${p.weight} kg` : 'Poids inconnu'}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Footer actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={share}>
              <Share2 className="w-4 h-4 mr-2" /> Partager
            </Button>
            <Button onClick={copyTracking}>
              <Copy className="w-4 h-4 mr-2" /> Copier le suivi
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Créé le {new Date(shipment?.created_at ?? dossier?.created_at ?? Date.now())
              .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── Primitives ───────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl px-3 divide-y divide-border/60">
      {children}
    </div>
  );
}

function Row({
  icon, label, value, copy,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode | null;
  copy?: boolean;
}) {
  if (value == null || value === '' || value === false) return null;
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value));
    toast.success(`${label} copié`);
  };
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="text-muted-foreground mt-0.5 [&_svg]:w-4 [&_svg]:h-4 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
      </div>
      {copy && (
        <button
          onClick={onCopy}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label={`Copier ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground mt-1 flex items-center gap-1 truncate">
        {icon}<span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'DELIVERED' || status === 'CLOSED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : status === 'ON_HOLD' || status === 'WAITING_FOR_MATCH' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : status === 'CANCELLED' ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : 'bg-primary/15 text-primary border-primary/30';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${tone}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function Alert({ tone, icon, children }: { tone: 'amber' | 'red'; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === 'amber'
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${cls}`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function extractFromNotes(notes: string | null | undefined, re: RegExp): string | null {
  if (!notes) return null;
  return notes.match(re)?.[1]?.trim() ?? null;
}

function extractCity(desc: string | undefined, which: 'from' | 'to'): string | null {
  if (!desc) return null;
  const m = desc.match(/—\s*([^→]+)→\s*(.+)$/);
  if (!m) return null;
  return (which === 'from' ? m[1] : m[2]).trim();
}

function cleanProductDescription(desc?: string): string | null {
  if (!desc) return null;
  return desc.replace(/^Expéd(it)?ion\s+/i, '').split('—')[0].trim() || null;
}

function extractParty(notes: string | null | undefined, which: 'sender' | 'recipient') {
  if (!notes) return undefined;
  const header = which === 'sender' ? '— Expéditeur —' : '— Destinataire —';
  const idx = notes.indexOf(header);
  if (idx < 0) return undefined;
  const block = notes.slice(idx + header.length).split('\n').slice(1, 3).map(s => s.trim()).filter(Boolean);
  if (block.length === 0) return undefined;
  // line 1 = "Name · Phone[ · Email]"
  const parts = block[0].split('·').map(s => s.trim());
  const name = parts[0];
  const phone = parts[1];
  const email = parts[2]?.includes('@') ? parts[2] : undefined;
  const address = block[1] || undefined;
  return { name, phone, email, address };
}

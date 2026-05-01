import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/StatusBadge';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type Shipment, type Package as Pkg } from '@/lib/types';
import {
  ArrowRight, Copy, Share2, Package, Clock, Truck, Plane, Ship,
  User, Phone, Mail, MapPin, Calendar, Shield, Wallet, FileText, Hash,
} from 'lucide-react';
import { toast } from 'sonner';

interface ShipmentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment | null;
  packages: Pkg[];
}

const TIMELINE_STEPS = [
  { status: 'PENDING',     label: 'Créé',       desc: 'Dossier enregistré, équipe notifiée' },
  { status: 'IN_TRANSIT',  label: 'En transit', desc: 'Acheminement vers la destination' },
  { status: 'CUSTOMS',     label: 'Douane',     desc: 'Dédouanement en cours' },
  { status: 'DELIVERED',   label: 'Livré',      desc: 'Remis au destinataire' },
] as const;
const STATUS_ORDER = ['PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED'];

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function transportIconAndLabel(mode?: string | null): { icon: JSX.Element; label: string } {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('SEA') || m === 'VOLUME') return { icon: <Ship className="w-4 h-4" />, label: 'Maritime' };
  if (m.includes('ROAD') || m === 'ECONOMY') return { icon: <Truck className="w-4 h-4" />, label: 'Routier' };
  if (m.includes('AIR') || m === 'FAST') return { icon: <Plane className="w-4 h-4" />, label: 'Aérien' };
  return { icon: <Truck className="w-4 h-4" />, label: mode ?? 'Standard' };
}

function InfoRow({ icon, label, value }: { icon: JSX.Element; label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

export function ShipmentDetailDrawer({ open, onOpenChange, shipment, packages }: ShipmentDetailDrawerProps) {
  if (!shipment) return null;

  const meta = (shipment.transport_metadata ?? {}) as Record<string, any>;
  const inner = (meta.meta ?? {}) as Record<string, any>;
  const isSendFlow = inner?.send_flow === true;

  const currentIndex = STATUS_ORDER.indexOf(shipment.status);
  const flag = COUNTRY_FLAGS[shipment.origin_country] || '🌍';
  const destFlag = shipment.destination_country === 'SN' ? '🇸🇳' : '🌍';
  const destName = shipment.destination_country === 'SN' ? 'Sénégal' : shipment.destination_country;
  const originCity = shipment.origin_city ?? inner?.true_direction?.origin_city;
  const destCity = shipment.destination_city ?? inner?.true_direction?.destination_city;
  const groupedPackages = packages.filter(p => p.shipment_id === shipment.id);

  const reference = inner?.dossier_reference ?? shipment.konnekt_id;
  const trackingId = shipment.konnekt_id || `YBT-${shipment.id.slice(0, 8).toUpperCase()}`;
  const transport = transportIconAndLabel(inner?.transport_mode ?? shipment.transport_type ?? meta.label);
  const sender = inner?.sender as { name?: string; phone?: string; address?: string } | undefined;
  const recipient = inner?.recipient as { name?: string; phone?: string; email?: string; address?: string } | undefined;

  const copyTracking = () => {
    navigator.clipboard.writeText(trackingId);
    toast.success('Numéro de suivi copié');
  };

  const share = async () => {
    const text = `Suivi Yobbanté: ${originCity ?? COUNTRY_NAMES[shipment.origin_country]} → ${destCity ?? destName} · ${trackingId}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Suivi Yobbanté', text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Lien copié');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 text-left">
          {reference && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {reference}
            </p>
          )}
          <SheetTitle className="flex items-center gap-2 text-lg">
            <span>{flag}</span>
            <span className="truncate">{originCity || COUNTRY_NAMES[shipment.origin_country]}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{destFlag}</span>
            <span className="truncate">{destCity || destName}</span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={shipment.status} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {transport.icon} {transport.label}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-8">
          {/* Tracking ID */}
          <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl">
            <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Numéro de suivi</p>
              <p className="text-sm font-mono font-semibold text-foreground truncate">{trackingId}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyTracking} aria-label="Copier">
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {shipment.total_cost != null ? fmtEur(Number(shipment.total_cost)) : '—'}
              </p>
            </div>
            <div className="bg-secondary rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ETA</p>
              <p className="text-xl font-bold text-foreground mt-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {shipment.eta ? new Date(shipment.eta).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
              </p>
            </div>
          </div>

          {/* Live Timeline */}
          <div>
            <SectionTitle>Suivi en direct</SectionTitle>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, i) => {
                const isActive = i === currentIndex;
                const isDone = i < currentIndex;
                const isFuture = i > currentIndex;
                return (
                  <div key={step.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        isDone ? 'bg-primary' : isActive ? 'bg-primary ring-4 ring-primary/20' : 'bg-border'
                      }`} />
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div className={`w-0.5 h-10 ${isDone ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className={`pb-5 ${isFuture ? 'opacity-40' : ''}`}>
                      <p className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SendFlow rich details */}
          {isSendFlow && (
            <>
              {(inner?.description || inner?.weight_kg || inner?.goods_type) && (
                <div>
                  <SectionTitle>Marchandise</SectionTitle>
                  <div className="bg-card border border-border rounded-xl px-3 divide-y divide-border/60">
                    <InfoRow icon={<Package className="w-4 h-4" />} label="Description" value={inner?.description} />
                    <InfoRow
                      icon={<Package className="w-4 h-4" />}
                      label="Poids & quantité"
                      value={inner?.weight_kg ? `${inner.weight_kg} kg · ${inner?.parcel_count ?? 1} colis` : null}
                    />
                    <InfoRow icon={<FileText className="w-4 h-4" />} label="Type" value={inner?.goods_type} />
                    <InfoRow
                      icon={<FileText className="w-4 h-4" />}
                      label="Valeur déclarée"
                      value={inner?.declared_local ? `${inner.declared_local} ${inner?.declared_currency ?? ''}`.trim() : null}
                    />
                  </div>
                </div>
              )}

              {sender && (sender.name || sender.phone || sender.address) && (
                <div>
                  <SectionTitle>Expéditeur</SectionTitle>
                  <div className="bg-card border border-border rounded-xl px-3 divide-y divide-border/60">
                    <InfoRow icon={<User className="w-4 h-4" />} label="Nom" value={sender.name} />
                    <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={sender.phone} />
                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="Adresse de collecte" value={sender.address} />
                  </div>
                </div>
              )}

              {recipient && (recipient.name || recipient.phone || recipient.address) && (
                <div>
                  <SectionTitle>Destinataire</SectionTitle>
                  <div className="bg-card border border-border rounded-xl px-3 divide-y divide-border/60">
                    <InfoRow icon={<User className="w-4 h-4" />} label="Nom" value={recipient.name} />
                    <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={recipient.phone} />
                    <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={recipient.email} />
                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="Adresse de livraison" value={recipient.address} />
                  </div>
                </div>
              )}

              {(inner?.pickup_date || inner?.insurance || inner?.payment_method || inner?.priority) && (
                <div>
                  <SectionTitle>Logistique & paiement</SectionTitle>
                  <div className="bg-card border border-border rounded-xl px-3 divide-y divide-border/60">
                    <InfoRow
                      icon={<Calendar className="w-4 h-4" />}
                      label="Collecte"
                      value={inner?.pickup_date
                        ? `${inner.pickup_date}${inner?.pickup_slot === 'morning' ? ' · matin' : inner?.pickup_slot === 'afternoon' ? ' · après-midi' : ''}`
                        : null}
                    />
                    <InfoRow icon={<Shield className="w-4 h-4" />} label="Assurance" value={inner?.insurance} />
                    <InfoRow icon={<Wallet className="w-4 h-4" />} label="Paiement" value={inner?.payment_method} />
                    <InfoRow icon={<Clock className="w-4 h-4" />} label="Priorité" value={inner?.priority} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Grouped Packages */}
          {groupedPackages.length > 0 && (
            <div>
              <SectionTitle>Colis groupés ({groupedPackages.length})</SectionTitle>
              <div className="space-y-2">
                {groupedPackages.map(pkg => (
                  <div key={pkg.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                    <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pkg.description || 'Colis sans description'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pkg.weight ? `${pkg.weight} kg` : 'Poids inconnu'}
                      </p>
                    </div>
                    <StatusBadge status={pkg.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={share}>
              <Share2 className="w-4 h-4 mr-2" /> Partager
            </Button>
            <Button variant="outline" className="flex-1" onClick={copyTracking}>
              <Copy className="w-4 h-4 mr-2" /> Copier le suivi
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Créé le {new Date(shipment.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

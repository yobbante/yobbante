import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Loader2, Package as PkgIcon, Truck, User, MapPin, Calendar, Box } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  PACKAGE_STATUS_ORDER, SHIPMENT_STATUS_ORDER,
  COUNTRY_FLAGS, type PackageStatus, type ShipmentStatus,
} from '@/lib/types';
import { canTransitionPackage, statusRank as pkgRank } from '@/lib/packageStatus';
import { canTransitionShipment, shipmentRank } from '@/lib/shipmentStatus';

export type OrderRowRef = {
  kind: 'package' | 'shipment';
  id: string;
};

type FullPackage = {
  id: string; user_id: string; status: PackageStatus;
  warehouse_country: string; description: string | null;
  weight: number | null; created_at: string; shipment_id: string | null;
};
type FullShipment = {
  id: string; user_id: string; status: ShipmentStatus;
  origin_country: string; destination_country: string;
  origin_city: string | null; destination_city: string | null;
  transport_type: string | null; total_cost: number | null;
  eta: string | null; departure_date: string | null;
  konnekt_id: string | null; created_at: string;
  manual_request: boolean; pending_assignment: boolean;
};

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  CREATED: 'bg-muted text-muted-foreground',
  RECEIVED: 'bg-blue-500/10 text-blue-500',
  IN_STORAGE: 'bg-amber-500/10 text-amber-500',
  READY_TO_SHIP: 'bg-emerald-500/10 text-emerald-500',
  SHIPPED: 'bg-blue-500/10 text-blue-500',
  IN_TRANSIT: 'bg-blue-500/10 text-blue-500',
  CUSTOMS: 'bg-amber-500/10 text-amber-500',
  DELIVERED: 'bg-emerald-500/10 text-emerald-500',
};

export function OrderDetailDrawer({ row, onClose }: { row: OrderRowRef | null; onClose: () => void }) {
  const open = !!row;
  const qc = useQueryClient();
  const [pkg, setPkg] = useState<FullPackage | null>(null);
  const [ship, setShip] = useState<FullShipment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row) { setPkg(null); setShip(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (row.kind === 'package') {
          const { data, error } = await supabase.from('packages').select('*').eq('id', row.id).single();
          if (error) throw error;
          if (!cancelled) setPkg(data as FullPackage);
        } else {
          const { data, error } = await supabase.from('shipments').select('*').eq('id', row.id).single();
          if (error) throw error;
          if (!cancelled) setShip(data as FullShipment);
        }
      } catch (e) {
        toast.error(`Chargement impossible : ${(e as Error).message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row]);

  const updatePkg = useMutation({
    mutationFn: async (newStatus: PackageStatus) => {
      if (!pkg) throw new Error('Pas de colis chargé');
      if (!canTransitionPackage(pkg.status, newStatus)) {
        throw new Error(`Transition invalide : ${pkg.status} → ${newStatus}`);
      }
      const { error } = await supabase.from('packages').update({ status: newStatus }).eq('id', pkg.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      setPkg(p => p ? { ...p, status: newStatus } : p);
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success(`Colis → ${newStatus.replace(/_/g, ' ')}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateShip = useMutation({
    mutationFn: async (newStatus: ShipmentStatus) => {
      if (!ship) throw new Error('Pas d\'expédition chargée');
      if (!canTransitionShipment(ship.status, newStatus)) {
        throw new Error(`Transition invalide : ${ship.status} → ${newStatus}`);
      }
      const { error } = await supabase.from('shipments').update({ status: newStatus }).eq('id', ship.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      setShip(s => s ? { ...s, status: newStatus } : s);
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['shipments'] });
      toast.success(`Expédition → ${newStatus.replace(/_/g, ' ')}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row?.kind === 'package' ? <PkgIcon className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            {row?.kind === 'package' ? 'Détail colis' : 'Détail expédition'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 mt-6">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : pkg ? (
          <PackageDetail pkg={pkg} onUpdate={(s) => updatePkg.mutate(s)} pending={updatePkg.isPending} />
        ) : ship ? (
          <ShipmentDetail ship={ship} onUpdate={(s) => updateShip.mutate(s)} pending={updateShip.isPending} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PackageDetail({ pkg, onUpdate, pending }: {
  pkg: FullPackage; onUpdate: (s: PackageStatus) => void; pending: boolean;
}) {
  const next = pkgRank(pkg.status) < PACKAGE_STATUS_ORDER.length - 1
    ? PACKAGE_STATUS_ORDER[pkgRank(pkg.status) + 1] : null;
  const validJumps = PACKAGE_STATUS_ORDER.filter(s => canTransitionPackage(pkg.status, s) && s !== next);

  return (
    <div className="space-y-5 mt-6">
      <Header
        ref={pkg.id}
        status={pkg.status}
        secondary={pkg.description || 'Colis'}
      />

      <FieldGrid items={[
        { label: 'Hub', value: <><span className="mr-1">{COUNTRY_FLAGS[pkg.warehouse_country as keyof typeof COUNTRY_FLAGS] || '🌍'}</span>{pkg.warehouse_country}</>, Icon: MapPin },
        { label: 'Poids', value: pkg.weight ? `${pkg.weight} kg` : '—', Icon: Box },
        { label: 'Client', value: <span className="font-mono text-[11px]">{pkg.user_id.slice(0, 8)}…</span>, Icon: User },
        { label: 'Créé le', value: new Date(pkg.created_at).toLocaleDateString('fr-FR'), Icon: Calendar },
      ]} />

      <ActionsBlock
        next={next ? { value: next, label: next.replace(/_/g, ' ') } : null}
        jumps={validJumps.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
        onApply={(s) => onUpdate(s as PackageStatus)}
        pending={pending}
      />
    </div>
  );
}

function ShipmentDetail({ ship, onUpdate, pending }: {
  ship: FullShipment; onUpdate: (s: ShipmentStatus) => void; pending: boolean;
}) {
  const next = shipmentRank(ship.status) < SHIPMENT_STATUS_ORDER.length - 1
    ? SHIPMENT_STATUS_ORDER[shipmentRank(ship.status) + 1] : null;
  const validJumps = SHIPMENT_STATUS_ORDER.filter(s => canTransitionShipment(ship.status, s) && s !== next);

  return (
    <div className="space-y-5 mt-6">
      <Header
        ref={ship.konnekt_id || ship.id.slice(0, 8)}
        status={ship.status}
        secondary={`${ship.origin_country} → ${ship.destination_country}`}
      />

      {ship.pending_assignment && (
        <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg px-3 py-2">
          ⚠️ Demande manuelle en attente d'assignation à un départ Konnekt
        </div>
      )}

      <FieldGrid items={[
        { label: 'Origine', value: <><span className="mr-1">{COUNTRY_FLAGS[ship.origin_country as keyof typeof COUNTRY_FLAGS] || '🌍'}</span>{ship.origin_city || ship.origin_country}</>, Icon: MapPin },
        { label: 'Destination', value: ship.destination_city || ship.destination_country, Icon: MapPin },
        { label: 'Transport', value: ship.transport_type || '—', Icon: Truck },
        { label: 'Coût', value: ship.total_cost != null ? `${ship.total_cost} €` : '—', Icon: Box },
        { label: 'Départ', value: ship.departure_date ? new Date(ship.departure_date).toLocaleDateString('fr-FR') : '—', Icon: Calendar },
        { label: 'ETA', value: ship.eta ? new Date(ship.eta).toLocaleDateString('fr-FR') : '—', Icon: Calendar },
      ]} />

      <ActionsBlock
        next={next ? { value: next, label: next.replace(/_/g, ' ') } : null}
        jumps={validJumps.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
        onApply={(s) => onUpdate(s as ShipmentStatus)}
        pending={pending}
      />
    </div>
  );
}

function Header({ ref, status, secondary }: { ref: string; status: string; secondary: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{ref.slice(0, 12)}</span>
        <Badge className={cn('text-[10px] uppercase tracking-wide font-bold', STATUS_TONE[status])} variant="outline">
          {status.replace(/_/g, ' ')}
        </Badge>
      </div>
      <p className="text-sm text-foreground">{secondary}</p>
    </div>
  );
}

function FieldGrid({ items }: { items: { label: string; value: React.ReactNode; Icon: React.ComponentType<{ className?: string }> }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ label, value, Icon }) => (
        <div key={label} className="bg-secondary/40 rounded-lg p-2.5">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <Icon className="w-3 h-3" />{label}
          </p>
          <p className="text-sm text-foreground mt-0.5 truncate">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ActionsBlock({ next, jumps, onApply, pending }: {
  next: { value: string; label: string } | null;
  jumps: { value: string; label: string }[];
  onApply: (s: string) => void;
  pending: boolean;
}) {
  const [jumpValue, setJumpValue] = useState<string>('');

  if (!next && jumps.length === 0) {
    return (
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-xs text-emerald-500 flex items-center gap-2">
        ✓ Statut final atteint — aucune transition possible.
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Mutations admin</p>

      {next && (
        <Button onClick={() => onApply(next.value)} disabled={pending} className="w-full justify-between gap-2">
          <span className="flex items-center gap-2">
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Avancer → {next.label}
          </span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}

      {jumps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Sauter à un statut ultérieur :</p>
          <div className="flex gap-2">
            <Select value={jumpValue} onValueChange={setJumpValue}>
              <SelectTrigger className="h-9 text-xs flex-1"><SelectValue placeholder="Choisir un statut…" /></SelectTrigger>
              <SelectContent>
                {jumps.map(j => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!jumpValue || pending}
              onClick={() => { if (jumpValue) { onApply(jumpValue); setJumpValue(''); } }}
            >Appliquer</Button>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            ⚠️ Forward-only : impossible de revenir en arrière (validé côté DB).
          </p>
        </div>
      )}
    </div>
  );
}

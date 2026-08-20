import { useEffect, useState } from 'react';
import { Phone, MessageCircle, Save, MapPin, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  GP_STEPS, GP_STEP_TONE, stepOf, useUpdateGpColis, type GpColis,
} from '@/hooks/useGpTerrain';
import { cn } from '@/lib/utils';

/** Fiche colis GP — avancement du statut et informations dernier kilomètre. */
export function GpColisSheet({
  colis, open, onOpenChange,
}: {
  colis: GpColis | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateGpColis();
  const [adresse, setAdresse] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && colis) {
      setAdresse(colis.dernier_km_adresse ?? colis.recipient_address ?? '');
      setNotes(colis.notes ?? '');
    }
  }, [open, colis]);

  if (!colis) return null;
  const step = stepOf(colis.status);
  const tel = (colis.recipient_phone ?? colis.contact_phone ?? colis.sender_phone ?? '').trim();
  const digits = tel.replace(/\D/g, '');

  const setStatus = async (status: string) => {
    const patch: Record<string, any> = { status };
    if (status === 'COLLECTED') patch.collected_at = new Date().toISOString();
    if (status === 'DELIVERED') patch.delivered_at = new Date().toISOString();
    try {
      await update.mutateAsync({ id: colis.id, patch });
      toast.success('Statut mis à jour');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    }
  };

  const saveInfos = async () => {
    try {
      await update.mutateAsync({
        id: colis.id,
        patch: { dernier_km_adresse: adresse.trim() || null, notes: notes.trim() || null },
      });
      toast.success('Informations enregistrées');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4" />
            <span className="font-mono text-sm">{colis.reference ?? '—'}</span>
            <Badge variant="outline" className={cn('text-[10px]', GP_STEP_TONE[step])}>
              {GP_STEPS.find(s => s.id === step)?.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Progression */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Avancement</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {GP_STEPS.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={s.id === step ? 'default' : 'outline'}
                  disabled={update.isPending}
                  onClick={() => setStatus(s.status)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Contacts */}
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <p className="font-medium">{colis.recipient_name ?? colis.sender_name ?? 'Client'}</p>
            <p className="text-xs text-muted-foreground">{tel || 'Pas de téléphone'}</p>
            <p className="text-xs text-muted-foreground">
              {colis.origin_city ?? '—'} → {colis.destination_city ?? colis.destination_country ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              GP #{colis.assigned_transporteur_ref ?? '—'} ·{' '}
              {Number(colis.actual_weight_kg ?? colis.estimated_weight ?? 0)} kg
            </p>
            {digits && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={`tel:${tel}`}><Phone className="w-3.5 h-3.5 mr-1" /> Appeler</a>
                </Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Dernier kilomètre */}
          <div className="space-y-2">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Adresse dernier kilomètre
              </Label>
              <Input className="h-9" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
              {(colis.pickup_zone || colis.pickup_quartier) && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enlèvement : {[colis.pickup_quartier, colis.pickup_zone].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Notes terrain</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={saveInfos} disabled={update.isPending}>
              <Save className="w-4 h-4 mr-1" /> Enregistrer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

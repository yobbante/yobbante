import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Home, CheckCircle2, MessageCircle, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { InboxDossier } from '@/hooks/useInboxDossiers';

const MODE_LABEL: Record<string, string> = {
  pickup_gp: 'Récupération chez le GP',
  relay_point: 'Dépôt en point relais',
  home_delivery: 'Livraison à domicile',
};

interface Props {
  dossier: InboxDossier;
  onChanged?: () => void;
}

export function DeliveryFinalePanel({ dossier, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const mode = dossier.delivery_mode || 'pickup_gp';
  const arrived = dossier.status === 'ARRIVED_HUB' || dossier.status === 'DELIVERED';
  const delivered = dossier.status === 'DELIVERED';

  const Icon = mode === 'relay_point' ? MapPin : mode === 'home_delivery' ? Home : Truck;

  const address =
    mode === 'relay_point'
      ? [dossier.relay_point_name, dossier.relay_point_address].filter(Boolean).join(' · ')
      : mode === 'home_delivery'
      ? dossier.recipient_address || '—'
      : 'Récupération chez le GP';

  const callDispatch = async (action: 'notify_client' | 'contact_gp') => {
    setBusy(action);
    try {
      const { error } = await supabase.functions.invoke('delivery-dispatch', {
        body: { dossier_id: dossier.id, manual: true, target: action },
      });
      if (error) throw error;
      toast.success(action === 'notify_client' ? 'Client notifié' : 'GP contacté');
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur envoi');
    } finally {
      setBusy(null);
    }
  };

  const markDelivered = async () => {
    setBusy('deliver');
    try {
      const { error } = await supabase
        .from('dossiers')
        .update({ status: 'DELIVERED' as any })
        .eq('id', dossier.id);
      if (error) throw error;
      await supabase.from('dossier_events').insert({
        dossier_id: dossier.id,
        type: 'delivery_completed',
        payload: { delivery_mode: mode },
      } as any);
      toast.success('Dossier marqué comme livré');
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#F5C518]" />
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Livraison finale
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Mode : </span>
          <span className="text-foreground font-medium">{MODE_LABEL[mode] || mode}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Adresse : </span>
          <span className="text-foreground">{address}</span>
        </div>
        {mode === 'home_delivery' && dossier.delivery_carrier && (
          <div>
            <span className="text-muted-foreground">Transporteur : </span>
            <span className="text-foreground">{dossier.delivery_carrier}</span>
            {dossier.delivery_cost_xof != null && (
              <span className="text-muted-foreground"> · {dossier.delivery_cost_xof.toLocaleString('fr-FR')} XOF</span>
            )}
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Statut : </span>
          <span className="text-foreground font-medium">
            {delivered ? 'Livré' : arrived ? 'En attente' : 'En transit'}
          </span>
          {dossier.delivery_reminder_count != null && dossier.delivery_reminder_count > 0 && (
            <span className="ml-2 text-[10px] text-muted-foreground">
              {dossier.delivery_reminder_count} relance(s)
            </span>
          )}
        </div>
      </div>

      {arrived && !delivered && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => callDispatch('notify_client')}>
            {busy === 'notify_client' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BellRing className="w-3 h-3 mr-1" />}
            Notifier le client
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => callDispatch('contact_gp')}>
            {busy === 'contact_gp' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <MessageCircle className="w-3 h-3 mr-1" />}
            Contacter le GP
          </Button>
          <Button
            size="sm"
            className="bg-[#F5C518] text-[#0A0E1A] hover:bg-[#F5C518]/90"
            disabled={!!busy}
            onClick={markDelivered}
          >
            {busy === 'deliver' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Marquer comme récupéré
          </Button>
        </div>
      )}
    </div>
  );
}

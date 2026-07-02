import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2, MessageCircle, Eye, Plane, Truck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SOURCE_BY_ID, type IntakeSource } from '@/lib/intakeSources';
import { cardTone, detectCarrier, isFromKonnekt } from '@/lib/inboxFilters';
import { LIFECYCLE_BADGE } from '@/lib/dossierLifecycle';
import { DossierLifecycleRail } from '@/components/admin/dossiers/DossierLifecycleRail';
import type { InboxDossier } from '@/hooks/useInboxDossiers';
import { DossierLink, ClientLink, DepartureLink, GpLink } from '@/components/admin/links/EntityLink';

interface Props {
  dossier: InboxDossier;
  onView: (d: InboxDossier) => void;
  onConfirm: (d: InboxDossier) => void;
  onWhatsApp: (d: InboxDossier) => void;
}

const TONE_CLASS = {
  fresh: 'border-l-emerald-500',
  warn:  'border-l-orange-500',
  late:  'border-l-red-500',
  konnekt: 'border-l-sky-500',
} as const;

const CARRIER_LABEL: Record<string, string> = {
  gp_yobbante: 'GP Yobbanté',
  konnekt: 'Konnekt',
  dhl: 'DHL', fedex: 'FedEx', other: 'Autre',
};

export function InboxCard({ dossier, onView, onConfirm, onWhatsApp }: Props) {
  const src = SOURCE_BY_ID[(dossier.source as IntakeSource) || 'site_web'] || SOURCE_BY_ID.autre;
  const tone = cardTone(dossier);
  const carrier = detectCarrier(dossier);
  const clientName = dossier.buyer_name || dossier.contact_phone || 'Client sans nom';
  const ago = formatDistanceToNow(new Date(dossier.created_at), { locale: fr, addSuffix: true });
  const dest = dossier.destination_city || dossier.destination_country;
  const amount = dossier.final_amount_xof ?? (dossier.estimated_cost != null ? Math.round(dossier.estimated_cost * 655.957) : null);

  return (
    <Card data-dossier-id={dossier.id} className={`p-3 space-y-2 bg-card border-border border-l-4 hover:border-primary/40 transition-colors ${TONE_CLASS[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <DossierLink id={dossier.id} reference={dossier.reference} className="text-[11px] font-mono" plain>
              {dossier.reference}
            </DossierLink>
            {isFromKonnekt(dossier) && (
              <Badge className="text-[9px] px-1 py-0 h-4 bg-sky-500/15 text-sky-500 border-0">Konnekt</Badge>
            )}
            {LIFECYCLE_BADGE[dossier.status] && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${LIFECYCLE_BADGE[dossier.status].tone}`}>
                {LIFECYCLE_BADGE[dossier.status].label}
              </span>
            )}
          </div>
          <ClientLink name={dossier.buyer_name} phone={dossier.contact_phone} className="text-sm font-medium truncate" plain>{clientName}</ClientLink>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant="outline"
            className="border-0 text-[10px] px-1.5 py-0.5"
            style={{ background: `${src.color}22`, color: src.color }}
          >
            {src.label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-foreground/90">
        <span className="font-medium truncate">{dossier.origin_city || dossier.origin_country}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{dest}</span>
        {dossier.estimated_weight && <span className="text-muted-foreground shrink-0">· {dossier.estimated_weight}kg</span>}
      </div>

      {amount != null && (
        <div className="text-sm font-semibold text-foreground">{amount.toLocaleString('fr-FR')} FCFA</div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          {carrier === 'gp_yobbante' ? <Plane className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
          {CARRIER_LABEL[carrier]}
        </span>
        <span>{ago}</span>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Départ : {dossier.assigned_departure_id
          ? <DepartureLink id={dossier.assigned_departure_id} plain className="text-foreground">assigné</DepartureLink>
          : 'à choisir'}
      </div>

      <div className="flex gap-1 pt-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] flex-1" onClick={() => onView(dossier)}>
          <Eye className="w-3 h-3 mr-1" /> Détail
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          onClick={() => onWhatsApp(dossier)}
          disabled={!dossier.contact_phone}
          title={dossier.contact_phone ? 'WhatsApp client' : 'Numéro manquant'}
        >
          <MessageCircle className="w-3 h-3" />
        </Button>
        {dossier.status !== 'CONFIRMED' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-emerald-500"
            onClick={() => onConfirm(dossier)}
            title="Marquer confirmé"
          >
            <CheckCircle2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}

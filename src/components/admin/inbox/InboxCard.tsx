import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2, MessageCircle, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SOURCE_BY_ID, detectServiceKind, SERVICE_KINDS, type IntakeSource } from '@/lib/intakeSources';
import type { InboxDossier } from '@/hooks/useInboxDossiers';

interface Props {
  dossier: InboxDossier;
  onView: (d: InboxDossier) => void;
  onConfirm: (d: InboxDossier) => void;
  onWhatsApp: (d: InboxDossier) => void;
}

export function InboxCard({ dossier, onView, onConfirm, onWhatsApp }: Props) {
  const src = SOURCE_BY_ID[(dossier.source as IntakeSource) || 'site_web'] || SOURCE_BY_ID.autre;
  const kind = detectServiceKind(dossier);
  const kindMeta = SERVICE_KINDS.find(s => s.id === kind)!;
  const clientName = dossier.buyer_name || dossier.contact_phone || 'Client sans nom';
  const ago = formatDistanceToNow(new Date(dossier.created_at), { locale: fr, addSuffix: true });

  return (
    <Card className="p-3 space-y-2 bg-card border-border hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            {dossier.reference}
          </div>
          <div className="text-sm font-medium text-foreground truncate">{clientName}</div>
          {dossier.buyer_country && (
            <div className="text-[11px] text-muted-foreground truncate">{dossier.buyer_country}</div>
          )}
        </div>
        <Badge
          variant="outline"
          className="border-0 text-[10px] px-1.5 py-0.5 font-medium"
          style={{ background: `${src.color}22`, color: src.color }}
        >
          {src.label}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{kindMeta.label}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-foreground/80">
        <span className="font-medium">{dossier.origin_country}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <span className="font-medium">{dossier.destination_country}</span>
        {dossier.estimated_weight && <span className="text-muted-foreground">· {dossier.estimated_weight} kg</span>}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{ago}</span>
        {dossier.estimated_cost != null && (
          <span className="font-semibold text-foreground">{Math.round(dossier.estimated_cost)} €</span>
        )}
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
          title={dossier.contact_phone ? 'Envoyer récap WhatsApp' : 'Numéro manquant'}
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

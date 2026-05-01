import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Copy, Share2, Package, Inbox, Hash, MapPin, Calendar,
  CheckCircle2, Truck, ExternalLink, ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type Dossier, COUNTRY_FLAGS, DOSSIER_STATUS_ORDER, DOSSIER_STATUS_LABELS,
} from '@/lib/types';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const TIMELINE_STEPS = [
  { status: 'SUBMITTED',  label: 'Enregistré',  desc: 'Vos commandes sont sous suivi' },
  { status: 'IN_REVIEW',  label: 'En analyse',  desc: 'Vérification des informations' },
  { status: 'PROCURED',   label: 'Reçu au hub', desc: 'Le hub a réceptionné vos colis' },
  { status: 'IN_TRANSIT', label: 'En transit',  desc: 'Acheminement vers la destination' },
  { status: 'CUSTOMS',    label: 'Douane',      desc: 'Dédouanement en cours' },
  { status: 'DELIVERED',  label: 'Livré',       desc: 'Remis au destinataire' },
] as const;

function parseReceptionNotes(notes: string | null) {
  if (!notes) return { hub: null, destination: null, count: null, weight: null, value: null, items: [] as string[] };
  const get = (re: RegExp) => notes.match(re)?.[1]?.trim() ?? null;
  const items = notes
    .split('\n')
    .filter(line => line.startsWith('• '))
    .map(line => line.slice(2).trim());
  return {
    hub: get(/Hub:\s*(.+)/),
    destination: get(/Destination:\s*(.+)/),
    count: get(/Nombre de commandes:\s*(\d+)/),
    weight: get(/Poids total estimé:\s*([\d.]+)\s*kg/),
    value: get(/Valeur totale:\s*([\d.,]+)\s*€/),
    items,
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

interface ReceptionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: Dossier | null;
}

export function ReceptionDetailDrawer({ open, onOpenChange, dossier }: ReceptionDetailDrawerProps) {
  const navigate = useNavigate();
  if (!dossier) return null;

  const parsed = parseReceptionNotes(dossier.notes);
  const itemCount = parsed.items.length || (parsed.count ? Number(parsed.count) : 1);
  const flag = COUNTRY_FLAGS[dossier.origin_country] || '🌍';
  const destFlag = dossier.destination_country === 'SN' ? '🇸🇳' : '🌍';
  const destName = dossier.destination_country === 'SN' ? 'Sénégal' : dossier.destination_country;
  const currentIndex = DOSSIER_STATUS_ORDER.indexOf(dossier.status);

  const copyRef = () => {
    navigator.clipboard.writeText(dossier.reference);
    toast.success('Référence copiée');
  };

  const share = async () => {
    const text = `Suivi Yobbanté ${dossier.reference} — ${itemCount} commande(s) · ${parsed.hub ?? dossier.origin_country} → ${parsed.destination ?? destName}`;
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
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {dossier.reference}
          </p>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Inbox className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">
              {itemCount > 1 ? `${itemCount} commandes groupées` : 'Réception de commande'}
            </span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              {DOSSIER_STATUS_LABELS[dossier.status]}
            </span>
            <span className="text-muted-foreground">
              Créé le {new Date(dossier.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-8">
          {/* Reference card */}
          <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl">
            <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Référence</p>
              <p className="text-sm font-mono font-semibold text-foreground truncate">{dossier.reference}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyRef} aria-label="Copier">
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          {/* Route + value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Route</p>
              <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1">
                <span>{flag}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span>{destFlag}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {parsed.hub ?? dossier.origin_country} → {parsed.destination ?? destName}
              </p>
            </div>
            <div className="bg-secondary rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valeur</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {parsed.value || dossier.budget_eur
                  ? fmtEur(Number(parsed.value?.replace(',', '.') ?? dossier.budget_eur ?? 0))
                  : '—'}
              </p>
            </div>
          </div>

          {/* Live Timeline */}
          <div>
            <SectionTitle>Suivi en direct</SectionTitle>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, i) => {
                const stepIdx = DOSSIER_STATUS_ORDER.indexOf(step.status as any);
                const isActive = stepIdx === currentIndex;
                const isDone = stepIdx < currentIndex;
                const isFuture = stepIdx > currentIndex;
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

          {/* Items list */}
          {parsed.items.length > 0 && (
            <div>
              <SectionTitle>Commandes ({parsed.items.length})</SectionTitle>
              <div className="space-y-2">
                {parsed.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl">
                    <ShoppingBag className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground break-words">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logistics summary */}
          <div>
            <SectionTitle>Logistique</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
              {parsed.hub && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Hub d'arrivée
                  </span>
                  <span className="font-medium text-foreground">{parsed.hub}</span>
                </div>
              )}
              {parsed.destination && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Livraison finale
                  </span>
                  <span className="font-medium text-foreground">{parsed.destination}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Colis attendus
                </span>
                <span className="font-medium text-foreground">{itemCount}</span>
              </div>
              {(parsed.weight || dossier.estimated_weight) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Poids estimé
                  </span>
                  <span className="font-medium text-foreground">
                    ≈ {parsed.weight ?? dossier.estimated_weight} kg
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Date de création
                </span>
                <span className="font-medium text-foreground">
                  {new Date(dossier.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => { navigate(`/app/dossier/${dossier.id}`); onOpenChange(false); }}
            >
              <ExternalLink className="w-4 h-4 mr-2" /> Page complète
            </Button>
            <Button variant="outline" className="flex-1" onClick={share}>
              <Share2 className="w-4 h-4 mr-2" /> Partager
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

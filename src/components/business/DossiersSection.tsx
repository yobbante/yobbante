import { useState } from 'react';
import {
  FileText, Plus, Loader2, Truck, Globe2, PackageSearch, Download, Sparkles, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessDossiers, type BusinessDossier, type DossierType } from '@/hooks/useBusinessDossiers';
import { CUSTOMS_DOCS, type CustomsDocKind } from '@/lib/business-constants';
import { NewBusinessDossierWizard } from './NewBusinessDossierWizard';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<DossierType, any> = {
  business_import: Truck,
  business_export: Globe2,
  business_sourcing: PackageSearch,
};
const TYPE_LABEL: Record<DossierType, string> = {
  business_import: 'Import',
  business_export: 'Export',
  business_sourcing: 'Sourcing',
};

interface Props { businessId: string }

export function DossiersSection({ businessId }: Props) {
  const { dossiers, loading, refresh } = useBusinessDossiers(businessId);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessDossier | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Dossiers business</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Import, export, sourcing — orchestrés de bout en bout.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau dossier
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : dossiers.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Aucun dossier business pour le moment.
          </p>
          <Button onClick={() => setWizardOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Créer mon premier dossier
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {dossiers.map(d => (
            <DossierRow key={d.id} dossier={d} onOpen={() => setSelected(d)} />
          ))}
        </div>
      )}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau dossier business</DialogTitle>
          </DialogHeader>
          <NewBusinessDossierWizard
            businessId={businessId}
            onClose={() => setWizardOpen(false)}
            onCreated={refresh}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && <DossierDetail dossier={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DossierRow({ dossier, onOpen }: { dossier: BusinessDossier; onOpen: () => void }) {
  const Icon = TYPE_ICON[dossier.dossier_type];
  return (
    <button
      onClick={onOpen}
      className="w-full text-left p-4 rounded-[var(--radius)] border border-border bg-card hover:border-primary/60 transition-all flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-[var(--radius)] bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold font-mono text-sm">{dossier.reference}</span>
          <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[dossier.dossier_type]}</Badge>
          <Badge variant="outline" className="text-[10px]">{dossier.status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {dossier.origin_country} → {dossier.destination_country} · {dossier.product_description}
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        {dossier.declared_value && (
          <div className="text-sm font-bold">{Number(dossier.declared_value).toFixed(0)} {dossier.currency}</div>
        )}
        {dossier.incoterm && <div className="text-[10px] text-muted-foreground">{dossier.incoterm}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function DossierDetail({ dossier }: { dossier: BusinessDossier }) {
  const Icon = TYPE_ICON[dossier.dossier_type];
  const [generating, setGenerating] = useState<CustomsDocKind | null>(null);

  const generate = async (kind: CustomsDocKind) => {
    setGenerating(kind);
    try {
      const { data, error } = await supabase.functions.invoke('generate-customs-doc', {
        body: { dossier_id: dossier.id, kind },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Document généré.');
      } else {
        toast.error('Génération réussie mais lien indisponible.');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Génération impossible.', { description: e?.message });
    } finally {
      setGenerating(null);
    }
  };

  const isExport = dossier.dossier_type === 'business_export';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-[var(--radius)] bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono">{dossier.reference}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[dossier.dossier_type]}</Badge>
              <Badge variant="outline" className="text-[10px]">{dossier.status}</Badge>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-4 space-y-2 text-sm">
        <Row label="Produit" value={dossier.product_description} />
        <Row label="Route" value={`${dossier.origin_country} → ${dossier.destination_country}`} />
        <Row label="Incoterm" value={dossier.incoterm ?? '—'} />
        {dossier.hs_code && <Row label="Code HS" value={dossier.hs_code} />}
        {dossier.quantity && <Row label="Quantité" value={`${dossier.quantity} ${dossier.unit ?? ''}`} />}
        {dossier.estimated_weight && <Row label="Poids" value={`${dossier.estimated_weight} kg`} />}
        {dossier.declared_value && <Row label="Valeur déclarée" value={`${Number(dossier.declared_value).toFixed(2)} ${dossier.currency}`} />}
        {isExport && dossier.buyer_name && <Row label="Acheteur" value={`${dossier.buyer_name} (${dossier.buyer_country ?? '—'})`} />}
        {!isExport && dossier.supplier_name && <Row label="Fournisseur" value={`${dossier.supplier_name} (${dossier.supplier_country ?? '—'})`} />}
        {dossier.notes && <Row label="Notes" value={dossier.notes} />}
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Documents douaniers</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Générez les PDF officiels nécessaires à votre opération. Ils sont stockés dans votre espace.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {CUSTOMS_DOCS.map(doc => (
            <button
              key={doc.kind}
              onClick={() => generate(doc.kind)}
              disabled={generating !== null}
              className={cn(
                'flex items-center gap-3 p-3 rounded-[var(--radius)] border border-border bg-card text-left transition-all',
                'hover:border-primary/60 disabled:opacity-50'
              )}
            >
              <div className="w-8 h-8 rounded-[var(--radius)] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {generating === doc.kind
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{doc.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{doc.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

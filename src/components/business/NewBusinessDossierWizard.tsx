import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Package, Globe2, FileText,
  Truck, PackageSearch, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { INCOTERMS, CURRENCIES, UNITS, COUNTRIES } from '@/lib/business-constants';
import { cn } from '@/lib/utils';

type DossierType = 'business_import' | 'business_export' | 'business_sourcing';

const TYPE_META: Record<DossierType, { label: string; icon: any; desc: string; color: string }> = {
  business_import:   { label: 'Import',   icon: Truck,         desc: 'Faire venir des marchandises au Sénégal',     color: 'text-emerald-500' },
  business_export:   { label: 'Export',   icon: Globe2,        desc: 'Exporter votre production hors du Sénégal',   color: 'text-amber-500' },
  business_sourcing: { label: 'Sourcing', icon: PackageSearch, desc: 'Trouver et acheter via nos relais étrangers', color: 'text-primary' },
};

interface Props {
  businessId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Step = 'type' | 'product' | 'logistics' | 'parties' | 'review';

export function NewBusinessDossierWizard({ businessId, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<DossierType | null>(null);

  // Product
  const [description, setDescription] = useState('');
  const [hsCode, setHsCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [weight, setWeight] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('EUR');

  // Logistics
  const [originCountry, setOriginCountry] = useState('Chine');
  const [destinationCountry, setDestinationCountry] = useState('Sénégal');
  const [incoterm, setIncoterm] = useState('FOB');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');

  // Parties
  const [supplierName, setSupplierName] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [buyerContact, setBuyerContact] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const isExport = type === 'business_export';
  const isSourcing = type === 'business_sourcing';

  // Adjust defaults based on type
  const handleTypeSelect = (t: DossierType) => {
    setType(t);
    if (t === 'business_export') {
      setOriginCountry('Sénégal');
      setDestinationCountry('France');
    } else {
      setOriginCountry('Chine');
      setDestinationCountry('Sénégal');
    }
    setStep('product');
  };

  const submit = async () => {
    if (!user || !type) return;
    setSubmitting(true);

    const payload: any = {
      user_id: user.id,
      business_id: businessId,
      dossier_type: type,
      product_description: description.trim(),
      origin_country: originCountry,
      destination_country: destinationCountry,
      incoterm,
      hs_code: hsCode.trim() || null,
      currency,
      declared_value: value ? Number(value) : null,
      quantity: quantity ? Number(quantity) : null,
      unit,
      estimated_weight: weight ? Number(weight) : null,
      budget_eur: budget ? Number(budget) : null,
      notes: notes.trim() || null,
      status: 'SUBMITTED',
    };

    if (isExport) {
      payload.buyer_name = buyerName.trim() || null;
      payload.buyer_country = buyerCountry || null;
      payload.buyer_contact = buyerContact.trim() || null;
    } else {
      payload.supplier_name = supplierName.trim() || null;
      payload.supplier_country = supplierCountry || null;
      payload.supplier_contact = supplierContact.trim() || null;
      payload.needs_sourcing = isSourcing;
    }

    const { error } = await supabase.from('dossiers').insert(payload);
    setSubmitting(false);

    if (error) {
      console.error(error);
      toast.error('Création impossible. Réessayez.');
      return;
    }
    toast.success('Dossier créé.', { description: 'Notre équipe le prend en charge.' });

    // Trigger 1 — 3ème dossier du mois calendaire courant.
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('dossiers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', monthStart.toISOString());
      if ((count ?? 0) >= 3) {
        toast('💡 Avec le plan Starter, ce dossier vous aurait coûté 8% de moins en transport. L\'abonnement se rembourse en 1 dossier.', {
          duration: 9000,
          action: {
            label: 'Voir les plans →',
            onClick: () => { window.location.href = '/business/pricing'; },
          },
        });
      }
    } catch (e) {
      // best-effort, ne bloque pas la création
      console.warn('[upgrade-nudge] dossier count failed', e);
    }

    onCreated();
    onClose();
  };

  const stepIndex = ['type', 'product', 'logistics', 'parties', 'review'].indexOf(step);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      {step !== 'type' && (
        <div className="flex items-center gap-2 text-xs">
          {['Produit', 'Logistique', 'Contreparties', 'Validation'].map((label, i) => {
            const reached = stepIndex - 1 >= i;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center font-semibold',
                  reached ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                )}>{i + 1}</div>
                <span className={cn('hidden sm:inline', reached ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                {i < 3 && <div className={cn('w-6 sm:w-12 h-px', reached ? 'bg-primary' : 'bg-border')} />}
              </div>
            );
          })}
        </div>
      )}

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {/* TYPE */}
        {step === 'type' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Quel type de dossier ?</h2>
              <p className="text-sm text-muted-foreground mt-1">Choisissez l'opération que vous souhaitez orchestrer.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {(Object.keys(TYPE_META) as DossierType[]).map(t => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                return (
                  <button
                    key={t}
                    onClick={() => handleTypeSelect(t)}
                    className="text-left p-5 rounded-[var(--radius)] border border-border bg-card hover:border-primary/60 hover:-translate-y-0.5 transition-all"
                  >
                    <Icon className={cn('w-7 h-7 mb-3', meta.color)} />
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-xs text-muted-foreground mt-1.5">{meta.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
            </div>
          </div>
        )}

        {/* PRODUCT */}
        {step === 'product' && type && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Produit & quantité</h2>
              <p className="text-sm text-muted-foreground mt-1">Décrivez ce qui doit être expédié.</p>
            </div>
            <div>
              <Label htmlFor="desc">Description du produit *</Label>
              <Textarea
                id="desc" value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Lot de 1000 pièces de smartphones reconditionnés modèle X"
                className="mt-1.5 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qty">Quantité</Label>
                <Input id="qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1000" className="mt-1.5" />
              </div>
              <div>
                <Label>Unité</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight">Poids estimé (kg)</Label>
                <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="450" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="hs">Code HS (optionnel)</Label>
                <Input id="hs" value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="8517.12" className="mt-1.5 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="val">Valeur déclarée</Label>
                <Input id="val" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="12000" className="mt-1.5" />
              </div>
              <div>
                <Label>Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('type')}><ArrowLeft className="w-4 h-4 mr-2" />Type</Button>
              <Button onClick={() => setStep('logistics')} disabled={description.trim().length < 5}>
                Continuer <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* LOGISTICS */}
        {step === 'logistics' && type && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Logistique & route</h2>
              <p className="text-sm text-muted-foreground mt-1">D'où à où, dans quelles conditions.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pays d'origine *</Label>
                <Select value={originCountry} onValueChange={setOriginCountry}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pays de destination *</Label>
                <Select value={destinationCountry} onValueChange={setDestinationCountry}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Incoterm *</Label>
              <Select value={incoterm} onValueChange={setIncoterm}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{INCOTERMS.map(i => <SelectItem key={i.code} value={i.code}>{i.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">Définit le partage des frais et risques.</p>
            </div>
            <div>
              <Label htmlFor="bud">Budget logistique (EUR)</Label>
              <Input id="bud" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="2500" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Délais, contraintes particulières…" className="mt-1.5" />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('product')}><ArrowLeft className="w-4 h-4 mr-2" />Produit</Button>
              <Button onClick={() => setStep('parties')}>Continuer <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {/* PARTIES */}
        {step === 'parties' && type && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {isExport ? 'Acheteur' : isSourcing ? 'Sourcing' : 'Fournisseur'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isSourcing
                  ? 'Si vous n\'avez pas de fournisseur, laissez vide — notre équipe trouve pour vous.'
                  : isExport
                    ? 'Coordonnées de votre client à l\'étranger.'
                    : 'Coordonnées du fournisseur à l\'étranger.'}
              </p>
            </div>

            {isExport ? (
              <>
                <div>
                  <Label htmlFor="bn">Nom acheteur</Label>
                  <Input id="bn" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="ACME Corp" className="mt-1.5" />
                </div>
                <div>
                  <Label>Pays acheteur</Label>
                  <Select value={buyerCountry} onValueChange={setBuyerCountry}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bc">Contact (email / téléphone)</Label>
                  <Input id="bc" value={buyerContact} onChange={(e) => setBuyerContact(e.target.value)} placeholder="contact@acme.com" className="mt-1.5" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="sn">Nom fournisseur {isSourcing && <span className="text-muted-foreground text-xs">(optionnel)</span>}</Label>
                  <Input id="sn" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Shenzhen Co. Ltd" className="mt-1.5" />
                </div>
                <div>
                  <Label>Pays fournisseur</Label>
                  <Select value={supplierCountry} onValueChange={setSupplierCountry}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sc">Contact (email / téléphone)</Label>
                  <Input id="sc" value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} placeholder="sales@shenzhen.cn" className="mt-1.5" />
                </div>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('logistics')}><ArrowLeft className="w-4 h-4 mr-2" />Logistique</Button>
              <Button onClick={() => setStep('review')}>Récapitulatif <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {/* REVIEW */}
        {step === 'review' && type && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Vérifiez et confirmez</h2>
              <p className="text-sm text-muted-foreground mt-1">Vous pourrez modifier le dossier après création.</p>
            </div>
            <Card className="p-5 space-y-3">
              <Row label="Type" value={TYPE_META[type].label} />
              <Row label="Produit" value={description} />
              <Row label="Quantité" value={quantity ? `${quantity} ${unit}` : '—'} />
              <Row label="Poids" value={weight ? `${weight} kg` : '—'} />
              <Row label="Valeur" value={value ? `${value} ${currency}` : '—'} />
              <Row label="Route" value={`${originCountry} → ${destinationCountry}`} />
              <Row label="Incoterm" value={incoterm} />
              {isExport
                ? <Row label="Acheteur" value={buyerName ? `${buyerName} (${buyerCountry || '—'})` : '—'} />
                : <Row label="Fournisseur" value={supplierName ? `${supplierName} (${supplierCountry || '—'})` : isSourcing ? 'À sourcer par Yobbanté' : '—'} />}
            </Card>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('parties')} disabled={submitting}>
                <ArrowLeft className="w-4 h-4 mr-2" />Retour
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle2 className="w-4 h-4 mr-2" /> Créer le dossier
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CityPicker } from '@/components/quote/CityPicker';
import { useFretTarifs } from '@/hooks/useFretTarifs';
import { useDevisList, useDevisActions } from '@/hooks/useDevis';
import { computeDevis } from '@/lib/devisCompute';
import {
  ENGINE_LABELS, STATUS_LABELS, devisValidUntil, fcfa, formatDevisMessage,
  formatFrDate, isDevisExpired,
  type DevisEngine, type DevisLine, type DevisRow,
} from '@/lib/devis';
import { COLIS_SIZES, type ColisSize } from '@/lib/fretPricing';
import { toast } from 'sonner';
import { AlertTriangle, Eye, FileText, Loader2, Pencil, Plus, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkedDossierLite {
  id: string;
  reference: string | null;
  tracking_id: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  origin_country?: string | null;
  destination_country?: string | null;
  estimated_weight?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  dossier?: LinkedDossierLite | null;
  /** Devis à ouvrir directement en édition (module admin « Devis »). */
  initialDevis?: DevisRow | null;
}

export function DevisDialog({ open, onOpenChange, phone, dossier, initialDevis }: Props) {

  const { zones, destinations } = useFretTarifs();
  const { data: existing = [], isLoading } = useDevisList({
    phone, dossierId: dossier?.id ?? null, enabled: open,
  });
  const { create, saveEdit, send } = useDevisActions();

  const [editing, setEditing] = useState<DevisRow | null>(null);
  const [engine, setEngine] = useState<DevisEngine>('international');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [size, setSize] = useState<ColisSize>('M');
  const [express, setExpress] = useState(false);
  const [manualTotal, setManualTotal] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [extraLabel, setExtraLabel] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [validUntil, setValidUntil] = useState(devisValidUntil());
  const [preview, setPreview] = useState(false);

  // Pré-remplissage depuis le dossier lié à la conversation.
  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setPreview(false);
    setManualTotal(false);
    setManualValue('');
    setExtraLabel(''); setExtraAmount('');
    setValidUntil(devisValidUntil());
    if (dossier) {
      setOrigin(dossier.origin_city || '');
      setDestination(dossier.destination_city || '');
      setWeight(dossier.estimated_weight ? String(dossier.estimated_weight) : '');
    }
  }, [open, dossier?.id]); // eslint-disable-line

  const fretDestOptions = useMemo(() => {
    const scope = engine === 'fret_national' ? 'national' : 'international';
    return destinations.filter(d => d.scope === scope);
  }, [destinations, engine]);

  const computed = useMemo(() => computeDevis({
    engine,
    origin: engine === 'international' ? origin : 'Dakar',
    destination,
    weightKg: weight ? Number(weight.replace(',', '.')) : null,
    size,
    express,
    zones, destinations,
  }), [engine, origin, destination, weight, size, express, zones, destinations]);

  const extra: DevisLine | null =
    extraLabel.trim() && Number(extraAmount) > 0
      ? { label: extraLabel.trim(), amountFcfa: Math.round(Number(extraAmount)) }
      : null;

  const lines: DevisLine[] = [...computed.lines, ...(extra ? [extra] : [])];
  const autoTotal = lines.reduce((s, l) => s + l.amountFcfa, 0);
  const total = manualTotal ? Math.round(Number(manualValue) || 0) : autoTotal;

  const draftRow: DevisRow = {
    id: 'draft', reference: editing?.reference ?? 'DEV-…',
    version: editing ? (editing.status === 'pending_send' ? editing.version : editing.version + 1) : 1,
    parent_id: null, is_current: true,
    dossier_id: dossier?.id ?? null, conversation_phone: phone,
    engine,
    origin: engine === 'international' ? origin : 'Dakar',
    destination,
    weight_kg: weight ? Number(weight.replace(',', '.')) : null,
    colis_size: engine === 'fret_national' ? size : null,
    mode: engine === 'international' ? (express ? 'Express' : 'Standard') : ENGINE_LABELS[engine],
    breakdown: lines, total_fcfa: total, total_manual: manualTotal,
    notes: null, status: 'pending_send', valid_until: validUntil,
    sent_at: null, created_at: new Date().toISOString(),
  };

  const canSave = total > 0 && (computed.ok || manualTotal);

  function loadForEdit(d: DevisRow) {
    setEditing(d);
    setEngine(d.engine);
    setOrigin(d.origin ?? '');
    setDestination(d.destination ?? '');
    setWeight(d.weight_kg ? String(d.weight_kg) : '');
    if (d.colis_size) setSize(d.colis_size as ColisSize);
    setExpress((d.mode ?? '').toLowerCase().includes('express'));
    setManualTotal(d.total_manual);
    setManualValue(String(d.total_fcfa));
    setValidUntil(d.valid_until);
    setPreview(false);
  }

  async function persist(): Promise<DevisRow | null> {
    const payload = {
      engine, origin: draftRow.origin, destination: draftRow.destination,
      weight_kg: draftRow.weight_kg, colis_size: draftRow.colis_size, mode: draftRow.mode,
      breakdown: lines, total_fcfa: total, total_manual: manualTotal, valid_until: validUntil,
      dossier_id: dossier?.id ?? null, conversation_phone: phone,
    };
    if (editing) return await saveEdit.mutateAsync({ base: editing, patch: payload });
    return await create.mutateAsync(payload);
  }

  async function handleSave() {
    try {
      const row = await persist();
      if (row) { setEditing(row); toast.success(`Devis ${row.reference} enregistré (en attente d'envoi)`); }
    } catch (e) {
      toast.error('Échec enregistrement', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleSend(row?: DevisRow) {
    try {
      const target = row ?? (await persist());
      if (!target) return;
      await send.mutateAsync({ devis: target, phone });
      toast.success('Devis envoyé sur WhatsApp');
      onOpenChange(false);
    } catch (e) {
      toast.error('Échec envoi', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  const busy = create.isPending || saveEdit.isPending || send.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-[#F5C518]" />
            {editing ? `Modifier ${editing.reference}` : 'Créer un devis'}
          </DialogTitle>
        </DialogHeader>

        {/* Devis existants */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Chargement…</div>
        ) : existing.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">Devis de ce contact</p>
            {existing.filter(d => d.is_current).map((d) => {
              const expired = isDevisExpired(d);
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">
                      {d.reference}{d.version > 1 && <span className="text-muted-foreground"> v{d.version}</span>} · {fcfa(d.total_fcfa)}
                      {d.total_manual && <span className="text-muted-foreground"> · ajusté</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {d.origin} → {d.destination} · valable jusqu'au {formatFrDate(d.valid_until)}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('h-5 text-[9px]', expired && 'border-red-500/40 text-red-500')}>
                    {expired ? <><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Devis expiré</> : STATUS_LABELS[d.status]}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => loadForEdit(d)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleSend(d)} disabled={busy}>
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
            {editing && (
              <Button size="sm" variant="outline" className="h-7 text-[11px]"
                      onClick={() => { setEditing(null); setPreview(false); }}>
                <Plus className="w-3 h-3 mr-1" /> Nouveau devis
              </Button>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Type d'envoi</label>
            <select
              value={engine}
              onChange={(e) => { setEngine(e.target.value as DevisEngine); setDestination(''); }}
              className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 mt-1"
            >
              {(Object.keys(ENGINE_LABELS) as DevisEngine[]).map(k => (
                <option key={k} value={k}>{ENGINE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {engine === 'international' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Origine</label>
                <CityPicker value={origin} onChange={setOrigin} includeHub placeholder="Ville de départ" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Destination</label>
                <CityPicker value={destination} onChange={setDestination} includeHub placeholder="Ville d'arrivée" />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                {engine === 'fret_national' ? 'Ville de destination' : 'Pays de destination'} · départ Dakar
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 mt-1"
              >
                <option value="">Choisir…</option>
                {fretDestOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          )}

          {engine === 'fret_national' ? (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Taille du colis</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {COLIS_SIZES.map(s => (
                  <button key={s.key} type="button" onClick={() => setSize(s.key)}
                          className={cn('rounded-md border p-2 text-left text-[10px]',
                            size === s.key ? 'border-[#F5C518] bg-[#F5C518]/10' : 'border-border')}>
                    <div className="text-xs font-semibold">{s.key} · {s.label}</div>
                    <div className="text-muted-foreground">{s.weight}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Poids (kg)</label>
                <Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal"
                       placeholder="ex : 5" className="h-8 text-xs mt-1" />
              </div>
              {engine === 'international' && (
                <label className="flex items-center gap-2 text-xs pb-1">
                  <Switch checked={express} onCheckedChange={setExpress} /> Express
                </label>
              )}
            </div>
          )}

          {/* Ligne libre */}
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Input value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)}
                   placeholder="Ligne libre (ex : emballage spécial)" className="h-8 text-xs" />
            <Input value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)}
                   inputMode="numeric" placeholder="FCFA" className="h-8 text-xs" />
          </div>

          {/* Total */}
          <div className="rounded-md border border-border p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Total</span>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                Total manuel <Switch checked={manualTotal} onCheckedChange={(v) => {
                  setManualTotal(v); if (v && !manualValue) setManualValue(String(autoTotal));
                }} />
              </label>
            </div>
            {manualTotal ? (
              <Input value={manualValue} onChange={(e) => setManualValue(e.target.value)}
                     inputMode="numeric" className="h-8 text-xs" placeholder="Total FCFA" />
            ) : (
              <div className="text-lg font-bold">{fcfa(autoTotal)}</div>
            )}
            {computed.message && (
              <p className={cn('text-[11px]', computed.manualQuote ? 'text-orange-500' : 'text-muted-foreground')}>
                {computed.manualQuote ? 'Devis sur mesure nécessaire — ' : ''}{computed.message}
              </p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Valable jusqu'au
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                     className="h-7 text-[11px] w-36" />
            </div>
          </div>

          {preview && (
            <pre className="text-[11px] whitespace-pre-wrap font-mono bg-muted/40 rounded p-2 max-h-56 overflow-y-auto">
              {formatDevisMessage(draftRow)}
            </pre>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="w-3.5 h-3.5 mr-1" /> Fermer
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreview(p => !p)} disabled={!canSave}>
              <Eye className="w-3.5 h-3.5 mr-1" /> Aperçu
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={!canSave || busy}>
              Enregistrer
            </Button>
            <Button size="sm" onClick={() => handleSend()} disabled={!canSave || busy}
                    className="bg-[#F5C518] text-zinc-950 hover:bg-[#F5C518]/90">
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

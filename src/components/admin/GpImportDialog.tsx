import { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2, Send, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RowStatus = 'valid' | 'warning' | 'error';

interface ParsedRow {
  excelRow: number; // actual row number for display
  reference: string;
  prenom: string;
  nom: string;
  telephone_1: string;
  telephone_2: string | null;
  whatsapp: string | null;
  adresse_1: string;
  adresse_2: string | null;
  ville: string;
  zone: string | null;
  modes_transport: string[];
  destinations: string[];
  notes: string | null;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  duplicate?: boolean;
  matchedById?: string; // id of an existing transporteur matched by ref or phone
  matchedByPhone?: boolean;
}

const EXAMPLE_REFS = new Set(['2241', '1892', '3310']);

function normRef(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\D/g, '').slice(0, 4);
}
function s(v: any): string {
  return v === null || v === undefined ? '' : String(v).trim();
}
function normHeader(v: any): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
function phoneDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}
function isPhoneSn(v: string): boolean {
  if (!v) return false;
  const c = v.replace(/[\s.-]/g, '');
  return /^\+221[0-9]{9}$/.test(c) || /^00221[0-9]{9}$/.test(c) || /^7[05-8][0-9]{7}$/.test(c);
}
function splitList(v: any): string[] {
  const t = s(v);
  if (!t) return [];
  return t.split(',').map(x => x.trim()).filter(Boolean);
}

// Map a normalized header to a canonical field id.
function headerToField(h: string): string | null {
  if (!h) return null;
  if (h === 'reference' || h === 'ref') return 'reference';
  if (h === 'prenom') return 'prenom';
  if (h === 'nom') return 'nom';
  if (h === 'telephone1' || h === 'tel1' || h === 'telephoneprincipal') return 'telephone_1';
  if (h === 'telephone2' || h === 'tel2' || h === 'telephonesecondaire') return 'telephone_2';
  if (h === 'whatsapp' || h === 'wa') return 'whatsapp';
  if (h === 'adresse1' || h === 'adresseprincipale') return 'adresse_1';
  if (h === 'adresse2' || h === 'adressesecondaire') return 'adresse_2';
  if (h === 'ville') return 'ville';
  if (h === 'zone' || h === 'quartier') return 'zone';
  if (h.startsWith('modes') || h.startsWith('mode')) return 'modes_transport';
  if (h.startsWith('destinations') || h.startsWith('destination')) return 'destinations';
  if (h === 'notes' || h === 'note' || h === 'commentaires' || h === 'commentaire') return 'notes';
  return null;
}


type Step = 'upload' | 'preview' | 'progress' | 'done';

export function GpImportDialog({
  open,
  onOpenChange,
  existingRefs,
  onAfterImport,
  onTriggerBlast,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingRefs: Set<string>;
  onAfterImport: () => void;
  onTriggerBlast: () => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [filesize, setFilesize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('update');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; updated: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload'); setFilename(''); setFilesize(0); setRows([]);
    setProgress({ current: 0, total: 0 }); setResult(null);
  };

  const handleClose = (v: boolean) => {
    if (step === 'progress') return;
    if (!v) reset();
    onOpenChange(v);
  };

  const parseFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Format invalide — fichier .xlsx requis');
      return;
    }
    setFilename(file.name);
    setFilesize(file.size);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('base gp')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

      const parsed: ParsedRow[] = [];
      let emptyStreak = 0;
      // Start from row index 6 (Excel row 7)
      for (let i = 6; i < matrix.length; i++) {
        const row = matrix[i] ?? [];
        const ref = normRef(row[0]);
        if (!ref) {
          emptyStreak += 1;
          if (emptyStreak >= 3) break;
          continue;
        }
        emptyStreak = 0;
        if (EXAMPLE_REFS.has(ref) && i < 9) continue; // skip example rows in 7..9 area

        const prenom = s(row[1]);
        const nom = s(row[2]);
        const tel1 = s(row[3]);
        const tel2 = s(row[4]);
        const wha  = s(row[5]);
        const adr1 = s(row[6]);
        const adr2 = s(row[7]);
        const ville= s(row[8]);
        const zone = s(row[9]);
        const modes = splitList(row[10]);
        const dests = splitList(row[11]);
        const notes = s(row[12]);

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!/^[0-9]{4}$/.test(ref)) errors.push('Référence invalide (4 chiffres requis)');
        if (!prenom) errors.push('Prénom manquant');
        if (!nom) errors.push('Nom manquant');
        if (!tel1) errors.push('Téléphone manquant');
        else if (!isPhoneSn(tel1)) errors.push('Téléphone invalide (format incorrect)');
        if (!adr1) errors.push('Adresse manquante');
        if (!ville) errors.push('Ville manquante');

        const duplicate = existingRefs.has(ref);
        if (duplicate) warnings.push(`Référence ${ref} déjà existante en base`);
        if (!wha && tel1) warnings.push('WhatsApp non renseigné (utilisera le téléphone principal)');

        let status: RowStatus = 'valid';
        if (errors.length) status = 'error';
        else if (warnings.length) status = 'warning';

        parsed.push({
          excelRow: i + 1,
          reference: ref, prenom, nom,
          telephone_1: tel1, telephone_2: tel2 || null,
          whatsapp: wha || null,
          adresse_1: adr1, adresse_2: adr2 || null,
          ville, zone: zone || null,
          modes_transport: modes, destinations: dests,
          notes: notes || null,
          status, errors, warnings, duplicate,
        });
      }

      // detect intra-file duplicates
      const seen = new Map<string, number>();
      parsed.forEach((r, idx) => {
        if (seen.has(r.reference)) {
          r.errors.push(`Référence dupliquée dans le fichier (ligne ${seen.get(r.reference)! + 7})`);
          r.status = 'error';
        } else {
          seen.set(r.reference, idx);
        }
      });

      if (!parsed.length) {
        toast.error('Aucune ligne détectée dans le fichier');
        return;
      }
      setRows(parsed);
      setStep('preview');
    } catch (e: any) {
      toast.error(`Erreur de lecture : ${e?.message ?? 'fichier illisible'}`);
    }
  }, [existingRefs]);

  const counts = useMemo(() => {
    const valid = rows.filter(r => r.status === 'valid').length;
    const warning = rows.filter(r => r.status === 'warning').length;
    const error = rows.filter(r => r.status === 'error').length;
    return { valid, warning, error };
  }, [rows]);

  const importable = useMemo(
    () => rows.filter(r => r.status !== 'error' && (!r.duplicate || duplicateMode === 'update')),
    [rows, duplicateMode],
  );

  const confirmImport = async () => {
    setStep('progress');
    setProgress({ current: 0, total: importable.length });
    let imported = 0, updated = 0, errors = 0;

    for (let i = 0; i < importable.length; i++) {
      const r = importable[i];
      const fullName = `${r.prenom} ${r.nom}`.trim();
      const payload = {
        reference: r.reference,
        nom: fullName,
        prenom: r.prenom,
        telephone_1: r.telephone_1,
        telephone_2: r.telephone_2,
        whatsapp: r.whatsapp,
        adresse_1: r.adresse_1,
        adresse_2: r.adresse_2,
        ville: r.ville,
        zone: r.zone,
        modes_transport: r.modes_transport,
        destinations: r.destinations,
        notes: r.notes,
        actif: true,
      };

      try {
        if (r.duplicate) {
          const { error } = await supabase
            .from('transporteurs' as any)
            .update(payload).eq('reference', r.reference);
          if (error) throw error;
          updated += 1;
        } else {
          const { error } = await supabase
            .from('transporteurs' as any)
            .insert({ ...payload, konnekt_registered: false });
          if (error) throw error;
          imported += 1;
        }
      } catch (e) {
        errors += 1;
      }
      setProgress({ current: i + 1, total: importable.length });
    }

    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from('gp_import_logs' as any).insert({
        filename,
        total_rows: rows.length,
        imported, updated, errors,
        imported_by: u?.user?.id ?? null,
      });
    } catch {}

    setResult({ imported, updated, errors });
    setStep('done');
    onAfterImport();
  };

  const downloadTemplate = () => {
    const data: any[][] = [
      ['Base GP — Template Yobbanté'],
      ['Remplir à partir de la ligne 7. Ne pas modifier les en-têtes.'],
      [],
      ['Référence', 'Prénom', 'Nom', 'Téléphone 1', 'Téléphone 2', 'WhatsApp', 'Adresse 1', 'Adresse 2', 'Ville', 'Zone', 'Modes (séparés par ,)', 'Destinations (séparés par ,)', 'Notes'],
      ['2241', 'Mamadou', 'Diop', '+221771234567', '', '+221771234567', 'Sicap Liberté 6', '', 'Dakar', 'Liberté', 'air,road', 'Paris,Marseille', 'Exemple — à supprimer'],
      ['1892', 'Awa', 'Sow', '+221761111111', '', '', 'Mermoz', '', 'Dakar', 'Mermoz', 'air', 'Paris', 'Exemple'],
      ['3310', 'Cheikh', 'Ndiaye', '+221701222333', '', '', 'Yoff', '', 'Dakar', 'Yoff', 'sea_lcl', 'Marseille', 'Exemple'],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Base GP');
    XLSX.writeFile(wb, 'yobbante-base-gp-template.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-bold text-white">
            {step === 'done' ? 'Import terminé' : 'Importer votre base GP'}
          </DialogTitle>
          {step === 'upload' && (
            <DialogDescription>
              Fichier Excel (.xlsx) au format template Yobbanté.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) parseFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer text-center transition-colors"
              style={{
                background: '#161616',
                border: `2px dashed ${dragOver ? '#F5C518' : filename ? '#22C55E' : '#2A2A2A'}`,
                borderRadius: 14, padding: 40,
              }}
            >
              <FileSpreadsheet className="mx-auto mb-3" size={32} color={filename ? '#22C55E' : '#AAAAAA'} />
              {!filename ? (
                <>
                  <p className="text-[14px]" style={{ color: '#AAAAAA' }}>Glissez votre fichier Excel ici</p>
                  <p className="text-[12px] mt-1 font-mono" style={{ color: '#555555' }}>ou cliquez pour sélectionner</p>
                </>
              ) : (
                <>
                  <p className="text-[14px] text-white">{filename}</p>
                  <p className="text-[12px] mt-1 font-mono" style={{ color: '#AAAAAA' }}>{(filesize / 1024).toFixed(1)} KB</p>
                </>
              )}
              <input
                ref={fileRef} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
              />
            </div>
            <button
              onClick={downloadTemplate}
              className="text-[11px] inline-flex items-center gap-1 hover:underline"
              style={{ color: '#F5C518' }}
            >
              <Download className="w-3 h-3" /> Télécharger le template vide →
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                ✅ {counts.valid} ligne{counts.valid > 1 ? 's' : ''} valide{counts.valid > 1 ? 's' : ''}
              </span>
              <span className="px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                ⚠️ {counts.warning} avertissement{counts.warning > 1 ? 's' : ''}
              </span>
              <span className="px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                ❌ {counts.error} erreur{counts.error > 1 ? 's' : ''}
              </span>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[28px_60px_1fr_110px_90px_70px] gap-2 px-3 py-2 bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div></div><div>Réf</div><div>Nom</div><div>Téléphone</div><div>Ville</div><div>Statut</div>
              </div>
              {rows.slice(0, 10).map((r) => (
                <div key={r.excelRow} className="grid grid-cols-[28px_60px_1fr_110px_90px_70px] gap-2 px-3 py-2 border-t border-border text-[12px] items-center">
                  <div>{r.status === 'valid' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'}</div>
                  <div className="font-mono">{r.reference || '—'}</div>
                  <div className="truncate">{r.prenom} {r.nom}</div>
                  <div className="text-muted-foreground truncate">{r.telephone_1}</div>
                  <div className="truncate">{r.ville}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.duplicate ? 'doublon' : r.status}
                  </div>
                </div>
              ))}
              {rows.length > 10 && (
                <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground text-center">
                  + {rows.length - 10} autres lignes
                </div>
              )}
            </div>

            {(counts.error > 0 || counts.warning > 0) && (
              <Accordion type="single" collapsible className="border border-border rounded-lg px-3">
                <AccordionItem value="errors" className="border-b-0">
                  <AccordionTrigger className="text-[12px]">Détails des problèmes ({counts.error + counts.warning})</AccordionTrigger>
                  <AccordionContent className="space-y-1">
                    {rows.filter(r => r.errors.length || r.warnings.length).map(r => (
                      <div key={r.excelRow} className="font-mono text-[12px]">
                        {r.errors.map((e, i) => (
                          <div key={`e${i}`} style={{ color: '#EF4444' }}>Ligne {r.excelRow} — {e}</div>
                        ))}
                        {r.warnings.map((w, i) => (
                          <div key={`w${i}`} style={{ color: '#F59E0B' }}>Ligne {r.excelRow} — {w}</div>
                        ))}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <div className="space-y-2">
              <p className="text-[12px] text-muted-foreground">Pour les références déjà en base :</p>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="radio" checked={duplicateMode === 'skip'} onChange={() => setDuplicateMode('skip')} />
                Ignorer (ne pas écraser)
              </label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="radio" checked={duplicateMode === 'update'} onChange={() => setDuplicateMode('update')} />
                Mettre à jour (écraser avec nouvelles infos)
              </label>
            </div>
          </div>
        )}

        {step === 'progress' && (
          <div className="space-y-3 py-6">
            <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} className="[&>div]:bg-[#F5C518]" />
            <p className="text-[12px] font-mono text-muted-foreground text-center">
              Import en cours… {progress.current}/{progress.total}
            </p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: '#22C55E' }} />
              <p className="text-[14px] font-semibold">Import terminé</p>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {result.imported} GP importés · {result.updated} mis à jour · {result.errors} erreurs
            </p>
            <div className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-[13px]">Souhaitez-vous envoyer les invitations Konnekt bêta maintenant ?</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => { handleClose(false); onTriggerBlast(); }}
                  className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
                >
                  <Send className="w-4 h-4 mr-2" /> Envoyer les invitations WhatsApp
                </Button>
                <Button variant="outline" onClick={() => handleClose(false)}>Plus tard</Button>
              </div>
            </div>
          </div>
        )}

        {(step === 'upload' || step === 'preview') && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Annuler</Button>
            {step === 'preview' && (
              <Button
                onClick={confirmImport}
                disabled={importable.length === 0}
                className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
              >
                Confirmer l'import — {importable.length} GP →
              </Button>
            )}
          </DialogFooter>
        )}

        {step === 'progress' && (
          <DialogFooter>
            <Button disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours…</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

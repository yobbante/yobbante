import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useLegacyDossiers } from '@/hooks/useLegacyDossiers';
import { INTAKE_SOURCES } from '@/lib/intakeSources';

type Row = Record<string, any>;
type Mapping = {
  client_name: string; client_phone: string; client_email: string;
  type: string; origin: string; destination: string;
  weight_kg: string; amount: string; currency: string;
  date: string; status_legacy: string; description: string;
  notes: string; legacy_id: string; source: string;
};

const FIELDS: { key: keyof Mapping; label: string; required?: boolean }[] = [
  { key: 'client_name',  label: 'Nom du client', required: true },
  { key: 'client_phone', label: 'Téléphone' },
  { key: 'client_email', label: 'Email' },
  { key: 'type',         label: 'Type / Service' },
  { key: 'origin',       label: 'Origine' },
  { key: 'destination',  label: 'Destination' },
  { key: 'weight_kg',    label: 'Poids (kg)' },
  { key: 'amount',       label: 'Montant' },
  { key: 'currency',     label: 'Devise' },
  { key: 'date',         label: 'Date' },
  { key: 'status_legacy',label: 'Statut' },
  { key: 'description',  label: 'Description' },
  { key: 'notes',        label: 'Notes' },
  { key: 'legacy_id',    label: 'Ancien ID / Référence' },
  { key: 'source',       label: 'Canal d\'origine' },
];

const EMPTY_MAPPING: Mapping = {
  client_name: '', client_phone: '', client_email: '', type: '', origin: '', destination: '',
  weight_kg: '', amount: '', currency: '', date: '', status_legacy: '',
  description: '', notes: '', legacy_id: '', source: '',
};

function autoMap(headers: string[]): Mapping {
  const m = { ...EMPTY_MAPPING };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const guess: Record<keyof Mapping, string[]> = {
    client_name: ['client', 'nom', 'name', 'clientname'],
    client_phone: ['phone', 'tel', 'telephone', 'whatsapp', 'mobile'],
    client_email: ['email', 'mail'],
    type: ['type', 'service', 'category'],
    origin: ['origin', 'origine', 'from', 'depart'],
    destination: ['destination', 'to', 'dest', 'arrivee'],
    weight_kg: ['weight', 'poids', 'kg'],
    amount: ['amount', 'montant', 'prix', 'price', 'total'],
    currency: ['currency', 'devise'],
    date: ['date', 'created', 'createdat'],
    status_legacy: ['status', 'statut', 'state', 'etat'],
    description: ['description', 'desc', 'product', 'produit'],
    notes: ['notes', 'note', 'comment', 'remarques'],
    legacy_id: ['id', 'reference', 'ref', 'numero', 'no'],
    source: ['source', 'canal', 'channel'],
  };
  for (const h of headers) {
    const n = norm(h);
    for (const [field, keys] of Object.entries(guess)) {
      if (m[field as keyof Mapping]) continue;
      if (keys.some(k => n.includes(k))) { m[field as keyof Mapping] = h; break; }
    }
  }
  return m;
}

function normalizeSource(raw: string | undefined): string {
  if (!raw) return 'autre';
  const n = raw.toLowerCase();
  const ids = INTAKE_SOURCES.map(s => s.id);
  for (const id of ids) if (n.includes(id.replace('_', ''))) return id;
  if (n.includes('appel') || n.includes('call')) return 'telephone';
  if (n.includes('whats')) return 'whatsapp';
  if (n.includes('insta')) return 'instagram';
  if (n.includes('fb') || n.includes('facebook')) return 'facebook';
  if (n.includes('mail')) return 'email';
  if (n.includes('site') || n.includes('web')) return 'site_web';
  return 'autre';
}

export default function InboxImportPage() {
  const navigate = useNavigate();
  const { bulkInsert } = useLegacyDossiers();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
      if (json.length === 0) { toast.error('Fichier vide'); return; }
      const hdrs = Object.keys(json[0]);
      setFileName(file.name);
      setHeaders(hdrs);
      setRows(json);
      setMapping(autoMap(hdrs));
    } catch (e: any) {
      toast.error(`Erreur lecture: ${e.message}`);
    }
  }, []);

  const preview = rows.slice(0, 5);

  const { valid, invalid } = useMemo(() => {
    if (!mapping.client_name) return { valid: [] as Row[], invalid: rows };
    const v: Row[] = []; const inv: Row[] = [];
    for (const r of rows) {
      const name = r[mapping.client_name];
      if (name && String(name).trim()) v.push(r); else inv.push(r);
    }
    return { valid: v, invalid: inv };
  }, [rows, mapping]);

  const handleImport = async () => {
    if (!mapping.client_name) { toast.error('Mapping "Nom du client" requis'); return; }
    setImporting(true);
    try {
      const payload = valid.map(r => {
        const pick = (k: keyof Mapping) => mapping[k] ? r[mapping[k]] : null;
        const num = (k: keyof Mapping) => {
          const v = pick(k); if (v == null || v === '') return null;
          const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
          return isNaN(n) ? null : n;
        };
        const dateVal = pick('date');
        let created_at: string | null = null;
        if (dateVal) {
          const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
          if (!isNaN(d.getTime())) created_at = d.toISOString();
        }
        return {
          legacy_id: pick('legacy_id') ? String(pick('legacy_id')) : null,
          client_name: pick('client_name') ? String(pick('client_name')).trim() : null,
          client_phone: pick('client_phone') ? String(pick('client_phone')).trim() : null,
          client_email: pick('client_email') ? String(pick('client_email')).trim() : null,
          type: pick('type') ? String(pick('type')) : null,
          origin: pick('origin') ? String(pick('origin')) : null,
          destination: pick('destination') ? String(pick('destination')) : null,
          weight_kg: num('weight_kg'),
          amount: num('amount'),
          currency: pick('currency') ? String(pick('currency')).toUpperCase() : 'XOF',
          status_legacy: pick('status_legacy') ? String(pick('status_legacy')) : null,
          description: pick('description') ? String(pick('description')) : null,
          notes: pick('notes') ? String(pick('notes')) : null,
          source: normalizeSource(pick('source')),
          created_at,
        };
      });
      const n = await bulkInsert.mutateAsync(payload as any);
      toast.success(`${n} dossiers historiques importés`);
      navigate('/admin/inbox?tab=history');
    } catch (e: any) {
      toast.error(e.message || 'Erreur import');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/admin/inbox" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour à l'Inbox
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-semibold">📚 Import historique Excel</h1>
          <p className="text-sm text-muted-foreground">
            Importez votre fichier .xlsx ou .csv contenant les commandes historiques.
          </p>
        </div>

        {!fileName ? (
          <Card className="p-10 border-dashed border-2 text-center">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Glissez votre fichier Excel ici</p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls ou .csv</p>
            <label className="inline-block mt-4">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:opacity-90">
                <Upload className="w-4 h-4" /> Choisir un fichier
              </span>
            </label>
          </Card>
        ) : (
          <>
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{fileName}</div>
                  <div className="text-xs text-muted-foreground">{rows.length} lignes · {headers.length} colonnes</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setFileName(null); setRows([]); setHeaders([]); setMapping(EMPTY_MAPPING); }}>
                Changer
              </Button>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-semibold text-sm">Aperçu (5 premières lignes)</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>{headers.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {headers.map(h => (
                          <TableCell key={h} className="text-xs max-w-[160px] truncate">
                            {r[h] == null ? '—' : String(r[h])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-semibold text-sm">Mapping des colonnes</h2>
              <p className="text-xs text-muted-foreground">Associez chaque champ Yobbanté à une colonne de votre Excel.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FIELDS.map(f => (
                  <div key={f.key}>
                    <Label className="text-xs">
                      {f.label}{f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <select
                      className="flex h-9 w-full rounded border px-2 text-sm bg-background"
                      value={mapping[f.key]}
                      onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}
                    >
                      <option value="">— Ignorer —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> <strong>{valid.length}</strong> lignes valides
                </span>
                <span className="inline-flex items-center gap-1.5 text-orange-500">
                  <AlertCircle className="w-4 h-4" /> <strong>{invalid.length}</strong> ignorées (sans nom)
                </span>
              </div>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/admin/inbox')}>Annuler</Button>
              <Button onClick={handleImport} disabled={importing || valid.length === 0}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Importer {valid.length} dossier{valid.length > 1 ? 's' : ''} dans l'historique
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

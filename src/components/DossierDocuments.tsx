import { useRef, useState } from 'react';
import { FileText, Upload, Trash2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDossierDocuments, DOC_KIND_LABELS, type DocKind } from '@/hooks/useDossierDocuments';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  dossierId: string;
  canUpload: boolean;
  canDelete: boolean;
}

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

export function DossierDocuments({ dossierId, canUpload, canDelete }: Props) {
  const { documents, isLoading, upload, remove, getDownloadUrl } = useDossierDocuments(dossierId);
  const [kind, setKind] = useState<DocKind>('invoice');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error('Fichier trop volumineux (max 15 Mo)');
      return;
    }
    try {
      await upload.mutateAsync({ file, kind });
      toast.success('Document ajouté');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'upload');
    }
  };

  const handleDownload = async (path: string, name: string) => {
    try {
      const url = await getDownloadUrl(path);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      a.click();
    } catch {
      toast.error('Impossible de télécharger');
    }
  };

  const handleDelete = async (doc: typeof documents[number]) => {
    if (!confirm(`Supprimer ${doc.file_name} ?`)) return;
    try {
      await remove.mutateAsync(doc);
      toast.success('Document supprimé');
    } catch {
      toast.error('Suppression impossible');
    }
  };

  return (
    <div className="space-y-3">
      {canUpload && (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as DocKind)}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(DOC_KIND_LABELS) as DocKind[]).map(k => (
                <SelectItem key={k} value={k}>{DOC_KIND_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="flex-1"
          >
            {upload.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Téléverser
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <FileText className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Aucun document pour le moment</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canUpload ? 'Téléversez factures, BL ou déclarations douanières.' : 'L\'équipe Yobbanté les ajoutera dès le dédouanement.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map(d => (
            <li key={d.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', 'bg-secondary text-foreground')}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{d.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {DOC_KIND_LABELS[d.kind as DocKind] || d.kind} · {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} ko` : ''} · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleDownload(d.file_path, d.file_name)}>
                <Download className="w-4 h-4" />
              </Button>
              {canDelete && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(d)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

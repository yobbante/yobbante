import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCw, Upload, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLegacyDossiers } from '@/hooks/useLegacyDossiers';
import { toast } from 'sonner';

export function HistoryColumn() {
  const { data = [], isLoading, reactivate } = useLegacyDossiers();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handle = (id: string) => {
    setBusyId(id);
    const legacy = data.find(d => d.id === id)!;
    reactivate.mutate(legacy, {
      onSuccess: r => toast.success(`Dossier ${r.reference} créé`),
      onError: e => toast.error((e as Error).message),
      onSettled: () => setBusyId(null),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Archive className="w-4 h-4" /> Historique (Excel importé)
          </h2>
          <p className="text-xs text-muted-foreground">{data.length} dossiers archivés</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/inbox/import"><Upload className="w-3.5 h-3.5 mr-1" /> Importer Excel</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucun dossier historique. Importez votre fichier Excel pour démarrer.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.map(d => (
            <Card key={d.id} className="p-3 text-xs space-y-1">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {d.client_name || 'Sans nom'} {d.legacy_id ? `· ${d.legacy_id}` : ''}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {[d.type, d.origin && `${d.origin} → ${d.destination || '?'}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {d.promoted_to_dossier_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">Réactivé</span>
                )}
              </div>
              {(d.weight_kg || d.amount) && (
                <div className="text-muted-foreground">
                  {d.weight_kg ? `${d.weight_kg} kg` : ''}
                  {d.amount ? ` · ${Math.round(d.amount)} ${d.currency || 'XOF'}` : ''}
                </div>
              )}
              {d.status_legacy && <div className="text-[10px] uppercase text-muted-foreground">{d.status_legacy}</div>}
              {!d.promoted_to_dossier_id && (
                <Button
                  size="sm" variant="outline" className="w-full h-7 text-[11px] mt-1"
                  disabled={busyId === d.id}
                  onClick={() => handle(d.id)}
                >
                  {busyId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3 mr-1" />}
                  Réactiver ce dossier
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

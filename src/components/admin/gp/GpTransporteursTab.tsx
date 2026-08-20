import { useMemo, useState } from 'react';
import { Plus, Search, Phone, MessageCircle, Plane } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransporteurs, type Transporteur } from '@/hooks/useTransporteurs';
import { useGpDepartures, useGpColis } from '@/hooks/useGpTerrain';
import { GpTransporteurSheet, type GpFiche } from './GpTransporteurSheet';
import { cn } from '@/lib/utils';

/** Répertoire des transporteurs GP — recherche, création et ouverture de fiche. */
export function GpTransporteursTab() {
  const { list } = useTransporteurs();
  const { data: departures = [] } = useGpDepartures();
  const { data: colis = [] } = useGpColis();
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<{ open: boolean; gp: GpFiche | null }>({ open: false, gp: null });

  const counts = useMemo(() => {
    const trajets = new Map<string, number>();
    departures.forEach(d => {
      if (d.transporteur_ref) trajets.set(d.transporteur_ref, (trajets.get(d.transporteur_ref) ?? 0) + 1);
    });
    const parcels = new Map<string, number>();
    colis.forEach(c => {
      const r = c.assigned_transporteur_ref;
      if (r) parcels.set(r, (parcels.get(r) ?? 0) + 1);
    });
    return { trajets, parcels };
  }, [departures, colis]);

  const rows = useMemo(() => {
    const items = (list.data ?? []) as Transporteur[];
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(t =>
      [t.nom, t.prenom, t.reference, t.telephone_1, t.telephone_2, t.ville, t.zone]
        .filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [list.data, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Rechercher un GP (nom, réf, téléphone, ville)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => setSheet({ open: true, gp: null })} aria-label="Nouveau transporteur GP">
          <Plus className="w-4 h-4 md:mr-1" />
          <span className="hidden md:inline">Nouveau GP</span>
        </Button>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Aucun transporteur trouvé.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((t) => {
            const tel = (t.telephone_1 ?? '').replace(/\D/g, '');
            return (
              <button
                key={t.id}
                onClick={() => setSheet({ open: true, gp: t as GpFiche })}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {t.nom ?? '—'} {t.prenom ?? ''}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.telephone_1 ?? '—'}{t.ville ? ` · ${t.ville}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="font-mono text-[10px]">#{t.reference}</Badge>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', t.actif
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground')}
                    >
                      {t.actif ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Plane className="w-3 h-3" /> {counts.trajets.get(t.reference) ?? 0} trajets
                  </span>
                  <span>{counts.parcels.get(t.reference) ?? 0} colis</span>
                  {tel && (
                    <span className="ml-auto flex items-center gap-1">
                      <a
                        href={`tel:${t.telephone_1}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md hover:bg-muted"
                        aria-label="Appeler"
                      ><Phone className="w-3.5 h-3.5" /></a>
                      <a
                        href={`https://wa.me/${tel}`}
                        target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md hover:bg-muted"
                        aria-label="WhatsApp"
                      ><MessageCircle className="w-3.5 h-3.5" /></a>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <GpTransporteurSheet
        gp={sheet.gp}
        open={sheet.open}
        onOpenChange={(v) => setSheet((s) => ({ ...s, open: v }))}
      />
    </div>
  );
}

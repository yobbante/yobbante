import { Package } from 'lucide-react';
import { useDossierChildren } from '@/hooks/useDossierSplit';
import { MiniTimeline } from './MiniTimeline';
import { formatStatusLabel } from '@/lib/statusLabels';

/** Vue client d'un envoi réparti en plusieurs colis. */
export function SplitColisList({ dossierId }: { dossierId: string }) {
  const { data: children = [] } = useDossierChildren(dossierId);
  if (children.length === 0) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-1">
        Votre envoi a été réparti en {children.length} colis
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        Chaque colis voyage séparément et avance à son propre rythme.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {children.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  Colis {c.split_index}/{c.split_count ?? children.length}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.product_description ?? '—'}
                  {c.actual_weight_kg ?? c.estimated_weight
                    ? ` · ${Number(c.actual_weight_kg ?? c.estimated_weight)} kg`
                    : ''}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {formatStatusLabel(c.status)}
              </span>
            </div>
            {c.tracking_id && (
              <a
                href={`/suivre/${c.tracking_id}`}
                className="mt-1 inline-block text-[11px] font-mono text-primary hover:underline"
              >
                {c.tracking_id}
              </a>
            )}
            <div className="mt-3">
              <MiniTimeline status={c.status as any} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

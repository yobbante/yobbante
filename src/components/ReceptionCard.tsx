import { motion } from 'framer-motion';
import {
  ArrowRight, Package, Inbox, ChevronRight, MapPin, Calendar,
} from 'lucide-react';
import {
  type Dossier, COUNTRY_FLAGS, DOSSIER_STATUS_LABELS,
} from '@/lib/types';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

/** Parse the structured-ish notes the ReceiveFlow stores on the dossier. */
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

interface ReceptionCardProps {
  dossier: Dossier;
  onClick: () => void;
}

export function ReceptionCard({ dossier, onClick }: ReceptionCardProps) {
  const parsed = parseReceptionNotes(dossier.notes);
  const itemCount = parsed.items.length || (parsed.count ? Number(parsed.count) : 1);
  const flag = COUNTRY_FLAGS[dossier.origin_country] || '🌍';
  const destFlag = dossier.destination_country === 'SN' ? '🇸🇳' : '🌍';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group w-full text-left bg-card rounded-2xl p-4 sm:p-5 border border-border hover:border-foreground/20 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Top row: ref + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            {dossier.reference}
          </p>
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">
              {itemCount > 1 ? `${itemCount} commandes groupées` : (parsed.items[0] || dossier.product_description.replace(/^Réception:\s*/, '') || 'Commande')}
            </h3>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md whitespace-nowrap">
          {DOSSIER_STATUS_LABELS[dossier.status]}
        </span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-1.5 text-sm mb-3">
        <span className="text-base">{flag}</span>
        <span className="font-medium text-foreground">Hub {parsed.hub ?? dossier.origin_country}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-base">{destFlag}</span>
        <span className="font-medium text-foreground truncate">
          {parsed.destination ?? (dossier.destination_country === 'SN' ? 'Sénégal' : dossier.destination_country)}
        </span>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
          <Package className="w-3.5 h-3.5" />
          {itemCount} {itemCount > 1 ? 'colis' : 'colis'}
        </span>
        {(parsed.weight || dossier.estimated_weight) && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
            ≈ {parsed.weight ?? dossier.estimated_weight} kg
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(dossier.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* Bottom row: value + CTA */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
        <div>
          {parsed.value || dossier.budget_eur ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valeur achats</p>
              <p className="text-base font-bold text-foreground">
                {fmtEur(Number(parsed.value?.replace(',', '.') ?? dossier.budget_eur ?? 0))}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Valeur non précisée</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
          Voir détails <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.button>
  );
}

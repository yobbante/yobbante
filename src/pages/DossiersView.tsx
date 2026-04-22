import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, FolderPlus } from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { DossierCard } from '@/components/DossierCard';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DOSSIER_STATUS_LABELS, type DossierStatus } from '@/lib/types';

type Filter = 'all' | 'active' | 'transit' | 'delivered' | 'closed';

export function DossiersView() {
  const navigate = useNavigate();
  const { dossiers, isLoading } = useDossiers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const active = dossiers.filter(d => ['SUBMITTED', 'IN_REVIEW', 'SOURCING', 'PROCURED'].includes(d.status)).length;
    const transit = dossiers.filter(d => ['IN_TRANSIT', 'CUSTOMS'].includes(d.status)).length;
    const delivered = dossiers.filter(d => d.status === 'DELIVERED').length;
    const closed = dossiers.filter(d => d.status === 'CLOSED').length;
    return { all: dossiers.length, active, transit, delivered, closed };
  }, [dossiers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter(d => {
      if (filter === 'active' && !['SUBMITTED', 'IN_REVIEW', 'SOURCING', 'PROCURED'].includes(d.status)) return false;
      if (filter === 'transit' && !['IN_TRANSIT', 'CUSTOMS'].includes(d.status)) return false;
      if (filter === 'delivered' && d.status !== 'DELIVERED') return false;
      if (filter === 'closed' && d.status !== 'CLOSED') return false;
      if (!q) return true;
      return (
        d.reference.toLowerCase().includes(q) ||
        d.product_description.toLowerCase().includes(q) ||
        DOSSIER_STATUS_LABELS[d.status as DossierStatus].toLowerCase().includes(q)
      );
    });
  }, [dossiers, filter, query]);

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-12">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-3"
      >
        <div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Sourcing & achats</p>
          <h2 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground">
            Vos dossiers
          </h2>
        </div>
        <Button size="sm" onClick={() => navigate('/acheter')} className="gap-1 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </Button>
      </motion.header>

      <SearchFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Référence, produit, statut…"
        activeChip={filter}
        onChipChange={(v) => setFilter(v as Filter)}
        chips={[
          { value: 'all', label: 'Tous', count: counts.all },
          { value: 'active', label: 'En cours', count: counts.active },
          { value: 'transit', label: 'En transit', count: counts.transit },
          { value: 'delivered', label: 'Livrés', count: counts.delivered },
          { value: 'closed', label: 'Clôturés', count: counts.closed },
        ]}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : dossiers.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="Aucun dossier pour l'instant"
          description="Confiez-nous votre premier achat. Nous trouvons le meilleur fournisseur, achetons et livrons jusqu'à votre porte."
          ctaLabel="Confier un dossier"
          onCta={() => navigate('/acheter')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun dossier ne correspond"
          description="Essayez d'ajuster votre recherche ou de retirer un filtre actif."
          secondaryLabel="Effacer les filtres"
          onSecondary={() => { setQuery(''); setFilter('all'); }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(d => <DossierCard key={d.id} dossier={d} />)}
        </div>
      )}
    </div>
  );
}

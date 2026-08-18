import { LayoutDashboard, Package, Truck, MessageCircle, MoreHorizontal, Route as RouteIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminSection } from './AdminSidebar';

const ITEMS: { id: AdminSection; icon: typeof Package; label: string }[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Vue globale' },
  { id: 'dossiers', icon: Package,         label: 'Dossiers' },
  { id: 'departs',  icon: Truck,           label: 'Départs' },
  { id: 'messages', icon: MessageCircle,   label: 'Messages' },
];

const TERRAIN_ITEMS: { id: AdminSection; icon: typeof Package; label: string }[] = [
  { id: 'terrain',  icon: RouteIcon, label: 'Fret routier' },
  { id: 'dossiers', icon: Package,   label: 'Dossiers routiers' },
  { id: 'devis',    icon: FileText,  label: 'Devis' },
];

/**
 * Barre de navigation mobile — icônes seules.
 * Les sections secondaires restent accessibles via « Plus » (drawer sidebar).
 */
export function AdminMobileNav({
  active, onChange, onMore, unread = 0, isAgent = false, isTerrainAgent = false,
}: {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  onMore: () => void;
  unread?: number;
  isAgent?: boolean;
  isTerrainAgent?: boolean;
}) {
  const items = isTerrainAgent
    ? TERRAIN_ITEMS
    : isAgent
      ? ITEMS.filter(i => i.id === 'dossiers' || i.id === 'messages')
      : ITEMS;
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation admin"
    >
      <div className={cn('grid', isAgent ? 'grid-cols-3' : isTerrainAgent ? 'grid-cols-4' : 'grid-cols-5')}>
        {items.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center justify-center h-12 transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="w-[22px] h-[22px]" />
              {id === 'messages' && unread > 0 && (
                <span className="absolute top-1.5 right-[26%] min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 text-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-8 rounded-full" style={{ background: '#F5C518' }} />
              )}
            </button>
          );
        })}
        <button
          onClick={onMore}
          aria-label="Plus de sections"
          className="flex items-center justify-center h-12 text-muted-foreground"
        >
          <MoreHorizontal className="w-[22px] h-[22px]" />
        </button>
      </div>
    </nav>
  );
}

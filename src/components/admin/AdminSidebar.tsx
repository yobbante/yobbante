import { LayoutDashboard, Inbox, Package, Globe2, Truck, Plane, ShoppingCart, MapPin, Users, Settings, Workflow, PackageOpen, UserCog, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminSection =
  | 'overview'
  | 'requests'
  | 'shipments'
  | 'orders'
  | 'reception'
  | 'hubs'
  | 'transport'
  | 'departures'
  | 'transporteurs'
  | 'sourcing'
  | 'tracking'
  | 'clients'
  | 'enterprise'
  | 'settings';

export const ADMIN_NAV: { id: AdminSection; label: string; icon: typeof LayoutDashboard; live: boolean; adminOnly?: boolean }[] = [
  { id: 'overview',     label: 'Dashboard',         icon: LayoutDashboard, live: true },
  { id: 'requests',     label: 'Demandes clients',  icon: Inbox,           live: true },
  { id: 'shipments',    label: 'Workflow envois',   icon: Workflow,        live: true },
  { id: 'orders',       label: 'Commandes & Colis', icon: Package,         live: true },
  { id: 'reception',    label: 'Réception intl.',   icon: PackageOpen,     live: true },
  { id: 'hubs',         label: 'Hubs',              icon: Globe2,          live: true },
  { id: 'transport',    label: 'Transport',         icon: Truck,           live: true },
  { id: 'departures',   label: 'Départs manuels',   icon: Plane,           live: true },
  { id: 'transporteurs',label: 'Transporteurs',     icon: UserCog,         live: true, adminOnly: true },
  { id: 'sourcing',     label: 'Sourcing',          icon: ShoppingCart,    live: true },
  { id: 'tracking',     label: 'Tracking global',   icon: MapPin,          live: true },
  { id: 'clients',      label: 'Clients',           icon: Users,           live: true },
  { id: 'enterprise',   label: 'Devis entreprise',  icon: Building2,       live: true },
  { id: 'settings',     label: 'Paramètres',        icon: Settings,        live: true },
];

export function AdminSidebar({ active, onChange, isAdmin }: {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  isAdmin: boolean;
}) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {ADMIN_NAV.filter(n => !n.adminOnly || isAdmin).map(({ id, label, icon: Icon, live }) => {
        const disabled = id === 'settings' && !isAdmin;
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => !disabled && onChange(id)}
            disabled={disabled}
            className={cn(
              'group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-left transition-colors',
              isActive
                ? 'bg-foreground text-background font-semibold'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {!live && (
              <span className={cn(
                'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded',
                isActive ? 'bg-background/20 text-background' : 'bg-secondary text-muted-foreground'
              )}>
                Soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

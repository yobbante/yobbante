import { LayoutDashboard, Inbox, Package, Globe2, Truck, Plane, ShoppingCart, ShoppingBag, MapPin, Users, Settings, Workflow, PackageOpen, UserCog, Building2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminGlobalSearch } from './AdminGlobalSearch';

export type AdminSection =
  | 'overview'
  | 'inbox'
  | 'requests'
  | 'shipments'
  | 'orders'
  | 'reception'
  | 'hubs'
  | 'transport'
  | 'departures'
  | 'transporteurs'
  | 'sourcing'
  | 'boutique'
  | 'tracking'
  | 'clients'
  | 'enterprise'
  | 'settings';

type NavItem = { id: AdminSection; label: string; icon: typeof LayoutDashboard; live: boolean; adminOnly?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { id: 'inbox',    label: 'Inbox',   icon: MessageSquare,   live: true },
      { id: 'overview', label: 'Dashboard',  icon: LayoutDashboard, live: true },
    ],
  },
  {
    label: 'Demandes entrantes',
    items: [
      { id: 'requests',   label: 'Particuliers',     icon: Inbox,     live: true },
      { id: 'enterprise', label: 'Entreprises',      icon: Building2, live: true },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { id: 'shipments',  label: 'Workflow envois',  icon: Workflow,    live: true },
      { id: 'orders',     label: 'Commandes & colis',icon: Package,     live: true },
      { id: 'reception',  label: 'Réception intl.',  icon: PackageOpen, live: true },
      { id: 'tracking',   label: 'Tracking global',  icon: MapPin,      live: true },
      { id: 'sourcing',   label: 'Sourcing',         icon: ShoppingCart,live: true },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { id: 'boutique', label: 'Dëkk — Boutique', icon: ShoppingBag, live: true },
    ],
  },
  {
    label: 'Réseau transport',
    items: [
      { id: 'hubs',         label: 'Hubs',            icon: Globe2, live: true },
      { id: 'transport',    label: 'Konnekt',         icon: Truck,  live: true },
      { id: 'departures',   label: 'Départs manuels', icon: Plane,  live: true },
      { id: 'departs-semaine' as any, label: 'Départs de la semaine', icon: Plane, live: true },
      { id: 'transporteurs',label: 'Transporteurs',   icon: UserCog,live: true, adminOnly: true },
    ],
  },
  {
    label: 'CRM',
    items: [
      { id: 'clients', label: 'Clients', icon: Users, live: true },
    ],
  },
  {
    label: 'Système',
    items: [
      { id: 'settings', label: 'Paramètres', icon: Settings, live: true },
    ],
  },
];

// Flat list (kept for AdminPage validation of allowed sections)
export const ADMIN_NAV: NavItem[] = NAV_GROUPS.flatMap(g => g.items);

export function AdminSidebar({ active, onChange, isAdmin }: {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  isAdmin: boolean;
}) {
  return (
    <nav
      className="flex flex-col gap-1 p-2"
      style={{
        background: 'hsl(var(--background-primary))',
        borderRight: '0.5px solid hsl(var(--color-border-tertiary))',
        minWidth: 220,
      }}
    >
      <AdminGlobalSearch onJump={onChange} isAdmin={isAdmin} />
      {NAV_GROUPS.map((group, gi) => {
        const visibleItems = group.items.filter(n => !n.adminOnly || isAdmin);
        if (visibleItems.length === 0) return null;
        return (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && (
              <div
                className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'hsl(var(--text-tertiary, var(--muted-foreground)))' }}
              >
                {group.label}
              </div>
            )}
            {visibleItems.map(({ id, label, icon: Icon, live }) => {
              const disabled = id === 'settings' && !isAdmin;
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => !disabled && onChange(id)}
                  disabled={disabled}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors',
                    isActive ? 'font-medium' : '',
                    disabled && 'opacity-40 cursor-not-allowed',
                  )}
                  style={{
                    borderRadius: isActive ? 0 : 8,
                    borderLeft: isActive ? '2px solid #1D9E75' : '2px solid transparent',
                    background: isActive ? 'hsl(var(--secondary))' : 'transparent',
                    color: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                  }}
                  onMouseEnter={e => {
                    if (!isActive && !disabled) {
                      e.currentTarget.style.background = 'hsl(var(--secondary))';
                      e.currentTarget.style.color = 'hsl(var(--foreground))';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive && !disabled) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                    }
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {!live && (
                    <span
                      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--text-tertiary))' }}
                    >
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

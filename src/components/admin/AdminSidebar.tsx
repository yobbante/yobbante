import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Truck, UsersRound, Users, MessageCircle, ClipboardList,
  Wallet, CreditCard, ShoppingBag, Globe2, Settings, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AdminGlobalSearch } from './AdminGlobalSearch';


export type AdminSection =
  | 'overview'
  | 'dossiers'
  | 'departs'
  | 'terrain'
  | 'clients'
  | 'messages'
  | 'leads'
  | 'revenus'
  | 'finances'
  | 'boutique'
  | 'hubs'
  | 'settings';

type NavItem = { id: AdminSection; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { id: 'overview', label: 'Vue globale', icon: LayoutDashboard },
      { id: 'dossiers', label: 'Dossiers',    icon: Package },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { id: 'departs', label: 'Départs',         icon: Truck },
      { id: 'terrain', label: 'Équipe terrain',  icon: UsersRound, adminOnly: true },
    ],
  },
  {
    label: 'Contacts',
    items: [
      { id: 'clients',  label: 'Clients',        icon: Users },
      { id: 'messages', label: 'Messages',       icon: MessageCircle },
      { id: 'leads',    label: 'Leads & devis',  icon: ClipboardList },
    ],
  },
  {
    label: 'Finances',
    items: [
      { id: 'revenus',  label: 'Revenus',        icon: Wallet,      adminOnly: true },
      { id: 'finances', label: 'Paiements GP',   icon: CreditCard,  adminOnly: true },
    ],
  },
  {
    label: 'Système',
    items: [
      { id: 'boutique', label: 'Boutique Dëkk', icon: ShoppingBag },
      { id: 'hubs',     label: 'Hubs',          icon: Globe2 },
      { id: 'settings', label: 'Paramètres',    icon: Settings },
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
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadCount() {
      const { count } = await supabase
        .from('whatsapp_inbound_messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      if (mounted) setUnread(count ?? 0);
    }
    loadCount();
    const ch = supabase
      .channel(`sidebar-wa-unread-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_inbound_messages' }, () => loadCount())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  return (
    <nav
      className="flex flex-col gap-1 p-2"
      style={{
        background: 'hsl(var(--background-primary))',
        borderRight: '0.5px solid hsl(var(--color-border-tertiary))',
        minWidth: 220,
      }}
    >
      <AdminGlobalSearch onJump={onChange as any} isAdmin={isAdmin} />
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
            {visibleItems.map(({ id, label, icon: Icon }) => {
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
                    borderLeft: isActive ? '2px solid #F5C518' : '2px solid transparent',
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
                  {id === 'messages' && unread > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground min-w-[18px] text-center">
                      {unread > 99 ? '99+' : unread}
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

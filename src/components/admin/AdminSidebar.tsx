import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Truck, UsersRound, Users, MessageCircle, ClipboardList,
  Wallet, CreditCard, ShoppingBag, Globe2, Settings, BookOpen, Image as ImageIcon,
  Tag, MapPin, CalendarDays, Building2,
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
    ],
  },
  {
    label: 'Finances',
    items: [
      { id: 'finances', label: 'Finances',       icon: Wallet,      adminOnly: true },
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

// Sections cachées de la sidebar mais toujours accessibles via URL / deep-link.
const HIDDEN_SECTIONS: NavItem[] = [
  { id: 'leads', label: 'Leads & devis', icon: ClipboardList },
];

// Flat list (kept for AdminPage validation of allowed sections). Includes hidden sections.
export const ADMIN_NAV: NavItem[] = [...NAV_GROUPS.flatMap(g => g.items), ...HIDDEN_SECTIONS];

export function AdminSidebar({ active, onChange, isAdmin }: {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  isAdmin: boolean;
}) {
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isGuide = pathname.startsWith('/admin/guide');
  const isFlyers = pathname.startsWith('/admin/flyers');
  const isForfaits = pathname.startsWith('/admin/tarifs/forfaits');
  const isRelais = pathname.startsWith('/admin/relais');
  const isPartenaires = pathname.startsWith('/admin/parametres');
  const isDepartsSemaine = pathname.startsWith('/admin/departs-semaine');

  const shortcutStyle = (active: boolean) => ({
    borderRadius: active ? 0 : 8,
    borderLeft: active ? '2px solid #F5C518' : '2px solid transparent',
    background: active ? 'hsl(var(--secondary))' : 'transparent',
    color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    fontWeight: active ? 500 : undefined,
  });
  const hoverIn = (active: boolean) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!active) {
      e.currentTarget.style.background = 'hsl(var(--secondary))';
      e.currentTarget.style.color = 'hsl(var(--foreground))';
    }
  };
  const hoverOut = (active: boolean) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!active) {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
    }
  };


  useEffect(() => {
    let mounted = true;
    async function loadCount() {
      const { count } = await supabase
        .from('whatsapp_inbound_messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .not('from_phone', 'eq', '221784604003')
        .not('from_name', 'eq', 'ANB');
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

      <div className="mt-auto pt-3 flex flex-col gap-1">
        {isAdmin && (
          <>
            <div
              className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'hsl(var(--text-tertiary, var(--muted-foreground)))' }}
            >
              Outils admin
            </div>
            <button
              onClick={() => navigate('/admin/tarifs/forfaits')}
              aria-current={isForfaits ? 'page' : undefined}
              className="group flex w-full items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors"
              style={shortcutStyle(isForfaits)}
              onMouseEnter={hoverIn(isForfaits)}
              onMouseLeave={hoverOut(isForfaits)}
            >
              <Tag className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">Tarifs forfaitaires</span>
            </button>
            <button
              onClick={() => navigate('/admin/departs-semaine')}
              aria-current={isDepartsSemaine ? 'page' : undefined}
              className="group flex w-full items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors"
              style={shortcutStyle(isDepartsSemaine)}
              onMouseEnter={hoverIn(isDepartsSemaine)}
              onMouseLeave={hoverOut(isDepartsSemaine)}
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">Départs de la semaine</span>
            </button>
            <button
              onClick={() => navigate('/admin/relais')}
              aria-current={isRelais ? 'page' : undefined}
              className="group flex w-full items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors"
              style={shortcutStyle(isRelais)}
              onMouseEnter={hoverIn(isRelais)}
              onMouseLeave={hoverOut(isRelais)}
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">Relais Dakar</span>
            </button>
            <button
              onClick={() => navigate('/admin/parametres')}
              aria-current={isPartenaires ? 'page' : undefined}
              className="group flex w-full items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors"
              style={shortcutStyle(isPartenaires)}
              onMouseEnter={hoverIn(isPartenaires)}
              onMouseLeave={hoverOut(isPartenaires)}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">Partenaires destination</span>
            </button>
            <button
              onClick={() => navigate('/admin/flyers')}
              aria-current={isFlyers ? 'page' : undefined}
              className="group flex w-full items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors"
              style={shortcutStyle(isFlyers)}
              onMouseEnter={hoverIn(isFlyers)}
              onMouseLeave={hoverOut(isFlyers)}
            >
              <ImageIcon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">Flyers WhatsApp</span>
            </button>
          </>
        )}
        <button
          onClick={() => navigate('/admin/guide')}
          aria-current={isGuide ? 'page' : undefined}
          className="group flex w-full items-center gap-3 px-3 py-2 text-[13.5px] text-left transition-colors"
          style={{
            borderRadius: isGuide ? 0 : 8,
            borderLeft: isGuide ? '2px solid #F5C518' : '2px solid transparent',
            background: isGuide ? 'hsl(var(--secondary))' : 'transparent',
            color: isGuide ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            fontWeight: isGuide ? 500 : undefined,
          }}
          onMouseEnter={e => {
            if (!isGuide) {
              e.currentTarget.style.background = 'hsl(var(--secondary))';
              e.currentTarget.style.color = 'hsl(var(--foreground))';
            }
          }}
          onMouseLeave={e => {
            if (!isGuide) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
            }
          }}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: '#F5C518' }} />
          <span className="flex-1 truncate">Guide opérateur</span>
        </button>
      </div>
    </nav>
  );
}

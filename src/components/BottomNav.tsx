import { Home, Package, Clock, User } from 'lucide-react';

const tabs = [
  { id: 'home',       icon: Home,    label: 'Accueil' },
  { id: 'envois',     icon: Package, label: 'Mes colis' },
  { id: 'receptions', icon: Clock,   label: 'Historique' },
  { id: 'profile',    icon: User,    label: 'Profil' },
] as const;

// 'sourcing' is no longer in the bottom nav but the route/view still works.
export type TabId = typeof tabs[number]['id'] | 'sourcing';

export type TabId = typeof tabs[number]['id'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        height: 56,
        background: 'hsl(var(--background-primary))',
        borderTop: '0.5px solid hsl(var(--color-border-tertiary))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="h-full flex items-stretch">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className="flex-1 flex flex-col items-center justify-center gap-1 focus:outline-none"
              style={{ color: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--text-tertiary))' }}
            >
              <TabIcon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.7}
                fill={isActive ? 'currentColor' : 'none'}
              />
              <span style={{ fontSize: 10, fontWeight: isActive ? 500 : 400, lineHeight: 1 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

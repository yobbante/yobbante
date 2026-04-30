import { Home, Send, Inbox, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'home',       icon: Home,   label: 'Accueil' },
  { id: 'envois',     icon: Send,   label: 'Envois' },
  { id: 'receptions', icon: Inbox,  label: 'Réceptions' },
  { id: 'sourcing',   icon: Search, label: 'Sourcing' },
  { id: 'profile',    icon: User,   label: 'Profil' },
] as const;

export type TabId = typeof tabs[number]['id'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}
    >
      <div className="flex justify-around py-1 px-1">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-all min-h-[52px] flex-1 justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <TabIcon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.4 : 1.7} />
              <span className="text-[9.5px] font-semibold tracking-tight leading-none mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-b-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

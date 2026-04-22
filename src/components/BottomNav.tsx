import { Home, Truck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'shipments', icon: Truck, label: 'Envois' },
  { id: 'profile', icon: User, label: 'Profil' },
] as const;

export type TabId = typeof tabs[number]['id'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="flex justify-around py-1.5 px-4">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all min-h-[48px] justify-center',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <TabIcon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.6} />
              <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

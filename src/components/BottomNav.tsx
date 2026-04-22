import { Home, FolderOpen, Truck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'dossiers', icon: FolderOpen, label: 'Dossiers' },
  { id: 'shipments', icon: Truck, label: 'Envois' },
  { id: 'profile', icon: User, label: 'Profil' },
] as const;

export type TabId = typeof tabs[number]['id'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}
    >
      <div className="flex justify-around py-1 px-2">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl transition-all min-h-[52px] flex-1 justify-center',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <TabIcon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.4 : 1.7} />
              <span className="text-[10px] font-semibold tracking-tight leading-none mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

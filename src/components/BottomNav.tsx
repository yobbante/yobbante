import { Home, Truck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'shipments', icon: Truck, label: 'Shipments' },
  { id: 'profile', icon: User, label: 'Profile' },
] as const;

export type TabId = typeof tabs[number]['id'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 px-6 pb-safe md:hidden">
      <div className="flex justify-around py-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-lg transition-colors',
              active === tab.id ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

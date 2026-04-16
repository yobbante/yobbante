import { Home, Truck, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabId } from './BottomNav';

export function DesktopNav({ active, onChange, onSignOut }: { active: TabId; onChange: (tab: TabId) => void; onSignOut: () => void }) {
  const links = [
    { id: 'home' as TabId, icon: Home, label: 'Home' },
    { id: 'shipments' as TabId, icon: Truck, label: 'Shipments' },
    { id: 'profile' as TabId, icon: User, label: 'Profile' },
  ];

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <h1 className="text-xl font-bold tracking-tight text-gradient">YOBBANTÉ</h1>
      <nav className="flex items-center gap-1">
        {links.map(link => (
          <button
            key={link.id}
            onClick={() => onChange(link.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              active === link.id
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <link.icon className="w-4 h-4" />
            {link.label}
          </button>
        ))}
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-2"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </nav>
    </header>
  );
}

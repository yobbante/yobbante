import { Home, Truck, User, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import type { TabId } from './BottomNav';

export function DesktopNav({ active, onChange, onSignOut }: { active: TabId; onChange: (tab: TabId) => void; onSignOut: () => void }) {
  const navigate = useNavigate();
  const { isStaff } = useUserRole();
  const links = [
    { id: 'home' as TabId, icon: Home, label: 'Home' },
    { id: 'shipments' as TabId, icon: Truck, label: 'Shipments' },
    { id: 'profile' as TabId, icon: User, label: 'Profile' },
  ];

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-3 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <h1 className="text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</h1>
      <nav className="flex items-center gap-1">
        {links.map(link => {
          const LinkIcon = link.icon;
          return (
            <button
              key={link.id}
              onClick={() => onChange(link.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                active === link.id
                  ? 'text-primary bg-primary/8'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <LinkIcon className="w-4 h-4" />
              {link.label}
            </button>
          );
        })}
        {isStaff && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </button>
        )}
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors ml-2"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </nav>
    </header>
  );
}

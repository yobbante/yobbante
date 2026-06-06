import { Home, Send, Inbox, Search, User, LogOut, ShieldCheck, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import type { TabId } from './BottomNav';
import yobbanteLogoAsset from '@/assets/yobbante-logo-mark.png.asset.json';

export function DesktopNav({ active, onChange, onSignOut }: { active: TabId; onChange: (tab: TabId) => void; onSignOut: () => void }) {
  const navigate = useNavigate();
  const { isStaff } = useUserRole();
  const links = [
    { id: 'home' as TabId,       icon: Home,   label: 'Accueil' },
    { id: 'envois' as TabId,     icon: Send,   label: 'Envois' },
    { id: 'receptions' as TabId, icon: Inbox,  label: 'Réceptions' },
    { id: 'sourcing' as TabId,   icon: Search, label: 'Sourcing' },
    { id: 'profile' as TabId,    icon: User,   label: 'Profil' },
  ];

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-3 border-b border-border bg-background/85 backdrop-blur-xl sticky top-0 z-40">
      <button
        onClick={() => onChange('home')}
        aria-label="Yobbanté — accueil"
        className="inline-flex items-center hover:opacity-80 transition-opacity"
      >
        <img
          src={yobbanteLogoAsset.url}
          alt="Yobbanté"
          style={{ height: 36, width: 'auto', display: 'block', background: 'transparent' }}
        />
      </button>
      <nav className="flex items-center gap-1">
        {links.map(link => {
          const LinkIcon = link.icon;
          const isActive = active === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onChange(link.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              <LinkIcon className="w-4 h-4" strokeWidth={isActive ? 2.4 : 1.8} />
              {link.label}
            </button>
          );
        })}
        <button
          onClick={() => navigate('/business')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors ml-1"
        >
          <Briefcase className="w-4 h-4" />
          Business
        </button>
        {isStaff && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors ml-1"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </button>
        )}
        <button
          onClick={onSignOut}
          aria-label="Se déconnecter"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </nav>
    </header>
  );
}

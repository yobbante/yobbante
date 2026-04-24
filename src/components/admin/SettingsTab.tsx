import { UsersTab } from './UsersTab';
import { Settings as SettingsIcon } from 'lucide-react';

export function SettingsTab() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground">Gestion des rôles équipe et accès admin.</p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Rôles & équipe</p>
          <UsersTab />
        </div>
      </div>
    </div>
  );
}

import { UsersTab } from './UsersTab';
import { RelayAddressesPanel } from './RelayAddressesPanel';
import { WhatsAppTestPanel } from './WhatsAppTestPanel';
import { Settings as SettingsIcon } from 'lucide-react';

export function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground">Gestion des rôles équipe, adresses de relais et accès admin.</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Rôles & équipe</p>
        <UsersTab />
      </div>

      <RelayAddressesPanel />

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Notifications</p>
        <WhatsAppTestPanel />
      </div>
    </div>
  );
}


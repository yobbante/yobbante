import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { AddressCard } from '@/components/AddressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, User } from 'lucide-react';

export function ProfileView() {
  const { profile, isLoading: profileLoading } = useProfile();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName || profile.full_name })
      .eq('id', profile.id);
    if (error) toast.error(error.message);
    else toast.success('Profil mis à jour');
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (profileLoading) {
    return (
      <div className="space-y-6 pb-28 md:pb-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Profil</h2>

      {/* Account Section */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compte</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{profile?.full_name || 'Utilisateur'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div>
            <Label htmlFor="name" className="text-sm text-foreground">Nom complet</Label>
            <Input
              id="name"
              defaultValue={profile?.full_name || ''}
              onChange={e => setFullName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '...' : 'Enregistrer'}
          </Button>
        </div>
      </section>

      {/* Delivery Preferences */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Préférences de livraison</p>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground">
            Pays par défaut : <span className="text-foreground font-medium">{profile?.default_delivery_country || 'Non défini'}</span>
          </p>
        </div>
      </section>

      {/* Warehouse Addresses */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresses entrepôts</p>
        </div>
        <div className="p-5">
          {addressesLoading ? (
            <div className="grid gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune adresse disponible.</p>
          ) : (
            <div className="grid gap-3">
              {addresses.map(addr => <AddressCard key={addr.id} address={addr} />)}
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-5 py-4 text-sm text-destructive hover:bg-secondary/50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </section>
    </div>
  );
}

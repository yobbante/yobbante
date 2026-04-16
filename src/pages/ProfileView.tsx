import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProfile } from '@/hooks/useProfile';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { AddressCard } from '@/components/AddressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, Save } from 'lucide-react';

export function ProfileView() {
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { signOut, user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('');
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    await updateProfile.mutateAsync({
      full_name: fullName || undefined,
      default_delivery_country: deliveryCountry || undefined,
    });
    setEditing(false);
  };

  const startEditing = () => {
    setFullName(profile?.full_name || '');
    setDeliveryCountry(profile?.default_delivery_country || 'SN');
    setEditing(true);
  };

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
      </motion.div>

      {/* Profile info */}
      <section className="bg-card rounded-xl p-5 border border-border">
        {profileLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-1/4" />
          </div>
        ) : editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-11 rounded-xl bg-secondary border-0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Default Delivery Country</label>
              <Input value={deliveryCountry} onChange={e => setDeliveryCountry(e.target.value)} className="h-11 rounded-xl bg-secondary border-0" placeholder="SN" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" className="rounded-lg" disabled={updateProfile.isPending}>
                <Save className="w-3.5 h-3.5 mr-1" /> Save
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{profile?.full_name || 'No name set'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Delivery: {profile?.default_delivery_country || 'SN'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={startEditing} className="rounded-lg">
              Edit
            </Button>
          </div>
        )}
      </section>

      {/* Addresses */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Warehouse Addresses</h3>
        {addressesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {addresses.map(addr => <AddressCard key={addr.id} address={addr} />)}
          </div>
        )}
      </section>

      {/* Sign out */}
      <Button variant="outline" onClick={() => signOut()} className="rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive/40">
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}

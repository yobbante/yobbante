import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
import { LogOut, User, MapPin, Building2, ChevronRight, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProfileView() {
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setCountry(profile?.default_delivery_country || 'SN');
  }, [profile?.full_name, profile?.default_delivery_country]);

  const isDirty =
    (fullName || '') !== (profile?.full_name || '') ||
    (country || '') !== (profile?.default_delivery_country || '');

  const handleSave = async () => {
    if (!profile || !isDirty) return;
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName || profile.full_name,
        default_delivery_country: country || profile.default_delivery_country,
      });
      toast.success('Profil mis à jour');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const initials = (profile?.full_name || user?.email || '?')
    .split(/[\s@]/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (profileLoading) {
    return (
      <div className="space-y-5 pb-28 md:pb-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-8">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Compte</p>
        <h2 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground">Profil</h2>
      </motion.header>

      {/* Identity card */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center text-lg font-bold tracking-tight">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground truncate">{profile?.full_name || 'Utilisateur'}</p>
            <p className="text-[12px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="name" className="text-[12px] text-muted-foreground">Nom complet</Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Votre nom"
              className="mt-1.5 h-10"
            />
          </div>
          <div>
            <Label htmlFor="country" className="text-[12px] text-muted-foreground">Pays de livraison par défaut</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              placeholder="SN"
              maxLength={2}
              className="mt-1.5 h-10 font-mono uppercase"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </section>

      {/* Warehouse Addresses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight inline-flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" /> Vos entrepôts
          </h3>
          <span className="text-[11px] text-muted-foreground">{addresses.length}</span>
        </div>
        {addressesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune adresse disponible.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map(addr => <AddressCard key={addr.id} address={addr} />)}
          </div>
        )}
      </section>

      {/* Preferences placeholder — minimal list */}
      <section className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => navigate('/business')}
        >
          <Briefcase className="w-4 h-4 text-primary" />
          <span className="text-sm text-foreground flex-1">Yobbanté Business</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Pro</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => toast.info('Bientôt disponible')}
        >
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground flex-1">Adresse de livraison</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => toast.info('Bientôt disponible')}
        >
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground flex-1">Notifications</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </section>

      {/* Sign out */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </section>
    </div>
  );
}

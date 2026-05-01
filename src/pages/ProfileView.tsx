import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useProfile } from '@/hooks/useProfile';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { useShipments } from '@/hooks/useShipments';
import { useDossiers } from '@/hooks/useDossiers';
import { AddressCard } from '@/components/AddressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  LogOut, User, MapPin, Building2, ChevronRight, Briefcase,
  Mail, Phone, Copy, Check, Send, Inbox, Search, Sparkles,
  Bell, Globe2, ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COUNTRY_FLAGS, COUNTRY_NAMES } from '@/lib/types';

function CopyChip({ value, label, icon: Icon }: { value: string; label?: string; icon?: typeof Mail }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copié');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Impossible de copier');
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/60 hover:border-border transition-colors max-w-full"
    >
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <span className="text-[12px] font-medium text-foreground truncate">{label ?? value}</span>
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        : <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />}
    </button>
  );
}

export function ProfileView() {
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { user } = useAuth();
  const { shipments } = useShipments();
  const { dossiers } = useDossiers();
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

  // Stats: align with the 3 main app sections (Envois / Réceptions / Sourcing).
  const stats = useMemo(() => {
    const sendShipments = shipments.length;
    const recv = dossiers.filter(d => d.app_source === 'recevoir').length;
    const sourcing = dossiers.filter(d => d.app_source === 'sourcing' || d.needs_sourcing).length;
    return { sendShipments, recv, sourcing };
  }, [shipments, dossiers]);

  const memberSince = useMemo(() => {
    const created = profile?.created_at || user?.created_at;
    if (!created) return null;
    try {
      return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(created));
    } catch {
      return null;
    }
  }, [profile?.created_at, user?.created_at]);

  if (profileLoading) {
    return (
      <div className="space-y-5 pb-28 md:pb-8">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const flag = country ? COUNTRY_FLAGS[country as keyof typeof COUNTRY_FLAGS] : null;
  const countryName = country ? COUNTRY_NAMES[country as keyof typeof COUNTRY_NAMES] : null;

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-8">
      {/* ─── Hero / Identity card ────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-card"
      >
        {/* Gradient backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(120% 80% at 0% 0%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(120% 80% at 100% 0%, hsl(217 91% 60% / 0.10), transparent 55%)',
          }}
        />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-40"
          style={{ background: 'hsl(var(--primary) / 0.35)' }}
        />

        <div className="relative p-5 sm:p-6">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Compte</p>

          <div className="mt-3 flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-foreground text-background flex items-center justify-center text-xl font-bold tracking-tight shadow-lg">
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-card" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {profile?.full_name || 'Utilisateur Yobbanté'}
              </h2>
              {memberSince && (
                <p className="text-[12px] text-muted-foreground mt-0.5">Membre depuis {memberSince}</p>
              )}
            </div>
          </div>

          {/* Contact chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {user?.email && <CopyChip value={user.email} icon={Mail} />}
            {profile?.phone && <CopyChip value={profile.phone} icon={Phone} />}
            {flag && countryName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/60 text-[12px] font-medium text-foreground">
                <span className="text-base leading-none">{flag}</span>
                {countryName}
              </span>
            )}
          </div>

          {/* Stats rail */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => navigate('/app?view=envois')}
              className="group rounded-xl bg-background/40 hover:bg-background/70 border border-border/60 hover:border-border p-3 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                <Send className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Envois</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{stats.sendShipments}</p>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app?view=receptions')}
              className="group rounded-xl bg-background/40 hover:bg-background/70 border border-border/60 hover:border-border p-3 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                <Inbox className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Réceptions</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{stats.recv}</p>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app?view=sourcing')}
              className="group rounded-xl bg-background/40 hover:bg-background/70 border border-border/60 hover:border-border p-3 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                <Search className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Sourcing</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{stats.sourcing}</p>
            </button>
          </div>
        </div>
      </motion.section>

      {/* ─── Identité éditable ────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-card border border-border rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight inline-flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" /> Identité
          </h3>
          {isDirty && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-amber-400">
              <Sparkles className="w-3 h-3" /> Non enregistré
            </span>
          )}
        </div>

        <div className="space-y-4">
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
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="SN"
                maxLength={2}
                className="h-10 font-mono uppercase flex-1"
              />
              {flag && (
                <span className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md bg-secondary text-sm">
                  <span className="text-base">{flag}</span>
                  <span className="text-muted-foreground hidden sm:inline">{countryName}</span>
                </span>
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </Button>
        </div>
      </motion.section>

      {/* ─── Entrepôts ────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight inline-flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" /> Vos entrepôts internationaux
          </h3>
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-secondary text-[11px] font-semibold text-foreground">
            {addresses.length}
          </span>
        </div>
        {addressesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
            <Globe2 className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Aucune adresse disponible.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map(addr => <AddressCard key={addr.id} address={addr} />)}
          </div>
        )}
      </motion.section>

      {/* ─── Préférences / shortcuts ──────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden"
      >
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => navigate('/business')}
        >
          <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Briefcase className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Yobbanté Business</p>
            <p className="text-[11px] text-muted-foreground">Gérez votre compte entreprise</p>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Pro</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => toast.info('Bientôt disponible')}
        >
          <span className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Adresses de livraison</p>
            <p className="text-[11px] text-muted-foreground">Carnet d'adresses au Sénégal & ailleurs</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => toast.info('Bientôt disponible')}
        >
          <span className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">Email, WhatsApp, push</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
          onClick={() => toast.info('Bientôt disponible')}
        >
          <span className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Sécurité</p>
            <p className="text-[11px] text-muted-foreground">Mot de passe, sessions actives</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </motion.section>

      {/* ─── Sign out ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </motion.section>
    </div>
  );
}

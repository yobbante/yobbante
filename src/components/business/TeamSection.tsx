import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Loader2, Mail, Trash2, Crown, Shield, Eye, Clock, Check, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessMembers, type BusinessMemberRole } from '@/hooks/useBusinessMembers';
import { cn } from '@/lib/utils';

const ROLE_META: Record<BusinessMemberRole, { label: string; icon: any; tone: string; desc: string }> = {
  admin:    { label: 'Admin',     icon: Crown,  tone: 'bg-amber-500/15 text-amber-500 border-amber-500/30',     desc: 'Tout gérer' },
  operator: { label: 'Opérateur', icon: Shield, tone: 'bg-primary/15 text-primary border-primary/30',           desc: 'Créer & gérer dossiers' },
  viewer:   { label: 'Lecteur',   icon: Eye,    tone: 'bg-secondary text-muted-foreground border-border',       desc: 'Vue seule' },
};

interface Props {
  businessId: string;
  isAdmin: boolean;
}

export function TeamSection({ businessId, isAdmin }: Props) {
  const { members, invitations, loading, refresh } = useBusinessMembers(businessId);
  const pendingInvitations = invitations.filter(i => i.status === 'pending');

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Équipe</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les collaborateurs qui accèdent à cet espace business.
          </p>
        </div>
        {isAdmin && <InviteDialog businessId={businessId} onInvited={refresh} />}
      </div>

      {/* Membres */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Membres actifs ({members.length})
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Vous êtes seul·e pour l'instant. Invitez votre équipe.
          </Card>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                isAdmin={isAdmin}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invitations en attente */}
      {pendingInvitations.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Invitations en attente ({pendingInvitations.length})
          </div>
          <div className="space-y-2">
            {pendingInvitations.map(inv => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                isAdmin={isAdmin}
                onChanged={refresh}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, isAdmin, onChanged }: any) {
  const meta = ROLE_META[member.role as BusinessMemberRole];
  const Icon = meta.icon;
  const [updating, setUpdating] = useState(false);

  const updateRole = async (role: BusinessMemberRole) => {
    setUpdating(true);
    const { error } = await supabase.from('business_members').update({ role }).eq('id', member.id);
    setUpdating(false);
    if (error) toast.error('Mise à jour impossible.');
    else { toast.success('Rôle mis à jour.'); onChanged(); }
  };

  const remove = async () => {
    if (!confirm(`Retirer ${member.profile?.full_name ?? 'ce membre'} de l'entreprise ?`)) return;
    const { error } = await supabase.from('business_members').delete().eq('id', member.id);
    if (error) toast.error('Suppression impossible.');
    else { toast.success('Membre retiré.'); onChanged(); }
  };

  return (
    <Card className="p-4 flex items-center gap-4 flex-wrap">
      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0">
        {(member.profile?.full_name ?? member.profile?.email ?? '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{member.profile?.full_name ?? 'Membre'}</div>
        <div className="text-xs text-muted-foreground truncate">{member.profile?.email ?? '—'}</div>
      </div>
      {isAdmin ? (
        <Select value={member.role} onValueChange={updateRole} disabled={updating}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_META) as BusinessMemberRole[]).map(r => (
              <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="outline" className={cn('gap-1.5', meta.tone)}>
          <Icon className="w-3 h-3" /> {meta.label}
        </Badge>
      )}
      {isAdmin && (
        <Button size="icon" variant="ghost" onClick={remove} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </Card>
  );
}

function InvitationRow({ invitation, isAdmin, onChanged }: any) {
  const meta = ROLE_META[invitation.role as BusinessMemberRole];
  const expired = new Date(invitation.expires_at) < new Date();

  const copyLink = () => {
    const url = `${window.location.origin}/business/join?token=${invitation.token}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien d\'invitation copié.');
  };

  const revoke = async () => {
    const { error } = await supabase
      .from('business_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitation.id);
    if (error) toast.error('Annulation impossible.');
    else { toast.success('Invitation annulée.'); onChanged(); }
  };

  return (
    <Card className="p-4 flex items-center gap-4 flex-wrap border-dashed">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
        <Clock className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{invitation.email}</div>
        <div className="text-xs text-muted-foreground">
          {expired ? '⚠️ Expirée' : `Expire le ${new Date(invitation.expires_at).toLocaleDateString('fr-FR')}`}
        </div>
      </div>
      <Badge variant="outline" className={cn('gap-1', meta.tone)}>{meta.label}</Badge>
      {isAdmin && (
        <>
          <Button size="icon" variant="ghost" onClick={copyLink}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={revoke} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        </>
      )}
    </Card>
  );
}

function InviteDialog({ businessId, onInvited }: { businessId: string; onInvited: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BusinessMemberRole>('operator');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email invalide.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('business_invitations')
      .insert({
        business_id: businessId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: user.id,
      })
      .select('token')
      .single();
    setSubmitting(false);

    if (error) {
      console.error(error);
      toast.error('Invitation impossible.');
      return;
    }

    const url = `${window.location.origin}/business/join?token=${data.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success('Invitation créée — lien copié.', {
      description: 'Partagez-le par email ou WhatsApp.',
    });
    setEmail('');
    setRole('operator');
    setOpen(false);
    onInvited();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" /> Inviter un membre
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un collaborateur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collegue@entreprise.sn"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Rôle</Label>
            <div className="mt-1.5 space-y-2">
              {(Object.keys(ROLE_META) as BusinessMemberRole[]).map(r => {
                const meta = ROLE_META[r];
                const Icon = meta.icon;
                const selected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-[var(--radius)] border text-left transition-all',
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', meta.tone)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{meta.label}</div>
                      <div className="text-xs text-muted-foreground">{meta.desc}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Un lien d'invitation sera créé. Partagez-le à votre collaborateur — il pourra rejoindre l'entreprise après connexion.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={submit} disabled={submitting || !email}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Mail className="w-4 h-4 mr-2" /> Créer l'invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

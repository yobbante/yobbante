import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function BusinessJoinPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<'loading' | 'invalid' | 'expired' | 'ready' | 'joining' | 'done'>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [businessName, setBusinessName] = useState<string>('');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=/business/join?token=${token}`);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('business_invitations')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (!data) { setState('invalid'); return; }
      if (data.status !== 'pending') { setState('expired'); return; }
      if (new Date(data.expires_at) < new Date()) { setState('expired'); return; }
      setInvite(data);

      const { data: biz } = await supabase
        .from('business_accounts')
        .select('legal_name')
        .eq('id', data.business_id)
        .maybeSingle();
      setBusinessName(biz?.legal_name ?? 'l\'entreprise');
      setState('ready');
    })();
  }, [token, user, authLoading, navigate]);

  const accept = async () => {
    if (!user || !invite) return;
    setState('joining');
    const { error: e1 } = await supabase.from('business_members').insert({
      business_id: invite.business_id,
      user_id: user.id,
      role: invite.role,
      invited_by: invite.invited_by,
    });
    if (e1 && e1.code !== '23505') {
      toast.error('Impossible de rejoindre l\'entreprise.');
      setState('ready');
      return;
    }
    await supabase
      .from('business_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);
    setState('done');
    setTimeout(() => navigate('/business'), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-background">
      <Card className="max-w-md w-full p-8">
        {state === 'loading' && (
          <div className="text-center text-muted-foreground py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}
        {state === 'invalid' && (
          <div className="text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Lien invalide</h1>
            <p className="text-sm text-muted-foreground">Cette invitation n'existe pas.</p>
            <Button onClick={() => navigate('/app')}>Retour à l'app</Button>
          </div>
        )}
        {state === 'expired' && (
          <div className="text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold">Invitation expirée</h1>
            <p className="text-sm text-muted-foreground">Demandez à l'admin de vous renvoyer une nouvelle invitation.</p>
            <Button onClick={() => navigate('/app')}>Retour à l'app</Button>
          </div>
        )}
        {(state === 'ready' || state === 'joining') && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Rejoindre {businessName}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Vous avez été invité·e en tant que <strong className="text-foreground">{invite?.role}</strong>.
              </p>
            </div>
            <Button onClick={accept} disabled={state === 'joining'} className="w-full">
              {state === 'joining' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Accepter et rejoindre
            </Button>
          </div>
        )}
        {state === 'done' && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold">Bienvenue à bord</h1>
            <p className="text-sm text-muted-foreground">Redirection vers l'espace business…</p>
          </div>
        )}
      </Card>
    </div>
  );
}

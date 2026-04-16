import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, FileText, Package as PackageIcon, MessageCircle, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useDossierMessages } from '@/hooks/useDossierMessages';
import { useUserRole } from '@/hooks/useUserRole';
import {
  type Dossier,
  type Package,
  COUNTRY_FLAGS,
  COUNTRY_NAMES,
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_ORDER,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isStaff } = useUserRole();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth');
    });
  }, [navigate]);

  const { data: dossier, isLoading } = useQuery({
    queryKey: ['dossier', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as Dossier | null;
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['dossier-packages', id, dossier?.user_id],
    enabled: !!dossier,
    queryFn: async () => {
      const { data } = await supabase
        .from('packages')
        .select('*')
        .eq('user_id', dossier!.user_id)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as Package[];
    },
  });

  const { messages, sendMessage } = useDossierMessages(id);

  const handleSend = async () => {
    if (!draft.trim()) return;
    try {
      await sendMessage.mutateAsync({ body: draft.trim(), asStaff: isStaff, internal: false });
      setDraft('');
    } catch (e) {
      toast.error('Erreur lors de l\'envoi');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-base font-semibold text-foreground">Dossier introuvable</p>
          <p className="text-sm text-muted-foreground mt-1">Ce dossier n'existe pas ou ne vous appartient pas.</p>
          <Button onClick={() => navigate('/app')} variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  const stepIdx = DOSSIER_STATUS_ORDER.indexOf(dossier.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-bold text-foreground truncate">{dossier.reference}</p>
            <p className="text-xs text-muted-foreground">{DOSSIER_STATUS_LABELS[dossier.status]}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-8 pb-28">
        {/* Hero summary */}
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Produit</p>
          <p className="text-base font-semibold text-foreground mt-1">{dossier.product_description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
            <Stat label="Origine" value={`${COUNTRY_FLAGS[dossier.origin_country]} ${COUNTRY_NAMES[dossier.origin_country]}`} />
            <Stat label="Destination" value={dossier.destination_country} />
            <Stat label="Poids" value={dossier.estimated_weight ? `${dossier.estimated_weight} kg` : '—'} />
            <Stat label="Estimation" value={dossier.estimated_cost ? `${Math.round(dossier.estimated_cost)} €` : '—'} />
          </div>
        </motion.section>

        {/* Timeline status */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">Étapes du dossier</h2>
          <div className="bg-card border border-border rounded-2xl p-6">
            <ol className="space-y-4">
              {DOSSIER_STATUS_ORDER.filter(s => s !== 'CLOSED').map((status, i) => {
                const reached = i <= stepIdx;
                const current = i === stepIdx;
                return (
                  <li key={status} className="flex items-start gap-4">
                    <div className={cn(
                      'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                      reached ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'
                    )}>
                      {reached ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className={cn('text-sm', current ? 'font-bold text-foreground' : reached ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                        {DOSSIER_STATUS_LABELS[status]}
                      </p>
                      {current && <p className="text-xs text-muted-foreground mt-0.5">Étape en cours</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Linked packages */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <PackageIcon className="w-4 h-4" /> Colis associés
            </h2>
            <span className="text-xs text-muted-foreground">{packages.length}</span>
          </div>
          {packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun colis encore reçu pour ce dossier.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {packages.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <span className="text-xl">{COUNTRY_FLAGS[p.warehouse_country]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.description || 'Colis sans description'}</p>
                    <p className="text-xs text-muted-foreground">{p.status.replace(/_/g, ' ').toLowerCase()} · {p.weight ? `${p.weight} kg` : 'poids non renseigné'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Customs documents (placeholder) */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Documents douane
          </h2>
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <FileText className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Aucun document pour le moment</p>
            <p className="text-xs text-muted-foreground mt-1">L'équipe Yobbanté les ajoutera dès le dédouanement.</p>
          </div>
        </section>

        {/* Conversation */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Échanges avec l'équipe
          </h2>
          <div className="bg-card border border-border rounded-2xl">
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {messages.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  Aucun message. Posez une question à l'équipe Yobbanté.
                </p>
              )}
              {messages.map(m => (
                <div key={m.id} className={cn('p-4 flex flex-col gap-1', m.author_role === 'staff' ? 'bg-secondary/40' : '')}>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold">
                    <span className={cn(m.author_role === 'staff' ? 'text-primary' : 'text-foreground')}>
                      {m.author_role === 'staff' ? 'Équipe Yobbanté' : 'Vous'}
                    </span>
                    {m.internal_note && <span className="text-amber-600">· note interne</span>}
                    <span className="text-muted-foreground font-normal normal-case tracking-normal">
                      {new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={isStaff ? 'Répondre au client…' : 'Écrire à l\'équipe…'}
                rows={2}
                className="resize-none"
              />
              <Button onClick={handleSend} disabled={!draft.trim() || sendMessage.isPending} size="icon" className="h-auto">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {isStaff && (
          <Button onClick={() => navigate('/admin')} variant="outline" className="w-full">
            Retour à l'espace admin <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1 truncate">{value}</p>
    </div>
  );
}

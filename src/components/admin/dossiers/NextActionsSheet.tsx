/**
 * Panneau lat\u00e9ral d'actions suivantes.
 *
 * Se d\u00e9clenche automatiquement apr\u00e8s une transition lifecycle importante
 * (annulation, demande de retour, avancement de retour) via l'\u00e9v\u00e9nement global
 * `dossier:lifecycle-action`. Propose \u00e0 l'admin les 3-4 actions les plus
 * probables imm\u00e9diatement apr\u00e8s : notifier le client, cr\u00e9er un
 * remboursement, r\u00e9assigner un GP, ouvrir la fiche.
 *
 * L'\u00e9v\u00e9nement est dispatch\u00e9 par `DossierLifecycleDialogs`.
 */

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useDossierSheet } from '../dossier-sheet/useDossierSheet';
import { LIFECYCLE_BADGE } from '@/lib/dossierLifecycle';
import { MessageSquare, Receipt, UserPlus, ChevronRight, Sparkles, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Action = 'cancelled' | 'return_requested' | 'return_advanced';

interface LifecycleEvent {
  dossierId: string;
  action: Action;
  newStatus: string;
  reason?: string | null;
}

export function NextActionsSheet() {
  const [event, setEvent] = useState<LifecycleEvent | null>(null);
  const sheet = useDossierSheet();
  const qc = useQueryClient();
  const [notifyMessage, setNotifyMessage] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as LifecycleEvent;
      if (!detail?.dossierId) return;
      setEvent(detail);
    };
    window.addEventListener('dossier:lifecycle-action', handler);
    return () => window.removeEventListener('dossier:lifecycle-action', handler);
  }, []);

  const { data: dossier } = useQuery({
    enabled: !!event?.dossierId,
    queryKey: ['next-actions-dossier', event?.dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, tracking_id, contact_phone, contact_email, product_description, assigned_transporteur_ref, destination_country, destination_city, budget_eur, declared_value, sender_name')
        .eq('id', event!.dossierId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Pre-fill the default WhatsApp message the moment the sheet opens.
  useEffect(() => {
    if (!event || !dossier) return;
    const displayRef = dossier.tracking_id || dossier.reference;
    const hi = dossier.sender_name ? `Bonjour ${dossier.sender_name},` : 'Bonjour,';
    if (event.action === 'cancelled') {
      setNotifyMessage(
        `${hi}\nVotre dossier ${displayRef} a \u00e9t\u00e9 annul\u00e9.\n${event.reason ? `Motif : ${event.reason}\n` : ''}Notre \u00e9quipe vous recontacte pour la suite.\n\u2014 Yobbant\u00e9`
      );
    } else if (event.action === 'return_requested') {
      setNotifyMessage(
        `${hi}\nNous avons enclench\u00e9 la proc\u00e9dure de retour pour ${displayRef}.\nNous vous tenons inform\u00e9 des prochaines \u00e9tapes.\n\u2014 Yobbant\u00e9`
      );
    } else {
      setNotifyMessage(
        `${hi}\nMise \u00e0 jour de votre dossier ${displayRef} : ${LIFECYCLE_BADGE[event.newStatus]?.label ?? event.newStatus}.\n\u2014 Yobbant\u00e9`
      );
    }
  }, [event, dossier]);

  if (!event) return null;

  const displayRef = dossier?.tracking_id || dossier?.reference || event.dossierId.slice(0, 6);
  const badge = LIFECYCLE_BADGE[event.newStatus];

  const sendNotify = async () => {
    if (!dossier?.contact_phone) {
      toast.error('Aucun t\u00e9l\u00e9phone client');
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: dossier.contact_phone,
          text: notifyMessage,
          kind: 'lifecycle_notify',
          dossier_id: event.dossierId,
        },
      });
      if (error) throw error;
      toast.success('Client notifi\u00e9 sur WhatsApp');
    } catch (e: any) {
      toast.error(e?.message || 'Envoi impossible');
    }
  };

  const createRefund = async () => {
    try {
      const amount = dossier?.declared_value ?? dossier?.budget_eur ?? 0;
      const { error } = await supabase.from('refund_requests').insert({
        dossier_id: event.dossierId,
        amount_eur: amount,
        reason: event.reason || `Auto: ${event.action}`,
        status: 'pending',
      } as any);
      if (error) throw error;
      toast.success('Demande de remboursement cr\u00e9\u00e9e');
      qc.invalidateQueries({ queryKey: ['refund_requests'] });
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de cr\u00e9er le remboursement');
    }
  };

  const openDossier = () => {
    sheet.open(event.dossierId);
    setEvent(null);
  };

  const reassignGp = () => {
    // Reuse the same event bus that the assign dialog listens on \u2014
    // RequestsTab already opens quickAssign for that dossier id.
    window.dispatchEvent(new CustomEvent('admin:quick-assign', {
      detail: {
        id: event.dossierId,
        destCountry: dossier?.destination_country,
        destCity: dossier?.destination_city,
      },
    }));
    setEvent(null);
  };

  const title =
    event.action === 'cancelled' ? 'Dossier annul\u00e9' :
    event.action === 'return_requested' ? 'Retour d\u00e9marr\u00e9' :
    'Retour avanc\u00e9';

  return (
    <Sheet open={!!event} onOpenChange={(v) => !v && setEvent(null)}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <div className="p-5 border-b border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">Prochaines actions</span>
            </div>
            <SheetTitle className="text-lg flex items-center gap-2">
              {title}
              {badge && (
                <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', badge.tone)}>
                  {badge.label}
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs">{displayRef}</SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* WhatsApp notify */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">Notifier le client</div>
                <div className="text-[11px] text-muted-foreground">
                  {dossier?.contact_phone || 'T\u00e9l\u00e9phone non renseign\u00e9'}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider">Message WhatsApp (\u00e9ditable)</Label>
              <Textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                rows={5}
                className="text-xs font-mono"
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={sendNotify}
              disabled={!dossier?.contact_phone}
            >
              Envoyer
            </Button>
          </div>

          {/* Refund */}
          {(event.action === 'cancelled' || event.action === 'return_advanced') && (
            <button
              onClick={createRefund}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group animate-scale-in"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">Cr\u00e9er un remboursement</div>
                  <div className="text-[11px] text-muted-foreground">
                    {dossier?.declared_value ?? dossier?.budget_eur
                      ? `\u2248 ${dossier.declared_value ?? dossier.budget_eur} \u20ac`
                      : 'Montant \u00e0 d\u00e9finir'}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
          )}

          {/* Reassign GP */}
          {event.action === 'return_requested' && (
            <button
              onClick={reassignGp}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group animate-scale-in"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">R\u00e9assigner un GP retour</div>
                  <div className="text-[11px] text-muted-foreground">
                    Chercher un GP disponible pour ramener le colis
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
          )}

          {/* Open full sheet */}
          <button
            onClick={openDossier}
            className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group animate-scale-in"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary text-foreground flex items-center justify-center">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">Ouvrir la fiche compl\u00e8te</div>
                <div className="text-[11px] text-muted-foreground">
                  Timeline, messages, documents, remboursements
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </button>
        </div>

        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setEvent(null)}>
            <X className="w-3.5 h-3.5 mr-1" /> Ignorer et rester ici
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

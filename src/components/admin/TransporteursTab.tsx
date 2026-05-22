import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Search, Power, Pencil, Send, Upload, ExternalLink, Check, Bot, MessageCircle } from 'lucide-react';
import { GpImportDialog } from './GpImportDialog';
import { GpActionsPanel } from './GpActionsPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useTransporteurs, type Transporteur } from '@/hooks/useTransporteurs';
import { useManualDepartures } from '@/hooks/useManualDepartures';
import { useGpBotActive } from '@/hooks/useGpBotActive';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendGpMessage } from '@/lib/sendGpMessage';
import { Progress } from '@/components/ui/progress';
import { SendEditLinkDialog } from './SendEditLinkDialog';
import { Pencil as PencilIcon } from 'lucide-react';

const YOBBANTE_BOT_NUMBER = '+221781221891';

/** Build the personalized bot-onboarding message (no accents for WhatsApp). */
function buildBotInviteMessage(gp: Transporteur) {
  const prenom = (gp.prenom?.trim() || gp.nom.split(' ')[0] || 'cher partenaire');
  return `Salam ${prenom},

J ai mis en place un assistant automatique pour gerer nos colis ensemble.

Enregistre ce numero dans tes contacts :
${YOBBANTE_BOT_NUMBER}
Nom : Yobbante GP

Envoie le mot AIDE pour voir comment ca marche.

On continue nos echanges comme avant.

A bientot !`;
}

function buildBotWaUrl(gp: Transporteur) {
  const phone = (gp.telephone_1 || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildBotInviteMessage(gp))}`;
}


/** Pad ref to GP0001 form. */
function gpRef(reference: string) {
  return `GP${String(reference).replace(/\D/g, '').padStart(4, '0')}`;
}

/** Build a clean display name: dedupes when prenom is already the prefix of nom,
 *  and collapses any "Word Word" repetition inside prenom. */
function formatTransporteurName(prenomRaw?: string | null, nomRaw?: string | null) {
  const collapseDup = (s: string) => s.replace(/\b(\p{L}+)\s+\1\b/giu, '$1');
  const prenom = collapseDup((prenomRaw ?? '').trim());
  const nom = collapseDup((nomRaw ?? '').trim()).replace(/[-\s]+$/, '').trim();
  if (!prenom) return nom;
  if (!nom) return prenom;
  if (nom.toLowerCase() === prenom.toLowerCase() ||
      nom.toLowerCase().startsWith(prenom.toLowerCase() + ' ')) {
    return nom;
  }
  return `${prenom} ${nom}`;
}

/** Build personalized Konnekt invite text per GP (no accents for WhatsApp). */
function buildInviteMessage(gp: Transporteur) {
  const prenom = (gp.prenom?.trim() || gp.nom.split(' ')[0] || 'cher partenaire');
  return `Salam ${prenom},

Yobbante vous invite a rejoindre Konnekt, la plateforme officielle de nos transporteurs.

Votre profil est deja cree. Activez votre compte ici :
yobbante.com/rejoindre-konnekt?ref=${gpRef(gp.reference)}

Une fois inscrit, vous recevrez vos missions directement sur votre telephone.

Questions ? Repondez a ce message.`;
}

function buildWaUrl(gp: Transporteur) {
  const phone = (gp.telephone_1 || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildInviteMessage(gp))}`;
}

function formatShortDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export function TransporteursTab() {
  const navigate = useNavigate();
  const { list, upsert, deactivate } = useTransporteurs();
  const { list: depList } = useManualDepartures();
  const { data: botActiveIds } = useGpBotActive();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Transporteur | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [blastOpen, setBlastOpen] = useState(false);
  const [botBlastOpen, setBotBlastOpen] = useState(false);
  const [sentMap, setSentMap] = useState<Record<string, string>>({});
  const [botSentMap, setBotSentMap] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [actionsGp, setActionsGp] = useState<Transporteur | null>(null);
  const [editLinkGp, setEditLinkGp] = useState<Transporteur | null>(null);

  const existingRefs = useMemo(
    () => new Set((list.data ?? []).map(t => t.reference)),
    [list.data],
  );

  const markInvited = async (gp: Transporteur) => {
    const now = new Date().toISOString();
    setSentMap(prev => ({ ...prev, [gp.id]: now }));
    try {
      await supabase
        .from('transporteurs' as any)
        .update({ beta_invite_sent_at: now })
        .eq('id', gp.id);
      list.refetch();
    } catch (e) {
      // Non-bloquant
    }
  };

  const markBotInvited = async (gp: Transporteur) => {
    const now = new Date().toISOString();
    setBotSentMap(prev => ({ ...prev, [gp.id]: now }));
    try {
      await supabase
        .from('transporteurs' as any)
        .update({ invitation_bot_sent_at: now })
        .eq('id', gp.id);
      list.refetch();
    } catch (e) {
      // Non-bloquant
    }
  };

  const openInvite = async (gp: Transporteur) => {
    const phoneDigits = (gp.telephone_1 || '').replace(/\D/g, '');
    if (!phoneDigits) {
      toast.error('Numéro de téléphone manquant');
      return;
    }
    const res = await sendGpMessage({
      phone: gp.telephone_1,
      message: buildInviteMessage(gp),
      transporteur_id: gp.id,
      trigger_type: 'admin_invite_konnekt',
    });
    if (res.ok) toast.success('Invitation Konnekt envoyée');
    await markInvited(gp);
  };

  const openBotInvite = async (gp: Transporteur) => {
    const phoneDigits = (gp.telephone_1 || '').replace(/\D/g, '');
    if (!phoneDigits) {
      toast.error('Numéro de téléphone manquant');
      return;
    }
    const res = await sendGpMessage({
      phone: gp.telephone_1,
      message: buildBotInviteMessage(gp),
      transporteur_id: gp.id,
      trigger_type: 'admin_onboard_bot',
    });
    if (res.ok) toast.success('Invitation bot envoyée');
    await markBotInvited(gp);
  };

  const eligible = useMemo(
    () => (list.data ?? []).filter(t => t.actif && !t.konnekt_registered && !t.beta_invite_sent_at),
    [list.data],
  );

  const botEligible = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return (list.data ?? []).filter(t => {
      if (!t.actif) return false;
      if (botActiveIds?.has(t.id)) return false;
      const lastSent = botSentMap[t.id] ?? t.invitation_bot_sent_at ?? null;
      if (!lastSent) return true;
      return new Date(lastSent).getTime() < sevenDaysAgo;
    });
  }, [list.data, botActiveIds, botSentMap]);

  const botActiveCount = useMemo(
    () => (list.data ?? []).filter(t => botActiveIds?.has(t.id)).length,
    [list.data, botActiveIds],
  );

  const counts = useMemo(() => {
    const map: Record<string, { count: number; last: string | null }> = {};
    (depList.data ?? []).forEach((d: any) => {
      const ref = d.transporteur_ref;
      if (!ref) return;
      if (!map[ref]) map[ref] = { count: 0, last: null };
      map[ref].count += 1;
      if (!map[ref].last || d.departure_date > map[ref].last!) map[ref].last = d.departure_date;
    });
    return map;
  }, [depList.data]);


  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const base = showInactive ? all : all.filter(t => t.actif);
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter(t =>
      t.reference.includes(s) ||
      t.nom.toLowerCase().includes(s) ||
      (t.prenom ?? '').toLowerCase().includes(s) ||
      t.telephone_1.toLowerCase().includes(s) ||
      (t.telephone_2 ?? '').toLowerCase().includes(s) ||
      t.ville.toLowerCase().includes(s),
    );
  }, [list.data, q, showInactive]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Transporteurs</h2>
          <p className="text-sm text-muted-foreground">Annuaire interne. Pré-remplit automatiquement les départs manuels.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 text-[13px] font-medium hover:bg-[#F5C518]/10 transition-colors"
            style={{
              border: '1px solid #F5C518', color: '#F5C518',
              borderRadius: 10, padding: '10px 20px', background: 'transparent',
            }}
          >
            <Upload className="w-4 h-4" /> Importer une base GP
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBlastOpen(true)}
            className="border-[#F5C518] text-[#F5C518] hover:bg-[#F5C518]/10 hover:text-[#F5C518]"
          >
            <Send className="w-4 h-4 mr-2" />
            Inviter tous les GP sur Konnekt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBotBlastOpen(true)}
            className="border-[#F5C518] text-[#F5C518] hover:bg-[#F5C518]/10 hover:text-[#F5C518]"
          >
            <Bot className="w-4 h-4 mr-2" />
            Onboarder sur le Bot GP
          </Button>

          <Button variant="outline" size="sm" onClick={() => setEditing({
            id: '', reference: '', nom: '', telephone_1: '', telephone_2: null,
            adresse_1: '', adresse_2: null, ville: 'Dakar', zone: null, notes: null,
            actif: true, created_at: '', updated_at: '',
          } as Transporteur)}>
            + Nouveau transporteur
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : référence · nom · téléphone · ville" className="pl-9" />
        </div>
        <Button variant={showInactive ? 'default' : 'outline'} size="sm" onClick={() => setShowInactive(s => !s)}>
          {showInactive ? 'Masquer inactifs' : 'Afficher inactifs'}
        </Button>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Aucun transporteur {q ? 'trouvé' : 'enregistré'}.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="hidden md:grid grid-cols-[80px_1fr_140px_120px_60px_100px_120px_120px_60px] items-center gap-3 px-3 py-2 bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
            <div>Réf</div><div>Nom</div><div>Téléphone</div><div>Ville</div><div>Dép.</div><div>Dernier</div><div>Statut Konnekt</div><div>Statut Bot</div><div></div>
          </div>
          {filtered.map((t) => {
            const c = counts[t.reference] ?? { count: 0, last: null };
            const inviteAt = sentMap[t.id] ?? t.beta_invite_sent_at ?? null;
            const botInviteAt = botSentMap[t.id] ?? t.invitation_bot_sent_at ?? null;
            const botActive = !!botActiveIds?.has(t.id);
            return (
              <div key={t.id} className={`grid md:grid-cols-[80px_1fr_140px_120px_60px_100px_120px_120px_60px] grid-cols-1 gap-2 md:gap-3 px-3 py-3 border-t border-border text-sm items-center ${!t.actif ? 'opacity-60' : ''}`}>
                <div className="font-mono font-semibold">{gpRef(t.reference)}</div>
                <div className="font-medium">{formatTransporteurName(t.prenom, t.nom)}{!t.actif && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">inactif</span>}</div>
                <div className="text-muted-foreground">{t.telephone_1}</div>
                <div>{t.ville}</div>
                <div>{c.count}</div>
                <div className="text-muted-foreground">{c.last ?? '—'}</div>
                <div>
                  <KonnektStatus invitedAt={inviteAt} registered={!!t.konnekt_registered} />
                </div>
                <div>
                  <BotStatus invitedAt={botInviteAt} active={botActive} />
                </div>
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setActionsGp(t)}>
                        <Bot className="w-4 h-4 mr-2" /> Actions GP
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditing(t)}>
                        <Pencil className="w-4 h-4 mr-2" /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openInvite(t)}>
                        <Send className="w-4 h-4 mr-2" /> Inviter sur Konnekt
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openBotInvite(t)}>
                        <Bot className="w-4 h-4 mr-2" /> Onboarder sur le bot
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/admin/messages?gp=${t.id}`)}>
                        <MessageCircle className="w-4 h-4 mr-2" /> Voir conversation bot
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditLinkGp(t)}>
                        <PencilIcon className="w-4 h-4 mr-2" /> Envoyer lien de modification
                      </DropdownMenuItem>
                      {t.actif && (
                        <DropdownMenuItem onClick={async () => {
                          await deactivate.mutateAsync(t.id);
                          toast.success(`Transporteur Réf. ${gpRef(t.reference)} désactivé`);
                        }} className="text-destructive">
                          <Power className="w-4 h-4 mr-2" /> Désactiver
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}


      <EditDrawer
        transporteur={editing}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (!/^[0-9]{4}$/.test(data.reference)) {
            toast.error('Référence : 4 chiffres requis');
            return;
          }
          await upsert.mutateAsync(data);
          toast.success(`Transporteur Réf. ${gpRef(data.reference)} enregistré`);
          setEditing(null);
        }}
      />

      {editLinkGp && (
        <SendEditLinkDialog
          open={!!editLinkGp}
          onOpenChange={(v) => { if (!v) setEditLinkGp(null); }}
          entityType="transporteur"
          entityId={editLinkGp.id}
          recipientPhone={editLinkGp.telephone_1}
          recipientFirstName={editLinkGp.prenom || editLinkGp.nom?.split(' ')[0]}
          trackingLabel={`votre profil GP (Réf. ${gpRef(editLinkGp.reference)})`}
        />
      )}

      {/* Blast modal — manual per-row sends (no auto multi-tab) */}
      <Dialog open={blastOpen} onOpenChange={setBlastOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Envoi en masse</DialogTitle>
            <DialogDescription>
              L'envoi automatique en masse nécessite l'API WhatsApp Business.
              Pour l'instant, voici la liste des GP à inviter — cliquez sur chaque
              lien pour ouvrir WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {eligible.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucun GP en attente d'invitation 🎉
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {eligible.map((g) => {
                const sentAt = sentMap[g.id];
                const isSent = !!sentAt;
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {formatTransporteurName(g.prenom, g.nom)}
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{gpRef(g.reference)}</span>
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate">{g.telephone_1}</div>
                    </div>
                    {isSent ? (
                      <Button size="sm" variant="ghost" disabled className="text-emerald-500 hover:text-emerald-500">
                        <Check className="w-4 h-4 mr-1" /> Envoyé
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openInvite(g)}
                        className="border-[#F5C518] text-[#F5C518] hover:bg-[#F5C518]/10 hover:text-[#F5C518]"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Ouvrir WhatsApp
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[12px] text-muted-foreground">
            Tous les GP contactés sont marqués automatiquement comme « Invitation envoyée ».
          </p>

          <DialogFooter>
            <Button onClick={() => setBlastOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GpImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingRefs={existingRefs}
        onAfterImport={() => list.refetch()}
        onTriggerBlast={() => setBlastOpen(true)}
      />

      <GpActionsPanel gp={actionsGp} open={!!actionsGp} onClose={() => setActionsGp(null)} />

      <BotBlastDialog
        open={botBlastOpen}
        onOpenChange={setBotBlastOpen}
        eligible={botEligible}
        activeCount={botActiveCount}
        onSent={(gp) => openBotInvite(gp)}
      />
    </div>
  );
}

function BotStatus({ invitedAt, active }: { invitedAt: string | null; active: boolean }) {
  if (active) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
        ✅ Actif
      </span>
    );
  }
  if (invitedAt) {
    return (
      <div className="leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-wider text-amber-500">📤 Invité</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{formatShortDate(invitedAt)}</div>
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

function BotBlastDialog({
  open, onOpenChange, eligible, activeCount, onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eligible: Transporteur[];
  activeCount: number;
  onSent: (gp: Transporteur) => Promise<void> | void;
}) {
  const [cursor, setCursor] = useState(0);
  const [sequential, setSequential] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [blastProgress, setBlastProgress] = useState({ done: 0, ok: 0, fail: 0 });
  const [search, setSearch] = useState('');

  // Reset when (re)opened
  useMemo(() => {
    if (open) {
      setCursor(0); setSequential(false);
      setBlasting(false);
      setBlastProgress({ done: 0, ok: 0, fail: 0 });
      setSearch('');
    }
  }, [open]);

  const filteredEligible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return eligible;
    return eligible.filter(g =>
      g.nom.toLowerCase().includes(s) ||
      (g.prenom ?? '').toLowerCase().includes(s) ||
      g.telephone_1.toLowerCase().includes(s),
    );
  }, [eligible, search]);

  const current = sequential ? eligible[cursor] : null;

  const blastAllApi = async () => {
    setBlasting(true);
    setBlastProgress({ done: 0, ok: 0, fail: 0 });
    let ok = 0, fail = 0;
    for (let i = 0; i < eligible.length; i++) {
      const gp = eligible[i];
      const res = await sendGpMessage({
        phone: gp.telephone_1,
        message: buildBotInviteMessage(gp),
        transporteur_id: gp.id,
        trigger_type: 'admin_onboard_bot_blast',
        silent: true,
      });
      if (res.ok) ok += 1; else fail += 1;
      // Mark invited regardless (we attempted contact)
      try {
        await supabase
          .from('transporteurs' as any)
          .update({ invitation_bot_sent_at: new Date().toISOString() })
          .eq('id', gp.id);
      } catch { /* non-bloquant */ }
      setBlastProgress({ done: i + 1, ok, fail });
      // 1s rate-limit between sends
      if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setBlasting(false);
    toast.success(`${ok} envoyés, ${fail} échecs (fallback wa.me disponible)`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!blasting) onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Onboarding Bot WhatsApp GP</DialogTitle>
          <DialogDescription>
            Envoi depuis le <span className="font-mono">122</span> (<span className="font-mono">{YOBBANTE_BOT_NUMBER}</span>)
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm">
          <div className="rounded-lg border border-border px-3 py-2 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Actifs sur le bot</div>
            <div className="text-lg font-bold text-emerald-500">{activeCount}</div>
          </div>
          <div className="rounded-lg border border-border px-3 py-2 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">À onboarder</div>
            <div className="text-lg font-bold" style={{ color: '#F5C518' }}>{eligible.length}</div>
          </div>
        </div>

        {blasting || (blastProgress.done > 0 && !sequential) ? (
          <div className="border border-border rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">
              {blasting ? 'Envoi en cours…' : 'Envoi terminé'} {blastProgress.done}/{eligible.length}
            </div>
            <Progress value={eligible.length ? (blastProgress.done / eligible.length) * 100 : 0} />
            <div className="text-xs text-muted-foreground">
              ✅ {blastProgress.ok} envoyés · ⚠️ {blastProgress.fail} échecs
            </div>
          </div>
        ) : sequential && current ? (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {cursor + 1} / {eligible.length}
            </div>
            <div>
              <div className="font-semibold">{formatTransporteurName(current.prenom, current.nom)}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {gpRef(current.reference)} · {current.telephone_1} · {current.ville}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  await onSent(current);
                  if (cursor + 1 >= eligible.length) {
                    toast.success('Tous les GP ont été contactés 🎉');
                    onOpenChange(false);
                  } else {
                    setCursor(c => c + 1);
                  }
                }}
                className="flex-1"
                style={{ background: '#F5C518', color: '#0A0E1A' }}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Envoyer & suivant
              </Button>
              <Button variant="ghost" onClick={() => setCursor(c => Math.min(c + 1, eligible.length - 1))}>
                Passer
              </Button>
            </div>
          </div>
        ) : eligible.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Tous les GP actifs sont déjà onboardés sur le bot 🎉
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer par nom ou téléphone"
                className="pl-9"
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredEligible.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Aucun résultat</div>
              ) : filteredEligible.map((g) => {
                const lastSent = g.invitation_bot_sent_at;
                const initials = formatTransporteurName(g.prenom, g.nom)
                  .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="shrink-0 h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {formatTransporteurName(g.prenom, g.nom)}
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{gpRef(g.reference)}</span>
                        </div>
                        <div className="text-[12px] text-muted-foreground truncate">{g.telephone_1} · {g.ville}</div>
                        {lastSent && (
                          <div className="text-[11px] text-amber-500 mt-0.5">
                            Déjà invité le {new Date(lastSent).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSent(g)}
                      className="border-[#F5C518] text-[#F5C518] hover:bg-[#F5C518]/10 hover:text-[#F5C518]"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      {lastSent ? 'Renvoyer' : 'Envoyer'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}


        <DialogFooter className="gap-2">
          {!sequential && !blasting && eligible.length > 0 && blastProgress.done === 0 && (
            <>
              <Button
                onClick={blastAllApi}
                style={{ background: '#F5C518', color: '#0A0E1A' }}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Envoyer à tous (API)
              </Button>
              <Button
                variant="outline"
                onClick={() => { setCursor(0); setSequential(true); }}
              >
                Un par un (WhatsApp)
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={blasting}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function KonnektStatus({ invitedAt, registered }: { invitedAt: string | null; registered: boolean }) {
  if (registered) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
        ✓ Inscrit
      </span>
    );
  }
  if (invitedAt) {
    return (
      <div className="leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-wider text-amber-500">📤 Invité</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{formatShortDate(invitedAt)}</div>
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

function EditDrawer({
  transporteur, onClose, onSave,
}: {
  transporteur: Transporteur | null;
  onClose: () => void;
  onSave: (t: any) => Promise<void>;
}) {
  const open = !!transporteur;
  const [ref, setRef] = useState('');
  const [nom, setNom] = useState('');
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [adr1, setAdr1] = useState('');
  const [adr2, setAdr2] = useState('');
  const [ville, setVille] = useState('Dakar');
  const [zone, setZone] = useState('');
  const [notes, setNotes] = useState('');

  useMemo(() => {
    if (transporteur) {
      setRef(transporteur.reference);
      setNom(transporteur.nom);
      setTel1(transporteur.telephone_1);
      setTel2(transporteur.telephone_2 ?? '');
      setAdr1(transporteur.adresse_1);
      setAdr2(transporteur.adresse_2 ?? '');
      setVille(transporteur.ville || 'Dakar');
      setZone(transporteur.zone ?? '');
      setNotes(transporteur.notes ?? '');
    }
  }, [transporteur]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{transporteur?.id ? 'Modifier' : 'Nouveau'} transporteur</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-3">
          <div><Label>Référence (4 chiffres) *</Label><Input value={ref} onChange={(e) => setRef(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" disabled={!!transporteur?.id} /></div>
          <div><Label>Nom / Prénom *</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
          <div><Label>Téléphone principal *</Label><Input value={tel1} onChange={(e) => setTel1(e.target.value)} /></div>
          <div><Label>Téléphone secondaire</Label><Input value={tel2} onChange={(e) => setTel2(e.target.value)} /></div>
          <div><Label>Adresse principale *</Label><Input value={adr1} onChange={(e) => setAdr1(e.target.value)} /></div>
          <div><Label>Adresse secondaire</Label><Input value={adr2} onChange={(e) => setAdr2(e.target.value)} /></div>
          <div><Label>Ville *</Label><Input value={ville} onChange={(e) => setVille(e.target.value)} /></div>
          <div><Label>Zone / Quartier</Label><Input value={zone} onChange={(e) => setZone(e.target.value)} /></div>
          <div><Label>Notes internes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={() => onSave({
              reference: ref, nom: nom.trim(), telephone_1: tel1.trim(),
              telephone_2: tel2.trim() || null, adresse_1: adr1.trim(), adresse_2: adr2.trim() || null,
              ville: ville.trim(), zone: zone.trim() || null, notes: notes.trim() || null,
            })} className="flex-1">Enregistrer</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

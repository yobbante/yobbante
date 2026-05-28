import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Search, Power, Pencil, Send, Upload, ExternalLink, Check, Bot, MessageCircle, Activity, History, Copy } from 'lucide-react';
import { WhatsAppHistoryDialog } from './transporteur/WhatsAppHistoryDialog';
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
import { sendSmartInvite, waLinkFor } from '@/lib/sendSmartInvite';
import { Progress } from '@/components/ui/progress';
import { SendEditLinkDialog } from './SendEditLinkDialog';
import { Pencil as PencilIcon } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NavettesEditor } from './transporteur/NavettesEditor';
import {
  DAKAR_ZONES, DAKAR_CRENEAUX, QUARTIER_GROUPS, uniqueCitiesFromNavettes, type Navette,
} from '@/lib/dakarZones';
import { gpWhatsappLink, YOBBANTE_GP_WHATSAPP_DISPLAY } from '@/lib/contact';

const YOBBANTE_BOT_NUMBER = '+221781221891';
const SUPER_ADMIN_PHONE = '+221784604003';

/** Build the personalized bot-onboarding message (no accents for WhatsApp). */
function buildBotInviteMessage(gp: Transporteur) {
  const prenom = (gp.prenom?.trim() || gp.nom.split(' ')[0] || 'cher partenaire');
  return `Salam ${prenom},

Yobbante vous invite a rejoindre notre reseau de transporteurs.

Enregistrez ce numero dans vos contacts :
${YOBBANTE_BOT_NUMBER}
Nom : Yobbante GP

Envoyez AIDE pour voir comment fonctionne le systeme.

Vous recevrez vos premieres missions directement sur WhatsApp.

Si vous voulez nous ecrire, envoyez votre message sur WhatsApp au ${YOBBANTE_GP_WHATSAPP_DISPLAY}.`;
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

Bienvenue sur Konnekt !

Konnekt est la plateforme des transporteurs partenaires Yobbante.

Etape 1 : Enregistrez ce numero
${YOBBANTE_BOT_NUMBER}
Nom : Konnekt GP

Etape 2 : Envoyez le mot AIDE

Etape 3 : Recevez vos missions

Si vous voulez envoyer un message, ecrivez directement au ${YOBBANTE_GP_WHATSAPP_DISPLAY}

Votre profil est deja cree. Activez votre compte ici :
yobbante.com/rejoindre-konnekt?ref=${gpRef(gp.reference)}

usekonnekt.com`;
}

function buildWaUrl(gp: Transporteur) {
  const phone = (gp.telephone_1 || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildInviteMessage(gp))}`;
}

function buildDirectMessageToGpLine(gp: Transporteur) {
  const prenom = (gp.prenom?.trim() || gp.nom.split(' ')[0] || 'partenaire');
  return gpWhatsappLink(`Salam, ici ${prenom}. Je vous ecris au sujet de mon compte GP.`);
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
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [blastOpen, setBlastOpen] = useState(false);
  const [botBlastOpen, setBotBlastOpen] = useState(false);
  const [sentMap, setSentMap] = useState<Record<string, string>>({});
  const [botSentMap, setBotSentMap] = useState<Record<string, string>>({});
  const [failedMap, setFailedMap] = useState<Record<string, { kind: 'bot' | 'konnekt'; wa: string; name: string }>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [actionsGp, setActionsGp] = useState<Transporteur | null>(null);
  const [editLinkGp, setEditLinkGp] = useState<Transporteur | null>(null);
  const [historyGp, setHistoryGp] = useState<Transporteur | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'all' | 'beta'>('all');
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const sendTestWhatsApp = async (gp: Transporteur) => {
    const phoneDigits = (gp.telephone_1 || '').replace(/\D/g, '');
    if (!phoneDigits) { toast.error('Numéro de téléphone manquant'); return; }
    const name = formatTransporteurName(gp.prenom, gp.nom);
    const prenom = (gp.prenom?.trim() || gp.nom.split(' ')[0] || 'partenaire');
    const message = `Salam ${prenom}, test de delivrabilite Yobbante. Si vous voyez ce message, repondez OK au ${YOBBANTE_BOT_NUMBER}. Merci.`;
    setTestingId(gp.id);
    try {
      const res = await sendSmartInvite({
        phone: gp.telephone_1,
        message,
        gp_name: name,
        gp_ref: gpRef(gp.reference),
        transporteur_id: gp.id,
        kind: 'bot_onboard',
        trigger_type: 'admin_test_delivery',
      });
      if (res.ok) toast.success('Message test envoyé via API WhatsApp ✅');
    } finally {
      setTestingId(null);
    }
  };

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

  /** Génère le prochain ref 4 chiffres en se basant sur la liste actuelle. */
  const nextAvailableRef = (): string => {
    const taken = new Set(
      (list.data ?? [])
        .map(t => String(t.reference || '').replace(/\D/g, ''))
        .filter(r => /^\d{1,4}$/.test(r))
        .map(r => parseInt(r, 10)),
    );
    let n = 1001;
    while (taken.has(n) && n <= 9999) n += 1;
    return String(n).padStart(4, '0');
  };

  const validateBeta = async (gp: Transporteur) => {
    if (gp.actif) {
      toast.info('Ce GP est déjà actif');
      return;
    }
    const prenom = (gp.prenom?.trim() || gp.nom.split(' ')[0] || 'partenaire');
    let reference = String(gp.reference || '').replace(/\D/g, '');
    if (!/^\d{4}$/.test(reference)) reference = nextAvailableRef();

    // 1. Activation + reference
    const { error: updErr } = await supabase
      .from('transporteurs' as any)
      .update({ actif: true, reference })
      .eq('id', gp.id);
    if (updErr) {
      toast.error('Activation impossible : ' + updErr.message);
      return;
    }

    // 2. WhatsApp activation (depuis le 122)
    const message = [
      `Salam ${prenom},`,
      ``,
      `Votre compte Konnekt est active !`,
      ``,
      `Connectez-vous ici :`,
      `usekonnekt.com/gp`,
      ``,
      `Vos identifiants :`,
      `Telephone : ${gp.telephone_1}`,
      `Code : ${reference}`,
      ``,
      `Le bot WhatsApp reste actif pour vos missions quotidiennes.`,
      ``,
      `Bienvenue dans le reseau Yobbante !`,
    ].join('\n');

    const res = await sendGpMessage({
      phone: gp.telephone_1,
      message,
      transporteur_id: gp.id,
      trigger_type: 'konnekt_beta_validated',
      silent: true,
    });

    if (res.ok) {
      toast.success(`GP activé — identifiants envoyés (Réf. ${gpRef(reference)})`);
      // Notif admin : succès activation
      try {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            recipient_phone: SUPER_ADMIN_PHONE,
            recipient_type: 'admin',
            message: [
              `GP Konnekt active :`,
              `${formatTransporteurName(gp.prenom, gp.nom)}`,
              `Tel : ${gp.telephone_1}`,
              `Code : ${reference}`,
            ].join('\n'),
            client_name: formatTransporteurName(gp.prenom, gp.nom),
            trigger_type: 'konnekt_beta_validated_admin',
          },
        });
      } catch { /* non bloquant */ }
    } else {
      // 3. Notif admin pour envoi manuel
      try {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            recipient_phone: SUPER_ADMIN_PHONE,
            recipient_type: 'admin',
            message: [
              `Echec envoi WhatsApp activation Konnekt`,
              `GP : ${formatTransporteurName(gp.prenom, gp.nom)}`,
              `Tel : ${gp.telephone_1}`,
              `Ref : ${reference}`,
              `Envoyer manuellement depuis le 122 :`,
              res.waLink,
            ].join('\n'),
            client_name: formatTransporteurName(gp.prenom, gp.nom),
            trigger_type: 'konnekt_beta_validated_failed_alert',
          },
        });
      } catch { /* non bloquant */ }
      toast.warning('GP activé — envoi WhatsApp en echec, admin notifié pour envoi manuel');
    }
    list.refetch();
  };


  const openInvite = async (gp: Transporteur) => {
    const phoneDigits = (gp.telephone_1 || '').replace(/\D/g, '');
    if (!phoneDigits) {
      toast.error('Numéro de téléphone manquant');
      return;
    }
    const name = formatTransporteurName(gp.prenom, gp.nom);
    const message = buildInviteMessage(gp);
    const res = await sendSmartInvite({
      phone: gp.telephone_1,
      message,
      gp_name: name,
      gp_ref: gpRef(gp.reference),
      transporteur_id: gp.id,
      kind: 'konnekt_invite',
      trigger_type: 'admin_invite_konnekt',
    });
    await markInvited(gp);
    if (!res.ok) {
      setFailedMap(prev => ({ ...prev, [gp.id]: { kind: 'konnekt', wa: res.wa_link, name } }));
    } else {
      setFailedMap(prev => { const { [gp.id]: _, ...rest } = prev; return rest; });
    }
  };

  const openBotInvite = async (gp: Transporteur) => {
    const phoneDigits = (gp.telephone_1 || '').replace(/\D/g, '');
    if (!phoneDigits) {
      toast.error('Numéro de téléphone manquant');
      return;
    }
    const name = formatTransporteurName(gp.prenom, gp.nom);
    const message = buildBotInviteMessage(gp);
    const res = await sendSmartInvite({
      phone: gp.telephone_1,
      message,
      gp_name: name,
      gp_ref: gpRef(gp.reference),
      transporteur_id: gp.id,
      kind: 'bot_onboard',
      trigger_type: 'admin_onboard_bot',
    });
    await markBotInvited(gp);
    if (!res.ok) {
      setFailedMap(prev => ({ ...prev, [gp.id]: { kind: 'bot', wa: res.wa_link, name } }));
    } else {
      setFailedMap(prev => { const { [gp.id]: _, ...rest } = prev; return rest; });
    }
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
    let base = showInactive ? all : all.filter(t => t.actif);
    if (onlyIncomplete) base = base.filter(t => !t.profile_complete);
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter(t =>
      t.reference.includes(s) ||
      t.nom.toLowerCase().includes(s) ||
      (t.prenom ?? '').toLowerCase().includes(s) ||
      t.telephone_1.toLowerCase().includes(s) ||
      (t.telephone_2 ?? '').toLowerCase().includes(s) ||
      t.ville.toLowerCase().includes(s) ||
      uniqueCitiesFromNavettes(t.navettes).some(c => c.toLowerCase().includes(s)),
    );
  }, [list.data, q, showInactive, onlyIncomplete]);

  const betaPending = useMemo(
    () => (list.data ?? []).filter(t => !t.actif && t.konnekt_registered),
    [list.data],
  );

  const betaPendingFiltered = useMemo(() => {
    if (!q.trim()) return betaPending;
    const s = q.trim().toLowerCase();
    return betaPending.filter(t =>
      (t.nom ?? '').toLowerCase().includes(s) ||
      (t.prenom ?? '').toLowerCase().includes(s) ||
      (t.telephone_1 ?? '').toLowerCase().includes(s) ||
      (t.ville ?? '').toLowerCase().includes(s),
    );
  }, [betaPending, q]);

  return (
    <div className="space-y-5">
      {betaPending.length > 0 && subTab !== 'beta' && (
        <button
          onClick={() => setSubTab('beta')}
          className="w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors"
          style={{ borderColor: '#F5C518', background: 'rgba(245,197,24,0.08)', color: '#F5C518' }}
        >
          <span>
            {betaPending.length} demande{betaPending.length > 1 ? 's' : ''} Konnekt beta en attente de validation
          </span>
          <span className="text-xs opacity-80">Voir →</span>
        </button>
      )}

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Transporteurs</h2>
          <p className="text-sm text-muted-foreground">Annuaire interne. Pré-remplit automatiquement les départs manuels.</p>
        </div>
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
        <Button variant={onlyIncomplete ? 'default' : 'outline'} size="sm" onClick={() => setOnlyIncomplete(s => !s)}>
          ⚠️ Profils incomplets
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const incomplete = (list.data ?? []).filter(t => t.actif && !t.profile_complete && t.telephone_1);
            if (incomplete.length === 0) { toast.info('Aucun profil incomplet à relancer.'); return; }
            if (!confirm(`Envoyer un rappel WhatsApp à ${incomplete.length} GP avec profil incomplet ?`)) return;
            let ok = 0, fail = 0;
            const { data: { user } } = await supabase.auth.getUser();
            for (const t of incomplete) {
              try {
                const { data: tok, error } = await supabase.from('edit_tokens').insert({
                  entity_type: 'transporteur',
                  entity_id: t.id,
                  fields_allowed: ['telephone_1', 'adresse_collecte_dakar', 'adresse_dakar_2', 'adresses_remise', 'navettes'],
                  created_by: user?.id ?? null,
                }).select('token').single();
                if (error || !tok) throw error;
                const link = `https://yobbante.com/modifier/${tok.token}`;
                const prenom = t.prenom || t.nom?.split(' ')[0] || 'partenaire';
                const message =
                  `Bonjour ${prenom},\n\n` +
                  `Votre profil Yobbante GP est incomplet. ` +
                  `Completez-le pour recevoir plus de missions :\n${link}\n\n` +
                  `Lien valide 24h.`;
                const { error: waErr } = await supabase.functions.invoke('send-whatsapp', {
                  body: { recipient_phone: t.telephone_1, recipient_type: 'transporteur', message, trigger_type: 'profile_reminder_blast' },
                });
                if (waErr) throw waErr;
                ok++;
              } catch (_e) { fail++; }
            }
            toast.success(`Campagne envoyée : ${ok} OK · ${fail} échecs`);
          }}
        >
          📣 Relance incomplets
        </Button>
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
          <div className="hidden md:grid grid-cols-[70px_1fr_130px_1fr_110px_90px_90px_50px] items-center gap-3 px-3 py-2 bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
            <div>Réf</div><div>Nom</div><div>Téléphone</div><div>Navettes</div><div>Profil</div><div>Konnekt</div><div>Bot</div><div></div>
          </div>
          {filtered.map((t) => {
            const c = counts[t.reference] ?? { count: 0, last: null };
            const inviteAt = sentMap[t.id] ?? t.beta_invite_sent_at ?? null;
            const botInviteAt = botSentMap[t.id] ?? t.invitation_bot_sent_at ?? null;
            const botActive = !!botActiveIds?.has(t.id);
            const cities = uniqueCitiesFromNavettes(t.navettes);
            return (
              <div key={t.id} className={`grid md:grid-cols-[70px_1fr_130px_1fr_110px_90px_90px_50px] grid-cols-1 gap-2 md:gap-3 px-3 py-3 border-t border-border text-sm items-center ${!t.actif ? 'opacity-60' : ''}`}>
                <div className="font-mono font-semibold">{gpRef(t.reference)}</div>
                <div className="font-medium min-w-0 truncate">
                  {formatTransporteurName(t.prenom, t.nom)}
                  {!t.actif && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">inactif</span>}
                </div>
                <div className="text-muted-foreground truncate">{t.telephone_1} <span className="text-[10px] block text-muted-foreground/70">{c.count} dép.</span></div>
                <div className="flex flex-wrap gap-1">
                  {cities.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  ) : (
                    <>
                      {cities.slice(0, 3).map(city => (
                        <Badge key={city} variant="secondary" className="text-[10px] font-normal">{city}</Badge>
                      ))}
                      {cities.length > 3 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[10px] font-normal cursor-help">+{cities.length - 3} autres</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-[200px] text-xs">{cities.slice(3).join(', ')}</div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </>
                  )}
                </div>
                <div>
                  {t.profile_complete ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">✅ Complet</Badge>
                  ) : (
                    <button
                      onClick={() => setEditing(t)}
                      className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                    >
                      ⚠️ Compléter
                    </button>
                  )}
                </div>
                <div><KonnektStatus invitedAt={inviteAt} registered={!!t.konnekt_registered} failed={failedMap[t.id]?.kind === 'konnekt' ? failedMap[t.id].wa : null} onRetry={() => openInvite(t)} /></div>
                <div><BotStatus invitedAt={botInviteAt} active={botActive} failed={failedMap[t.id]?.kind === 'bot' ? failedMap[t.id].wa : null} onRetry={() => openBotInvite(t)} /></div>
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
                      <DropdownMenuItem onClick={() => window.open(buildDirectMessageToGpLine(t), '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Envoyer msg WhatsApp (wa.me)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        const link = buildBotWaUrl(t);
                        try {
                          await navigator.clipboard.writeText(link);
                          toast.success(`Lien wa.me copié — à envoyer depuis le 122 (${YOBBANTE_GP_WHATSAPP_DISPLAY})`);
                        } catch { toast.error('Copie impossible'); }
                      }}>
                        <Copy className="w-4 h-4 mr-2" /> Copier le lien wa.me (depuis 122)
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={testingId === t.id} onClick={() => sendTestWhatsApp(t)}>
                        <Activity className="w-4 h-4 mr-2" /> {testingId === t.id ? 'Test en cours…' : "Tester l'envoi WhatsApp"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoryGp(t)}>
                        <History className="w-4 h-4 mr-2" /> Historique WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditLinkGp(t)}>
                        <PencilIcon className="w-4 h-4 mr-2" /> Envoyer lien de modification
                      </DropdownMenuItem>
                      {!t.actif && (
                        <DropdownMenuItem onClick={() => validateBeta(t)} className="text-emerald-600 dark:text-emerald-400">
                          <Check className="w-4 h-4 mr-2" /> Valider beta (activer GP)
                        </DropdownMenuItem>
                      )}
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

      <WhatsAppHistoryDialog
        transporteurId={historyGp?.id ?? null}
        phone={historyGp?.telephone_1}
        gpLabel={historyGp ? `${formatTransporteurName(historyGp.prenom, historyGp.nom)} · ${gpRef(historyGp.reference)}` : undefined}
        onClose={() => setHistoryGp(null)}
      />

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

function BotStatus({ invitedAt, active, failed, onRetry }: { invitedAt: string | null; active: boolean; failed?: string | null; onRetry?: () => void }) {
  if (active) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
        ✅ Actif
      </span>
    );
  }
  if (failed) {
    return (
      <div className="leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-wider text-destructive">❌ Échec</div>
        <div className="flex gap-1 mt-0.5">
          {onRetry && <button onClick={onRetry} className="text-[10px] underline text-muted-foreground">Réessayer</button>}
          <a href={failed} target="_blank" rel="noopener noreferrer" className="text-[10px] underline text-emerald-500">wa.me</a>
        </div>
      </div>
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
    const failures: string[] = [];
    for (let i = 0; i < eligible.length; i++) {
      const gp = eligible[i];
      const name = formatTransporteurName(gp.prenom, gp.nom);
      const res = await sendSmartInvite({
        phone: gp.telephone_1,
        message: buildBotInviteMessage(gp),
        gp_name: name,
        gp_ref: gpRef(gp.reference),
        transporteur_id: gp.id,
        kind: 'bot_onboard',
        trigger_type: 'admin_onboard_bot_blast',
        silent: true,
      });
      if (res.ok) ok += 1; else { fail += 1; failures.push(name); }
      try {
        await supabase
          .from('transporteurs' as any)
          .update({ invitation_bot_sent_at: new Date().toISOString() })
          .eq('id', gp.id);
      } catch { /* non-bloquant */ }
      setBlastProgress({ done: i + 1, ok, fail });
      if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setBlasting(false);
    // Notif super admin — bulk summary
    try {
      const summary = [
        `Onboarding bulk termine :`,
        `${ok} envoyes avec succes`,
        `${fail} a envoyer manuellement`,
        failures.length > 0 ? `Liste manuelle : ${failures.slice(0, 10).join(', ')}${failures.length > 10 ? '…' : ''}` : null,
      ].filter(Boolean).join('\n');
      await sendGpMessage({
        phone: '+221784604003',
        message: summary,
        trigger_type: 'admin_onboard_bulk_summary',
        silent: true,
        openFallback: false,
      });
    } catch { /* non-bloquant */ }
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


function KonnektStatus({ invitedAt, registered, failed, onRetry }: { invitedAt: string | null; registered: boolean; failed?: string | null; onRetry?: () => void }) {
  if (registered) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
        ✓ Inscrit
      </span>
    );
  }
  if (failed) {
    return (
      <div className="leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-wider text-destructive">❌ Échec</div>
        <div className="flex gap-1 mt-0.5">
          {onRetry && <button onClick={onRetry} className="text-[10px] underline text-muted-foreground">Réessayer</button>}
          <a href={failed} target="_blank" rel="noopener noreferrer" className="text-[10px] underline text-emerald-500">wa.me</a>
        </div>
      </div>
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
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [adrDakar1, setAdrDakar1] = useState('');
  const [adrDakar2, setAdrDakar2] = useState('');
  const [zoneDakar, setZoneDakar] = useState('');
  const [creneauDakar, setCreneauDakar] = useState<string[]>([]);
  const [navettes, setNavettes] = useState<Navette[]>([]);
  const [defaultRate, setDefaultRate] = useState<string>('');
  const [ratesPerCity, setRatesPerCity] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transporteur) {
      if (!transporteur.id && !transporteur.reference) {
        setRef(String(Math.floor(1000 + Math.random() * 9000)));
      } else {
        setRef(transporteur.reference);
      }
      setPrenom(transporteur.prenom ?? '');
      setNom(transporteur.nom ?? '');
      setPhotoUrl(transporteur.photo_url ?? '');
      setTel1(transporteur.telephone_1 ?? '');
      setTel2(transporteur.telephone_2 ?? '');
      setAdrDakar1(transporteur.adresse_collecte_dakar ?? transporteur.adresse_1 ?? '');
      setAdrDakar2(transporteur.adresse_dakar_2 ?? transporteur.adresse_2 ?? '');
      setZoneDakar(transporteur.zone ?? '');
      setCreneauDakar(transporteur.creneau_dakar ?? []);
      setNavettes(Array.isArray(transporteur.navettes) ? transporteur.navettes : []);
      setDefaultRate(transporteur.default_rate_per_kg != null ? String(transporteur.default_rate_per_kg) : '');
      setRatesPerCity((transporteur.default_routes as any) ?? {});
      setNotes(transporteur.notes ?? '');
    }
    // Only re-init when switching to a different transporteur, not on every list refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transporteur?.id]);

  const citiesFromNavettes = useMemo(() => uniqueCitiesFromNavettes(navettes), [navettes]);

  const toggleCreneau = (id: string) => {
    setCreneauDakar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const onPhotoSelected = async (file: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${ref || 'tmp'}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('transporteur-photos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('transporteur-photos').getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      toast.success('Photo téléchargée');
    } catch (e: any) {
      toast.error('Échec téléversement', { description: e?.message });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!/^[0-9]{4}$/.test(ref)) { toast.error('Référence : 4 chiffres requis'); return; }
    if (!prenom.trim()) { toast.error('Prénom obligatoire'); return; }
    if (!nom.trim()) { toast.error('Nom obligatoire'); return; }
    if (!tel1.trim() || !/^\+?[\d\s().-]{8,}$/.test(tel1.trim())) {
      toast.error('Téléphone principal invalide (format international attendu)'); return;
    }
    if (!adrDakar1.trim()) { toast.error('Adresse Dakar obligatoire'); return; }
    if (!zoneDakar) { toast.error('Zone / quartier obligatoire'); return; }

    // Sanitize: remove navettes with no valid city, escales with no city
    const cleanNavettes: Navette[] = navettes
      .map(n => ({ ...n, villes: (n.villes ?? []).filter(v => (v.ville || '').trim().length > 0) }))
      .filter(n => n.villes.length > 0);

    const cleanRates: Record<string, number> = {};
    Object.entries(ratesPerCity).forEach(([city, val]) => {
      if (citiesFromNavettes.includes(city) && Number.isFinite(val) && val > 0) cleanRates[city] = val;
    });

    setSaving(true);
    try {
      await onSave({
        ...(transporteur?.id ? { id: transporteur.id } : {}),
        reference: ref,
        prenom: prenom.trim(),
        nom: nom.trim(),
        photo_url: photoUrl || null,
        telephone_1: tel1.trim(),
        telephone_2: tel2.trim() || null,
        adresse_1: adrDakar1.trim(),
        adresse_2: adrDakar2.trim() || null,
        ville: 'Dakar',
        zone: zoneDakar,
        adresse_collecte_dakar: adrDakar1.trim(),
        adresse_dakar_2: adrDakar2.trim() || null,
        creneau_dakar: creneauDakar,
        navettes: cleanNavettes,
        default_rate_per_kg: defaultRate ? Number(defaultRate) : null,
        default_routes: cleanRates,
        notes: notes.trim() || null,
      } as any);
    } catch (e: any) {
      console.error('Transporteur save failed', e);
      toast.error('Échec de l’enregistrement', { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{transporteur?.id ? 'Modifier' : 'Nouveau'} transporteur GP</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* === SECTION 1 : Identité === */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold border-b border-border pb-2">1. Identité</h3>
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="h-20 w-20 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : (prenom[0] || nom[0] || '?').toUpperCase()}
                </div>
                <label className="block mt-2 text-[11px] text-center cursor-pointer text-muted-foreground hover:text-foreground">
                  {photoUploading ? '…' : 'Photo'}
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Référence (4 chiffres) *</Label>
                  <Input
                    value={ref}
                    onChange={(e) => setRef(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4} inputMode="numeric"
                    disabled={!!transporteur?.id}
                  />
                </div>
                <div className="hidden sm:block" />
                <div><Label>Prénom *</Label><Input value={prenom} onChange={(e) => setPrenom(e.target.value)} /></div>
                <div><Label>Nom *</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
              </div>
            </div>
          </section>

          {/* === SECTION 2 : Contact === */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold border-b border-border pb-2">2. Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Téléphone 1 * <span className="text-[10px] text-muted-foreground">(WhatsApp bot 122)</span></Label>
                <Input value={tel1} onChange={(e) => setTel1(e.target.value)} placeholder="+221 XX XXX XX XX" />
              </div>
              <div>
                <Label>Téléphone 2</Label>
                <Input value={tel2} onChange={(e) => setTel2(e.target.value)} placeholder="Numéro secondaire" />
              </div>
            </div>
          </section>

          {/* === SECTION 3 : Adresses Dakar === */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold border-b border-border pb-2">3. Adresses Dakar</h3>
            <p className="text-xs text-muted-foreground -mt-2">Où Yobbanté dépose vos colis avant le départ.</p>
            <div className="space-y-3">
              <div>
                <Label>Adresse Dakar 1 *</Label>
                <Input value={adrDakar1} onChange={(e) => setAdrDakar1(e.target.value)} placeholder="Ex: Villa 45, HLM Grand Yoff" />
              </div>
              <div>
                <Label>Adresse Dakar 2</Label>
                <Input value={adrDakar2} onChange={(e) => setAdrDakar2(e.target.value)} placeholder="Adresse alternative" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Zone / Quartier *</Label>
                  <Select value={zoneDakar} onValueChange={setZoneDakar}>
                    <SelectTrigger><SelectValue placeholder="Choisir un quartier…" /></SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {QUARTIER_GROUPS.map(group => (
                        <SelectGroup key={group.label}>
                          <SelectLabel className="text-[11px]">{group.label}</SelectLabel>
                          {group.quartiers.map(q => (
                            <SelectItem key={q} value={q}>{q}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Créneau disponibilité Dakar</Label>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {DAKAR_CRENEAUX.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={creneauDakar.includes(c.id)}
                          onCheckedChange={() => toggleCreneau(c.id)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === SECTION 4 : Navettes === */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold border-b border-border pb-2">4. Navettes et villes desservies</h3>
            <NavettesEditor value={navettes} onChange={setNavettes} />
          </section>

          {/* === SECTION 5 : Tarification === */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold border-b border-border pb-2">5. Tarification</h3>
            <div>
              <Label>Tarif par défaut (XOF/kg)</Label>
              <Input
                type="number" inputMode="numeric" min={0}
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="Ex: 5000"
                className="max-w-[200px]"
              />
            </div>
            {citiesFromNavettes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Tarifs par ville (Dakar → ville)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {citiesFromNavettes.map(city => (
                    <div key={city} className="flex items-center gap-2">
                      <span className="text-sm w-32 truncate">{city}</span>
                      <Input
                        type="number" inputMode="numeric" min={0}
                        value={ratesPerCity[city] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value);
                          setRatesPerCity(prev => {
                            const next = { ...prev };
                            if (v === undefined || !Number.isFinite(v)) delete next[city];
                            else next[city] = v;
                            return next;
                          });
                        }}
                        placeholder="XOF/kg"
                        className="h-8 flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* === SECTION 6 : Notes internes === */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold border-b border-border pb-2">6. Notes internes</h3>
            <p className="text-xs text-muted-foreground -mt-2">Visibles par l'admin uniquement.</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </section>

          <div className="flex gap-2 pt-3 sticky bottom-0 bg-background pb-3 border-t border-border">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

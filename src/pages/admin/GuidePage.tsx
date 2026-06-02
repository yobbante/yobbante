import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Copy, Check, Printer, Search, ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ---------- Types ----------
type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; text: string; label?: string }
  | { kind: "callout"; tone: "info" | "warn" | "danger" | "ok"; text: string }
  | { kind: "kv"; rows: Array<[string, string]> }
  | { kind: "h"; text: string };

interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  intro?: string;
  sections: Section[];
}

// ---------- Content ----------
const CHAPTERS: Chapter[] = [
  {
    id: "dashboard",
    number: 1,
    title: "Tableau de bord",
    intro: "La page /admin est le centre nerveux. Tout commence ici.",
    sections: [
      {
        id: "dash-vue",
        title: "Vue globale et KPIs",
        blocks: [
          { kind: "p", text: "Le bandeau du haut affiche en temps reel les indicateurs critiques de la journee." },
          {
            kind: "kv",
            rows: [
              ["Dossiers actifs", "Tous statuts hors DELIVERED et CANCELLED"],
              ["En attente paiement", "Statut WEIGHED sans paiement client"],
              ["Departs semaine", "Tous les departs entre lundi et dimanche"],
              ["Revenus", "Somme des paiements clients confirmes"],
              ["Marge brute", "Revenus - cout GP - frais hub"],
            ],
          },
        ],
      },
      {
        id: "dash-alertes",
        title: "Alertes et codes couleur",
        blocks: [
          {
            kind: "list",
            items: [
              "Vert : tout est OK, aucune action requise.",
              "Ambre #F5C518 : action recommandee dans la journee.",
              "Rouge : action critique, depasse les SLA (4h pesee, 24h paiement).",
            ],
          },
          { kind: "callout", tone: "info", text: "Cliquez sur une alerte pour ouvrir directement le dossier concerne." },
        ],
      },
      {
        id: "dash-nav",
        title: "Navigation rapide",
        blocks: [
          {
            kind: "list",
            items: [
              "Inbox : nouveaux dossiers a traiter.",
              "Dossiers : tous les dossiers, filtrables par statut.",
              "Departs : planning hebdomadaire.",
              "GP : annuaire et tarifs.",
              "Messages : WhatsApp clients / GP / onboarding.",
              "Finances : revenus, marges, paiements GP.",
              "Audit : journal et mode test.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "dossiers",
    number: 2,
    title: "Gestion des dossiers",
    sections: [
      {
        id: "dos-create",
        title: "Creer un dossier manuellement",
        blocks: [
          { kind: "p", text: "Bouton + Nouveau dossier en haut a droite. Saisir au minimum : client, origine, destination, type de colis." },
          { kind: "callout", tone: "info", text: "Le tracking_id YOB-XXXXXX est genere automatiquement." },
        ],
      },
      {
        id: "dos-statuts",
        title: "Les statuts dans l'ordre",
        blocks: [
          {
            kind: "list",
            items: [
              "SUBMITTED : dossier cree, en attente d'assignation.",
              "ASSIGNED : GP + depart attribues.",
              "COLLECTED : colis recupere par le GP.",
              "WEIGHED : poids enregistre, prix calcule.",
              "IN_TRANSIT : colis en route.",
              "ARRIVED_HUB : recu au hub destination.",
              "DELIVERED : remis au destinataire.",
            ],
          },
          { kind: "callout", tone: "warn", text: "Les transitions sont strictement vers l'avant. Aucun retour en arriere n'est autorise." },
        ],
      },
      {
        id: "dos-assign",
        title: "Assigner un GP et un depart",
        blocks: [
          { kind: "p", text: "Depuis l'inbox ou la fiche dossier : bouton Assigner. Choisir un depart actif, puis un GP disponible." },
          { kind: "p", text: "Une notification WhatsApp est envoyee automatiquement au client et au GP." },
        ],
      },
      {
        id: "dos-reassign",
        title: "Changer de GP ou de depart",
        blocks: [
          { kind: "p", text: "Tant que le statut est ASSIGNED ou COLLECTED, vous pouvez re-assigner depuis la fiche dossier." },
          { kind: "callout", tone: "warn", text: "Apres COLLECTED, prevenir manuellement les deux GP par WhatsApp." },
        ],
      },
      {
        id: "dos-pesee",
        title: "Workflow pesee et paiement",
        blocks: [
          {
            kind: "list",
            items: [
              "1. GP envoie POIDS YOB-XXXX 4.5kg au bot 122.",
              "2. Le statut passe a WEIGHED et le prix est calcule.",
              "3. Une demande de paiement Wave/OM est envoyee au client.",
              "4. Apres paiement, le dossier passe en IN_TRANSIT.",
            ],
          },
          { kind: "callout", tone: "warn", text: "Si aucun poids 4h apres COLLECTED, alerte automatique et possibilite de saisie manuelle." },
        ],
      },
      {
        id: "dos-bloc",
        title: "Blocages et deblocages",
        blocks: [
          { kind: "p", text: "Onglet Blocages dans la fiche dossier. Permet de mettre en pause toute notification automatique." },
          { kind: "p", text: "Utile en cas de litige client ou de probleme douane." },
        ],
      },
      {
        id: "dos-cancel",
        title: "Annuler un dossier",
        blocks: [
          { kind: "p", text: "Bouton Annuler en bas de la fiche. Demande confirmation et raison." },
          { kind: "callout", tone: "danger", text: "Action irreversible. Si paiement deja recu, gerer le remboursement manuellement." },
        ],
      },
    ],
  },
  {
    id: "departs",
    number: 3,
    title: "Gestion des departs",
    sections: [
      {
        id: "dep-create",
        title: "Creer un depart manuel",
        blocks: [
          { kind: "p", text: "Page /admin/departs-semaine, bouton + Nouveau depart." },
          { kind: "p", text: "Renseigner : GP, date depart, ville origine, ville destination, capacite kg." },
        ],
      },
      {
        id: "dep-semaine",
        title: "Departs de la semaine",
        blocks: [
          { kind: "p", text: "Vue calendrier lundi-dimanche. Chaque carte montre GP, route, capacite restante et dossiers attaches." },
        ],
      },
      {
        id: "dep-capa",
        title: "Capacite et suivi temps reel",
        blocks: [
          {
            kind: "kv",
            rows: [
              ["Vert", "moins de 70% rempli"],
              ["Ambre", "70-95%"],
              ["Rouge", "plus de 95% ou depasse"],
            ],
          },
        ],
      },
      {
        id: "dep-status",
        title: "Publier les departs WhatsApp Status",
        blocks: [
          { kind: "p", text: "Bouton Publier WhatsApp Status genere une image et un texte pretes a poster." },
          { kind: "callout", tone: "info", text: "Routine 8h30 chaque matin." },
        ],
      },
      {
        id: "dep-import",
        title: "Importer un depart depuis WhatsApp",
        blocks: [
          { kind: "p", text: "Page /admin/inbox/import : coller le message WhatsApp brut. Le parseur extrait GP, dates, route et capacite." },
        ],
      },
    ],
  },
  {
    id: "gp",
    number: 4,
    title: "Gestion des GP",
    sections: [
      {
        id: "gp-add",
        title: "Ajouter un nouveau GP",
        blocks: [
          { kind: "p", text: "Onglet GP, bouton + Nouveau GP. Saisir nom, prenom, telephone WhatsApp, routes habituelles." },
        ],
      },
      {
        id: "gp-fiche",
        title: "Fiche GP complete",
        blocks: [
          {
            kind: "list",
            items: [
              "Identite et contacts.",
              "Tarifs par route et par kg.",
              "Historique de depart et dossiers.",
              "Statistiques : note moyenne, fiabilite, marge.",
            ],
          },
        ],
      },
      {
        id: "gp-url",
        title: "URL depart personnalisee",
        blocks: [
          { kind: "p", text: "Chaque GP a une URL /gp/depart/{ref} qu'il utilise pour saisir un nouveau depart depuis son telephone." },
        ],
      },
      {
        id: "gp-onb",
        title: "Onboarding bot WhatsApp",
        blocks: [
          { kind: "p", text: "Bouton Lancer onboarding declenche un flow guide sur WhatsApp pour collecter routes, tarifs et IBAN." },
        ],
      },
      {
        id: "gp-konnekt",
        title: "Invitation Konnekt",
        blocks: [
          { kind: "p", text: "Envoyer le lien d'inscription Konnekt pour activer le suivi avance et les paiements." },
        ],
      },
      {
        id: "gp-tarifs",
        title: "Tarifs GP et calcul marge",
        blocks: [
          { kind: "p", text: "Marge = Prix client - Tarif GP - Frais hub. Affichee en direct dans la fiche dossier." },
        ],
      },
    ],
  },
  {
    id: "messagerie",
    number: 5,
    title: "Messagerie",
    sections: [
      {
        id: "msg-tabs",
        title: "Onglets Clients / GP / Onboarding",
        blocks: [
          { kind: "p", text: "Chaque onglet filtre les conversations par type. Un compteur de non-lus apparait a cote du titre." },
        ],
      },
      {
        id: "msg-24h",
        title: "Fenetre 24h WhatsApp",
        blocks: [
          { kind: "callout", tone: "warn", text: "Hors fenetre 24h, vous ne pouvez envoyer qu'un template valide. Sinon le message est rejete par Meta." },
        ],
      },
      {
        id: "msg-libre",
        title: "Message libre vs Templates",
        blocks: [
          {
            kind: "list",
            items: [
              "Message libre : possible uniquement dans la fenetre 24h apres reponse client.",
              "Template : utilisable hors fenetre, doit etre approuve.",
            ],
          },
        ],
      },
      {
        id: "msg-vars",
        title: "Variables auto-remplies",
        blocks: [
          { kind: "code", text: "{{prenom}}\n{{tracking}}\n{{origine_ville}}\n{{destination_ville}}\n{{poids}}\n{{prix}}", label: "Variables disponibles" },
        ],
      },
      {
        id: "msg-new",
        title: "Nouveau message vers un client",
        blocks: [
          { kind: "p", text: "Bouton + Nouveau message. Rechercher un client par nom ou telephone, choisir un template, envoyer." },
        ],
      },
      {
        id: "msg-link",
        title: "Lier un dossier a une conversation",
        blocks: [
          { kind: "p", text: "Dans une conversation, bouton Lier dossier. Permet d'avoir les variables auto-remplies." },
        ],
      },
    ],
  },
  {
    id: "superadmin",
    number: 6,
    title: "Super Admin WhatsApp",
    intro: "Centre de commande WhatsApp. Reservees au numero +221 78 460 40 03.",
    sections: [
      {
        id: "sa-cmds",
        title: "Commandes disponibles",
        blocks: [
          { kind: "code", text: "STATUS", label: "Resume instantane" },
          { kind: "code", text: "DEPARTS", label: "Liste departs actifs" },
          { kind: "code", text: "DOSSIERS", label: "Liste dossiers actifs" },
          { kind: "code", text: "PAIEMENTS", label: "Paiements en attente" },
          { kind: "code", text: "DOSSIER YOB-9KPR4A", label: "Detail d'un dossier" },
          { kind: "code", text: "MSG YOB-9KPR4A Bonjour, votre colis arrive demain.", label: "Envoyer un message au client" },
          { kind: "code", text: "ASSIGNE YOB-9KPR4A GP-042", label: "Assigner un GP" },
          { kind: "code", text: "RELANCE YOB-9KPR4A", label: "Relancer le client" },
          { kind: "code", text: "R YOB-9KPR4A  (recue)\nT YOB-9KPR4A  (en transit)\nL YOB-9KPR4A  (livree)\nC YOB-9KPR4A  (collectee)", label: "Transitions rapides" },
        ],
      },
      {
        id: "sa-routines",
        title: "Rapports automatiques",
        blocks: [
          {
            kind: "list",
            items: [
              "8h00 : rapport STATUS du jour.",
              "Alertes intelligentes 4h apres COLLECTED sans poids.",
              "Alerte 24h apres WEIGHED sans paiement.",
            ],
          },
        ],
      },
      {
        id: "sa-secu",
        title: "Securite",
        blocks: [
          { kind: "callout", tone: "danger", text: "Toute commande recue d'un autre numero est ignoree silencieusement. Verification stricte du sender == 221784604003." },
        ],
      },
    ],
  },
  {
    id: "finances",
    number: 7,
    title: "Finances",
    sections: [
      {
        id: "fin-kpi",
        title: "KPIs revenus et marges",
        blocks: [
          { kind: "p", text: "Vue mensuelle : CA encaisse, marge brute, marge nette apres frais." },
        ],
      },
      {
        id: "fin-gp",
        title: "Paiements GP en attente",
        blocks: [
          { kind: "p", text: "Liste des GP a payer. Bouton Marquer paye sur chaque ligne." },
        ],
      },
      {
        id: "fin-fact",
        title: "Generation factures",
        blocks: [
          { kind: "p", text: "Bouton Generer facture dans la fiche dossier. PDF avec numero unique." },
        ],
      },
      {
        id: "fin-export",
        title: "Export donnees",
        blocks: [
          { kind: "p", text: "Boutons Export CSV / Export Excel disponibles sur chaque vue tabulaire." },
        ],
      },
    ],
  },
  {
    id: "boutique",
    number: 8,
    title: "Boutique DEKK",
    sections: [
      {
        id: "btq-acces",
        title: "Acces /admin/boutique",
        blocks: [
          { kind: "p", text: "Section dediee a la gestion du catalogue DEKK." },
        ],
      },
      {
        id: "btq-add",
        title: "Ajouter un produit",
        blocks: [
          { kind: "p", text: "Bouton + Produit. Saisir titre, photos, prix, stock, description, categorie." },
        ],
      },
      {
        id: "btq-cat",
        title: "Gerer le catalogue",
        blocks: [
          { kind: "p", text: "Actions en lot : publier, depublier, supprimer, dupliquer." },
        ],
      },
    ],
  },
  {
    id: "audit",
    number: 9,
    title: "Mode test et audit",
    sections: [
      {
        id: "aud-acces",
        title: "Acces /admin/dossiers?tab=audit",
        blocks: [
          { kind: "p", text: "Onglet Audit visible uniquement au super admin." },
        ],
      },
      {
        id: "aud-journal",
        title: "Journal d'audit temps reel",
        blocks: [
          { kind: "p", text: "Liste de toutes les actions systeme et utilisateurs avec horodatage." },
        ],
      },
      {
        id: "aud-tests",
        title: "Les 4 actions de test",
        blocks: [
          {
            kind: "list",
            items: [
              "Creer dossier test.",
              "Simuler depart.",
              "Simuler paiement client.",
              "Simuler livraison.",
            ],
          },
        ],
      },
      {
        id: "aud-scenario",
        title: "Run Scenario complet",
        blocks: [
          { kind: "p", text: "Bouton Lancer scenario : execute les 4 actions en sequence pour valider la chaine complete." },
        ],
      },
      {
        id: "aud-launch",
        title: "Validation avant launch",
        blocks: [
          { kind: "callout", tone: "ok", text: "Lancer Run Scenario sur tous les environnements avant chaque mise en production." },
        ],
      },
    ],
  },
  {
    id: "notifs",
    number: 10,
    title: "Notifications",
    sections: [
      {
        id: "not-auto",
        title: "Les 9 notifications automatiques",
        blocks: [
          {
            kind: "list",
            items: [
              "Confirmation creation dossier.",
              "Confirmation assignation.",
              "Notification collecte.",
              "Demande de poids au GP.",
              "Demande de paiement client.",
              "Confirmation paiement.",
              "Notification depart.",
              "Notification arrivee hub.",
              "Notification livraison + demande avis.",
            ],
          },
        ],
      },
      {
        id: "not-anti",
        title: "Anti-doublons",
        blocks: [
          { kind: "p", text: "Chaque notification est tracee. Un meme evenement ne sera jamais envoye deux fois." },
        ],
      },
      {
        id: "not-btn",
        title: "Boutons interactifs WhatsApp",
        blocks: [
          { kind: "p", text: "Les notifications client incluent des boutons rapides : Confirmer, Probleme, Voir suivi." },
        ],
      },
      {
        id: "not-avis",
        title: "Gestion des avis clients",
        blocks: [
          { kind: "p", text: "Lien /avis/{tracking} envoye apres livraison. Note de 1 a 5 + commentaire." },
        ],
      },
    ],
  },
  {
    id: "bot607",
    number: 11,
    title: "Bot client 607",
    sections: [
      {
        id: "bot-flow",
        title: "Flow departs / suivi / expedition",
        blocks: [
          { kind: "p", text: "Le bot 607 accueille les clients et propose un menu : Suivre un colis, Voir les departs, Expedier." },
        ],
      },
      {
        id: "bot-btn",
        title: "Boutons interactifs",
        blocks: [
          { kind: "p", text: "Reponses en un clic pour fluidifier le parcours." },
        ],
      },
      {
        id: "bot-esc",
        title: "Escalade agent",
        blocks: [
          { kind: "p", text: "Bouton Parler a un agent ou apres 3 incomprehensions, transfert vers la messagerie admin." },
        ],
      },
      {
        id: "bot-konnekt",
        title: "Inscriptions Konnekt",
        blocks: [
          { kind: "p", text: "Si le client est un GP potentiel, le bot propose l'inscription Konnekt." },
        ],
      },
    ],
  },
  {
    id: "routines",
    number: 12,
    title: "Routines quotidiennes",
    sections: [
      {
        id: "rou-day",
        title: "Planning type",
        blocks: [
          {
            kind: "kv",
            rows: [
              ["8h00", "Rapport WhatsApp STATUS"],
              ["8h15", "Revue dossiers admin"],
              ["8h30", "Publication departs WhatsApp Status"],
              ["12h00", "Traitement messages non traites"],
              ["18h00", "Validation des collectes du jour"],
              ["20h00", "Bilan du soir : revenus, alertes residuelles"],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "launch",
    number: 13,
    title: "Checklist launch",
    sections: [
      {
        id: "ln-tests",
        title: "Tests obligatoires",
        blocks: [
          {
            kind: "list",
            items: [
              "Run Scenario sur environnement test.",
              "Verifier reception WhatsApp sur les 3 numeros (607, 122, super admin).",
              "Valider paiement Wave + OM bout en bout.",
              "Tester la fenetre 24h et les templates.",
            ],
          },
        ],
      },
      {
        id: "ln-secu",
        title: "Verifications securite",
        blocks: [
          {
            kind: "list",
            items: [
              "RLS active sur toutes les tables sensibles.",
              "Aucune cle privee dans le client.",
              "Roles : super admin verrouille au numero unique.",
            ],
          },
        ],
      },
      {
        id: "ln-irrev",
        title: "Actions irreversibles a eviter",
        blocks: [
          { kind: "callout", tone: "danger", text: "Suppression dossier, suppression GP, suppression depart : toujours preferer l'archivage." },
        ],
      },
    ],
  },
];

// ---------- Helpers ----------
function CodeBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copie dans le presse-papiers");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-3 rounded-lg border border-border bg-muted/40">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <button
            onClick={onCopy}
            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors print:hidden"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copie" : "Copier"}
          </button>
        </div>
      )}
      <pre className="px-3 py-2.5 text-sm font-mono whitespace-pre-wrap text-foreground">{text}</pre>
    </div>
  );
}

function Callout({ tone, text }: { tone: "info" | "warn" | "danger" | "ok"; text: string }) {
  const styles: Record<typeof tone, string> = {
    info: "border-l-primary bg-primary/5 text-foreground",
    warn: "border-l-[#F5C518] bg-[#F5C518]/5 text-foreground",
    danger: "border-l-destructive bg-destructive/5 text-foreground",
    ok: "border-l-green-500 bg-green-500/5 text-foreground",
  } as const;
  return (
    <div className={`my-3 border-l-4 px-3 py-2 rounded-r-md text-sm ${styles[tone]}`}>{text}</div>
  );
}

function renderBlock(b: Block, idx: number) {
  switch (b.kind) {
    case "p":
      return <p key={idx} className="text-sm leading-relaxed text-muted-foreground my-2">{b.text}</p>;
    case "h":
      return <h4 key={idx} className="text-sm font-semibold mt-3 mb-1 text-foreground">{b.text}</h4>;
    case "list":
      return (
        <ul key={idx} className="list-disc pl-5 space-y-1 my-2 text-sm text-muted-foreground">
          {b.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    case "code":
      return <CodeBlock key={idx} text={b.text} label={b.label} />;
    case "callout":
      return <Callout key={idx} tone={b.tone} text={b.text} />;
    case "kv":
      return (
        <div key={idx} className="my-3 rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {b.rows.map(([k, v], i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium bg-muted/40 w-1/3 align-top">{k}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "p":
    case "h":
      return b.text;
    case "list":
      return b.items.join(" ");
    case "code":
      return `${b.label ?? ""} ${b.text}`;
    case "callout":
      return b.text;
    case "kv":
      return b.rows.map(([k, v]) => `${k} ${v}`).join(" ");
  }
}

// ---------- Page ----------
export default function GuidePage() {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHAPTERS.map((c) => [c.id, true]))
  );
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Guide operateur · YOBBANTE";
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CHAPTERS;
    return CHAPTERS.map((c) => {
      const sections = c.sections.filter((s) => {
        if (s.title.toLowerCase().includes(needle)) return true;
        return s.blocks.some((b) => blockText(b).toLowerCase().includes(needle));
      });
      const hit = c.title.toLowerCase().includes(needle) || sections.length > 0;
      return hit ? { ...c, sections: sections.length ? sections : c.sections } : null;
    }).filter(Boolean) as Chapter[];
  }, [q]);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const expandAll = () => setOpen(Object.fromEntries(CHAPTERS.map((c) => [c.id, true])));
  const collapseAll = () => setOpen(Object.fromEntries(CHAPTERS.map((c) => [c.id, false])));

  const jumpTo = (chapterId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    setOpen((o) => ({ ...o, [chapterId]: true }));
    requestAnimationFrame(() => {
      const el = document.getElementById(`chapter-trigger-${chapterId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.focus({ preventScroll: true });
      }
    });
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/admin" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <BookOpen className="h-5 w-5 text-[#F5C518]" />
            <h1 className="text-lg font-semibold">Guide operateur</h1>
            <Badge className="bg-[#F5C518] text-black hover:bg-[#F5C518]">v1.0</Badge>
          </div>
          <div className="flex-1" />
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher dans le guide..."
              className="pl-8 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> PDF
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Mobile search */}
        <div className="md:hidden mb-4 print:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8"
            />
          </div>
        </div>

        {/* Intro */}
        <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-[#F5C518]/10 to-transparent p-5">
          <h2 className="text-xl font-semibold mb-1">Guide complet YOBBANTE</h2>
          <p className="text-sm text-muted-foreground">
            Toutes les fonctionnalites de la plateforme d'orchestration logistique. Utilisez la
            recherche, le sommaire ou imprimez en PDF pour une consultation hors-ligne.
          </p>
          <div className="flex gap-2 mt-3 print:hidden">
            <Button size="sm" variant="outline" onClick={expandAll}>Tout deplier</Button>
            <Button size="sm" variant="outline" onClick={collapseAll}>Tout replier</Button>
          </div>
        </div>

        {/* Sommaire */}
        <nav className="mb-8 rounded-xl border border-border p-4" aria-labelledby="sommaire-title">
          <h3 id="sommaire-title" className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Sommaire</h3>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  onClick={(e) => jumpTo(c.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') jumpTo(c.id, e);
                  }}
                  className="inline-flex items-baseline rounded px-1 -mx-1 hover:text-[#F5C518] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
                >
                  <span className="text-muted-foreground mr-2 font-mono">{String(c.number).padStart(2, "0")}</span>
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Chapters */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12" role="status">Aucun resultat pour "{q}".</p>
          )}
          {filtered.map((c) => {
            const isOpen = open[c.id] ?? true;
            const panelId = `chapter-panel-${c.id}`;
            const triggerId = `chapter-trigger-${c.id}`;
            const showContent = isOpen || !!q;
            return (
              <section
                key={c.id}
                id={c.id}
                aria-labelledby={triggerId}
                className="rounded-xl border border-border overflow-hidden scroll-mt-20"
              >
                <h2 className="m-0">
                  <button
                    id={triggerId}
                    onClick={() => toggle(c.id)}
                    aria-expanded={showContent}
                    aria-controls={panelId}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left print:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F5C518]"
                  >
                    {isOpen ? <ChevronDown aria-hidden="true" className="h-4 w-4 text-[#F5C518]" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#F5C518]" />}
                    <span className="text-xs font-mono text-muted-foreground">CH.{String(c.number).padStart(2, "0")}</span>
                    <span className="text-base font-semibold flex-1">{c.title}</span>
                    <span className="sr-only">{showContent ? 'Replier' : 'Déplier'} le chapitre</span>
                  </button>
                </h2>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  hidden={!showContent}
                >
                  {showContent && (
                    <div className="p-4 space-y-5">
                      {c.intro && <p className="text-sm text-muted-foreground italic">{c.intro}</p>}
                      {c.sections.map((s) => (
                        <div key={s.id} id={s.id} className="scroll-mt-20">
                          <h3 className="text-sm font-semibold text-foreground border-l-2 border-[#F5C518] pl-2 mb-1">
                            {s.title}
                          </h3>
                          <div>{s.blocks.map(renderBlock)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>


        <footer className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground text-center print:hidden">
          YOBBANTE · Guide operateur · {CHAPTERS.length} chapitres ·{" "}
          {CHAPTERS.reduce((n, c) => n + c.sections.length, 0)} sections documentees
        </footer>
      </div>

      <style>{`
        @media print {
          header.sticky { display: none !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

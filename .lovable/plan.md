
# Refonte "Demandes entrantes" — flow expédition Yobbanté

Cible : `/admin/dossiers?tab=demandes`. Filtre déjà actif sur `detectServiceKind === 'envoi'`. On garde ce filtre comme socle.

L'envergure (11 parties dans le brief) est trop grande pour un seul passage propre. Je propose 4 lots livrables indépendamment, chacun testable et déployable. Tu peux valider lot par lot, ou tout enchaîner.

---

## Lot 1 — Fondations visibles (UI + filtres + temps réel)

Objectif : la page change immédiatement de visage, sans nouvelle logique métier.

- **KPIs temps réel** : 4 cartes (Nouveau / À traiter / Attente client / Confirmés) branchées sur `useAdminRealtime` (déjà singleton) + couleurs sémantiques (bleu/orange/jaune/vert), badge si > 0.
- **Filtres intelligents** : barre de chips repliable
  - Canal (WhatsApp 607, Site, Instagram, Facebook, Appel, Email, Walk-in, Reco, Konnekt)
  - Statut (Nouveau, À assigner, GP assigné, Attente paiement, Payé, Collecte, Transit, Livré, Annulé)
  - Destination (top 6 + "Autre")
  - Transporteur (GP Yobbanté, Konnekt, DHL, FedEx, Autre)
  - Urgence (Urgent +48h, Normal)
  - Recherche libre (déjà présente, élargie)
- **Toggle Kanban / Liste** en haut.
- **Vue Liste enrichie** : tableau triable, sélection multiple, actions de masse (assigner GP, WhatsApp groupé, changer statut, export CSV).
- **Card Kanban revisitée** : code couleur par âge (rouge >48h, orange >24h, vert OK, bleu si Konnekt), badges canal/dest/transporteur, GP + départ visibles.
- **État vide** : illustration + 2 CTAs (copier `yobbante.com/expedier` / créer dossier).
- **Badge sidebar** "Demandes entrantes ({n})" pour dossiers non traités.
- **Toast realtime** sur nouveau dossier (déjà partiellement géré dans `useAdminRealtime`, on étend avec bouton "Traiter →").

Fichiers principaux : `InboxTab.tsx`, `InboxKpiCards.tsx`, `InboxFilters.tsx`, `InboxCard.tsx`, nouvelle `InboxListView.tsx`, `DossiersHubTab.tsx` (badge).

## Lot 2 — Kanban 5 colonnes + drag & drop + drawer

- **5 colonnes** au lieu de 3 : Nouveau / À assigner / GP Assigné / Prêt au départ / En transit
  - Mapping statut → colonne basé sur `status`, `gp_id`, `payment_status`, `assigned_departure_id`, `collecte_creneau`.
- **Drag & drop** entre colonnes via `@dnd-kit/core` (déjà utilisé dans le projet pour Réception ; sinon on l'ajoute).
  - Drop = mutation Supabase + toast + invalidation realtime.
  - Transitions invalides bloquées (pas de retour arrière).
- **Drawer latéral 5 onglets** (Aperçu / Transport / Paiement / Messages / Documents)
  - Réutilise au max l'existant `AdminDossierSheet`. On enrichit avec les 5 onglets.
  - Onglet Aperçu : timeline verticale, infos expéditeur (+ historique nb dossiers), destinataire, colis.
  - Onglet Transport : sections conditionnelles GP Yobbanté / Konnekt / Carrier externe, boutons assigner / changer / détacher / wa.me fallback.
  - Onglet Paiement : breakdown TTC, statut, bouton relancer paiement (WhatsApp auto), bloc paiement GP.
  - Onglet Messages : historique `dossier_messages` + templates rapides + envoi via edge function.
  - Onglet Documents : upload + liens `/suivre`, `/pay`, `/recu`.

Fichiers : nouveau `InboxKanban.tsx`, refonte `dossier-sheet/AdminDossierSheet.tsx` (ajout onglets), nouveaux composants `drawer/Tab*.tsx`.

## Lot 3 — Création manuelle 4 étapes + Import Excel

- **NewIntakeDialog** refait en wizard 4 étapes (Client / Expédition / Transport / Récap)
  - Étape 1 : autocomplétion téléphone via `profiles` + affichage historique dossiers.
  - Étape 2 : prix TTC calculé temps réel (`pricingEngine` existant), zone collecte (centre/banlieue +5k/hors +10k).
  - Étape 3 : choix transporteur (GP / Konnekt / Externe) + liste départs dispo si GP.
  - Étape 4 : récap + mode paiement + bouton création → WhatsApp client + GP automatique.
- **Import Excel** (page existante `/admin/inbox/import` à étoffer) : template téléchargeable, validation ligne par ligne, rapport final.

Fichiers : `NewIntakeDialog.tsx` (refonte), `InboxImportPage.tsx` (template + validation).

## Lot 4 — Transfert Konnekt + finitions

- **Section "Transférer à Konnekt"** dans le drawer onglet Transport : liste des transporteurs Konnekt (profiles role=gp + flag konnekt), envoi mission via edge function 926.
- **Badge "Via Konnekt"** sur cards + header drawer.
- **Notifications admin** sur création par autre admin.
- Polish mobile-first drawer, ajustements design Yobbanté (dark + #F5C518).

---

## Choses **explicitement hors scope** (BACKLOG, partie 11)

- Flow Sourcing (onglet dédié déjà séparé).
- Flow Réception (onglet dédié déjà séparé).

## Décisions techniques

- Le filtre `detectServiceKind === 'envoi'` reste la source de vérité (pas de migration `service_type` côté DB — la colonne n'existe pas actuellement).
- `dnd-kit` si déjà présent, sinon ajout.
- Realtime via le hook singleton `useAdminRealtime` déjà en place (pas de nouveau channel).
- Aucune migration de schéma nécessaire dans les Lots 1–2. Lot 3/4 pourraient nécessiter une colonne `intake_drafts` étendue ou rien.

## Question avant de démarrer

Veux-tu :
- **(A)** Que j'enchaîne directement les 4 lots dans la foulée (réponse longue, plusieurs centaines de lignes modifiées) ?
- **(B)** Que je livre **Lot 1 uniquement** maintenant, puis tu valides visuellement avant Lot 2 ?
- **(C)** Un autre découpage / priorité (ex. drag & drop d'abord, drawer après) ?

Mon conseil : **option B**. Le Lot 1 transforme déjà la page visiblement, et on évite un méga-diff impossible à QA.

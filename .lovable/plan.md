# Améliorations page Dossiers — Plan d'implémentation

Demande large (8 parties). Je propose ce plan séquencé. Le travail est principalement frontend : tri, badges, side drawer, templates, raccourcis. Une seule fonction WhatsApp existante est réutilisée (`send-whatsapp`).

## Fichiers principaux à toucher

- `src/components/admin/RequestsTab.tsx` — liste, tri DESC, badges NOUVEAU/URGENT, colonne GP, ouverture side drawer
- `src/components/admin/ReceptionKanbanTab.tsx` — menu contextuel `···` sur chaque carte
- `src/components/admin/dossier-sheet/AdminDossierSheet.tsx` — blocs Expéditeur/Destinataire en tête, bouton WhatsApp GP onglet Transport, 3 templates onglet Messages
- `src/components/admin/dossier-sheet/useDossierSheet.tsx` — ajouter mode "drawer latéral" sur desktop (40%) vs sheet plein écran mobile
- `src/components/admin/OverviewTab.tsx` — barre d'alertes en haut (4 compteurs)
- Nouveaux helpers :
  - `src/components/admin/dossiers/ContactBlock.tsx` (réutilisable expéditeur/destinataire)
  - `src/components/admin/dossiers/GpAssignBadge.tsx`
  - `src/components/admin/dossiers/QuickAssignGpDialog.tsx` (sélecteur rapide)
  - `src/components/admin/dossiers/DossierAlertsBar.tsx`
  - `src/lib/dossierBadges.ts` (logique NOUVEAU/URGENT)
  - `src/lib/clientTemplates.ts` (3 templates)

## Détail par partie

### P1 — Tri + badges
- `dossiers` triés par `created_at DESC` (déjà le cas dans `useDossiers`, vérifier `RequestsTab`).
- Badge vert "NOUVEAU" si `now - created_at < 24h`.
- Badge rouge "URGENT" si :
  - `status === 'SUBMITTED'` ET âge > 48h
  - `status === 'CONFIRMED'` ET pas de GP ET âge > 24h
  - `assigned_departure_id` présent ET `departure_date - now < 48h`

### P2 — Colonne GP
- Lookup GP : `dossiers.assigned_transporteur_ref` → `transporteurs` (photo, prénom).
- Si null → bouton orange "⚠ À assigner" → ouvre `QuickAssignGpDialog` directement (sans ouvrir la fiche).

### P3 — Blocs contacts en tête de fiche
- En tête de `AdminDossierSheet` (avant Tabs), 2 cartes :
  - Expéditeur : `sender_name`, `sender_phone`, `sender_address`
  - Destinataire : `recipient_name`, `recipient_phone`, `recipient_address` + ville/pays
- Boutons : Appeler (`tel:`), WhatsApp (envoi via send-whatsapp, fallback wa.me), Copier (clipboard + toast).

### P4 — Bouton WhatsApp GP (onglet Transport)
- Après assignation, bouton vert "Envoyer WhatsApp au GP".
- Message templaté en français (sans accents) avec tracking_id, route, client, poids, adresse collecte, date.
- Appelle `sendGpMessage` (déjà existant, gère fallback wa.me).
- Affiche "Notifié le {date}" si `gp_reminded_at` ou un event log dédié existe.

### P5 — Templates messages (onglet Messages)
- 3 boutons au-dessus de la zone de saisie qui pré-remplissent le textarea.
- Variables remplacées : `{prenom}`, `{tracking_id}`, `{origin}`, `{destination}`, `{statut_label}`.
- Envoi via `send-whatsapp` depuis le 607.

### P6 — Side drawer persistant
- Sur desktop (≥ md) : panel droit 40% qui ne bloque pas la liste.
- Sur mobile : reste plein écran (comportement actuel).
- Contenu : blocs contacts, statut+dropdown, GP+WhatsApp, timeline compacte (5 derniers `dossier_events`), 3 boutons rapides, lien "Ouvrir la fiche complète →" (route dossier détail).
- Implémentation : remplacer `Sheet` actuel par un layout responsive — sur desktop un aside fixe à droite avec `lg:w-[40%]` ; sur mobile garde `Sheet` plein écran.

### P7 — Menu Kanban
- Sur `ReceptionKanbanTab`, sur chaque `InboxCard` (ou équivalent) : `DropdownMenu` avec icône `MoreVertical` :
  - Changer statut (sous-menu)
  - Assigner GP (ouvre `QuickAssignGpDialog`)
  - WhatsApp GP (direct via `sendGpMessage` si GP assigné, sinon disabled)
  - Voir la fiche (ouvre dossier-sheet)

### P8 — Barre d'alertes /admin
- En haut de `OverviewTab` : 4 compteurs (requêtes ciblées Supabase).
  - SUBMITTED > 48h : filter dossiers
  - CONFIRMED sans GP, departure dans 24h : ouvre GpOperationsTab
  - Messages non lus : ouvre /admin/messages
  - Paiements en attente > 48h (`payment_status='pending'`) : ouvre Revenus
- Composant masqué si total = 0.

## Contraintes respectées
- Aucune route modifiée
- Couleurs/typo existantes (semantic tokens + `#F5C518` pour primary)
- Mobile-first (sheet plein écran préservé)
- WhatsApp via `send-whatsapp` avec fallback wa.me (helper `sendGpMessage` déjà en place)
- Textes français sans accents dans les messages WhatsApp sortants

## Hors scope
- Pas de changement schéma DB (toutes les colonnes existent)
- Pas de nouvelles edge functions
- Pas de modif du bot 607/122

Si OK je commence par les parties 1, 2, 3, 5 (gain immédiat opérateur), puis 4, 6, 7, 8.

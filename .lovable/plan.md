# Système d'intake multi-canaux — Points 1 à 3

Objectif : centraliser dans l'admin toutes les commandes (WhatsApp, appel, email, IG, FB, site) sans casser les flows existants (Send/Receive/Sourcing) qui continueront simplement avec `source = 'site_web'` par défaut.

## 1) Migration Supabase

Une seule migration regroupant :

**`dossiers` — colonnes ajoutées**
- `source TEXT NOT NULL DEFAULT 'site_web'` + CHECK (`site_web`, `whatsapp`, `telephone`, `email`, `instagram`, `facebook`, `walk_in`, `referral`, `autre`)
- `source_reference TEXT`
- `intake_notes TEXT`
- `intake_by UUID` (références `auth.users` — non FK directe : on suit le pattern projet et utilise juste `uuid` lié logiquement)
- `intake_method TEXT DEFAULT 'self_service'` + CHECK (`self_service`, `manual_intake`)

Note : `dossier_status` enum existant utilise `SUBMITTED/IN_REVIEW/...`. On va mapper logiquement pour l'Inbox :
- **À traiter** = `SUBMITTED` + `IN_REVIEW`
- **En attente client** = nouveau status pas nécessaire pour l'instant — on réutilise `IN_REVIEW` avec un flag, OU on étend l'enum. **Décision : étendre l'enum avec `AWAITING_CLIENT` et `CONFIRMED`** pour matcher la sémantique demandée. Les flows existants ne sont pas impactés (valeurs additives).

**Nouvelle table `legacy_dossiers`** (admin-only RLS via `is_staff`)

**Nouvelle table `intake_drafts`** (auto-save) — RLS : un user voit/modifie ses propres drafts ; staff voit tout.

## 2) Page `/admin/inbox`

- Nouvelle route ajoutée à `AdminPage` + entrée dans `AdminSidebar` tout en haut, intitulée "📬 Inbox".
- Composant `InboxTab.tsx` :
  - Header avec filtres (canal multi-select, type service, recherche client, opérateur) + bouton **+ Nouveau dossier**.
  - 3 colonnes Kanban responsives (mobile = onglets) :
    - 🔴 À traiter (`SUBMITTED`, `IN_REVIEW`)
    - 🟡 En attente client (`AWAITING_CLIENT`)
    - 🟢 Confirmés (`CONFIRMED`)
  - Composant `InboxCard.tsx` : nom client + ville, type (📦/🛒/📥 selon `needs_sourcing` / présence reception_order / défaut envoi), route origine→destination, **badge source coloré**, date, montant, avatar opérateur intake.
  - Actions rapides : Voir détail (réutilise `OrderDetailDrawer`), Envoyer récap WhatsApp (wa.me pré-rempli), Marquer confirmé (update status).

## 3) Formulaire "+ Nouveau dossier"

Composant `NewIntakeDialog.tsx` (drawer plein écran avec stepper 4 étapes) :

1. **Source** — radio gros boutons colorés + champ `source_reference` + note auto "Saisi le … par …"
2. **Client** — recherche autocomplete dans `profiles` (par nom/phone) OU formulaire "nouveau client" (crée profil minimal ou stocke en `contact_phone`/`contact_email`/notes sur le dossier si pas d'auth user — pour le MVP on stocke sur le dossier sans créer d'auth user)
3. **Service** — radio Envoi / Sourcing / Réception → champs conditionnels (origine/destination/poids/mode/desc pour envoi ; produit/pays/budget/quantité/URL pour sourcing ; origine/tracking/desc/valeur pour réception)
4. **Récap + Notes** — récap visuel, `intake_notes`, prix (calculé via `calculate_quote` RPC ou manuel), statut initial (`SUBMITTED` ou `CONFIRMED`)

**Boutons finaux :**
- *Enregistrer + Envoyer récap WhatsApp* — insert dossier puis ouvre `wa.me/<phone>?text=<récap+lien suivi+ref YBT-…>`
- *Enregistrer seulement*
- *Annuler*

**Auto-save** : hook `useIntakeDraft` qui upsert dans `intake_drafts` toutes les 10s ; reload propose de reprendre le brouillon au montage.

## Notes techniques

- Les flows existants (`SendFlow`, `ReceiveFlow`, `SourcingFlow`, `DossierWizard`, `useDossiers`) restent **inchangés** — la colonne `source` a default `'site_web'`, donc rétrocompatible.
- Pour le service "Réception", on crée un dossier classique avec `dossier_type='individual'` et notes spécifiques (les `reception_orders` restent pour le flow self-service ; l'intake manuel utilise `dossiers` pour simplicité MVP).
- Mapping type service dans Inbox :
  - 🛒 Sourcing si `needs_sourcing = true`
  - 📥 Réception si `intake_notes` ou meta contient marqueur (on ajoutera `service_kind` léger dans `intake_notes` JSON ou via tag — pour MVP on déduit du formulaire en stockant `[RECEPTION]` en préfixe de `product_description`)
- Légende couleurs sources (constante partagée `INTAKE_SOURCES`) :
  - whatsapp = vert #25D366, site_web = bleu primary, telephone = orange, email = violet, instagram = rose, facebook = bleu FB, walk_in = gris, referral = jaune, autre = neutre

## Fichiers créés / modifiés

**Migration** : 1 fichier (alter dossiers + create legacy_dossiers + create intake_drafts + RLS + extend enum)

**Nouveaux** :
- `src/lib/intakeSources.ts` (constantes + couleurs)
- `src/hooks/useIntakeDraft.ts`
- `src/hooks/useInboxDossiers.ts`
- `src/components/admin/inbox/InboxTab.tsx`
- `src/components/admin/inbox/InboxCard.tsx`
- `src/components/admin/inbox/InboxFilters.tsx`
- `src/components/admin/inbox/NewIntakeDialog.tsx`
- `src/components/admin/inbox/steps/StepSource.tsx`
- `src/components/admin/inbox/steps/StepClient.tsx`
- `src/components/admin/inbox/steps/StepService.tsx`
- `src/components/admin/inbox/steps/StepRecap.tsx`

**Modifiés** :
- `src/components/admin/AdminSidebar.tsx` (entrée Inbox en haut)
- `src/pages/AdminPage.tsx` (route /admin/inbox)
- `src/lib/types.ts` (étendre `DossierStatus` + ajouter `IntakeSource`, étendre interface `Dossier`)

**Inchangés** : tous les flows publics, `useDossiers`, `DossierWizard`, `SendFlow`, `ReceiveFlow`, `SourcingFlow`.

Confirme-moi pour lancer la migration et l'implémentation.

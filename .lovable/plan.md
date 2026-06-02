## Audit du dashboard client /app

### Déjà en place ✅
- **Confirmer / Refuser le départ** : composant `ClientDepartureDecision` (avec realtime, RPC `client_decide_departure`, dialogs raison/date plus proche, notifications admin+GP via assignement). Carte affichée dès qu'un `assigned_departure_id` existe.
- **Realtime sur la liste des dossiers** : `useDossiersRealtime` (toast statut + invalidate).
- **Bouton "Payer maintenant"** : déjà présent sur `ClientDossierCard` (orange, conditionné `payment_status='pending'` + statut ≥ `PROCURED` = équivalent WEIGHED).
- **Notifications admin** sur changement de décision client + WhatsApp client/GP.

### À ajouter

#### 1. Bouton "Modifier la date de collecte" (statut SUBMITTED ou IN_REVIEW, et `client_departure_decision !== 'confirmed'`)
- DatePicker dans `DossierDetail.tsx`
- Update `pickup_date` (table `dossiers`)
- Insert `dossier_events` (`client_pickup_date_changed`) → trigger admin notif via `enqueue_admin_notification`

#### 2. Bouton "Modifier l'adresse de collecte" (mêmes conditions)
- Dialog avec Textarea
- Update `sender_address`
- Notification admin idem

#### 3. Bouton "Annuler ma demande" (statut SUBMITTED uniquement)
- Bouton rouge + modale de confirmation
- Nouvelle RPC `client_cancel_dossier(p_dossier_id)` qui :
  - Vérifie `auth.uid() = user_id`
  - Vérifie `status = 'SUBMITTED'` et `assigned_departure_id IS NULL`
  - Passe `status = 'CLOSED'`, set `cancelled_at`, `cancelled_by = 'client'`
  - Insert `dossier_events` `client_cancelled`
  - Notifie admin via `enqueue_admin_notification`

#### 4. RPC publique `confirm_departure_public` pour `/suivre`
- `confirm_departure_public(p_tracking text, p_confirmed boolean, p_reason text)` SECURITY DEFINER
- Trouve le dossier par `tracking_id`, exige `assigned_departure_id NOT NULL` et `client_departure_decision='pending'`
- Réutilise la logique de `client_decide_departure` sans vérif auth.uid
- Affichage : modifier `TrackPage` pour rendre `ClientDepartureDecision` en mode publique (prop `publicMode` + tracking)

#### 5. Badge admin temps réel
- Dans `AdminDossierSheet.tsx` (onglet Transport / résumé départ) : 
  - badge ambre **"EN ATTENTE CONFIRMATION CLIENT"** quand `assigned_departure_id != null` && `client_departure_decision='pending'`
  - vert **"CONFIRMÉ PAR CLIENT ✓"** quand `confirmed`
  - rouge **"REFUSÉ — À RÉASSIGNER"** quand `cancelled` ou `reschedule_requested`
- Realtime déjà actif côté admin via le sheet → invalidations.

### Hors-scope (déjà OK ou peu prioritaire)
- Toast "départ assigné" côté client : peut être ajouté en bonus dans `useDossiersRealtime` en détectant `assigned_departure_id` qui passe de null→non-null.
- Lecture seule après IN_TRANSIT : déjà géré par le composant (TERMINAL list).

### Fichiers modifiés
- **Nouvelle migration** : RPC `client_cancel_dossier` + `confirm_departure_public` + colonnes `cancelled_at`, `cancelled_by`.
- `src/pages/DossierDetail.tsx` : section "Gérer mon dossier" (3 boutons conditionnels).
- `src/components/dossier/ClientDepartureDecision.tsx` : prop `publicMode` (utilise nouvelle RPC publique).
- `src/pages/TrackPage.tsx` : rendre `ClientDepartureDecision` quand un départ est assigné.
- `src/components/admin/dossier-sheet/AdminDossierSheet.tsx` : badge décision client.
- `src/hooks/useDossiersRealtime.ts` : toast orange à l'assignation d'un départ.

Prêt à implémenter sur validation.
## Partie 1 — Purge 122

Remplacer **toutes** les références au numéro 122 (`221781221891` / `+221 78 122 18 91`) par le 926 (`221789269756` / `+221 78 926 97 56`) dans :

- `src/lib/contact.ts` — constantes `YOBBANTE_GP_WHATSAPP` + `YOBBANTE_GP_WHATSAPP_DISPLAY`, commentaire "ligne 122" → "ligne 926".
- `src/lib/sendSmartInvite.ts` — toasts "(122)" → "(926)", message d'erreur hors fenêtre 24h.
- `src/lib/whatsappTemplates.ts` — commentaire "sent from 122".
- `src/pages/KonnektLandingPage.tsx` — constantes `KONNEKT_WA` / `KONNEKT_TEL`.
- `src/pages/gp/GpDepartPage.tsx`, `src/pages/admin/DeparturesWeekPage.tsx`, `src/pages/RejoindreKonnektPage.tsx` — affichages tél.
- `src/components/admin/LivreursTab.tsx`, `GpOperationsTab.tsx`, `TransporteursTab.tsx`, `transporteur/WhatsAppHistoryDialog.tsx`, `inbox/WeekExportTemplate.tsx` — toutes les occurrences `+221781221891` et labels.
- `src/components/TransporteurSignupSection.tsx` — lien wa.me et libellé.
- `src/components/legal/LegalLayout.tsx` — fallback `phoneGp`.
- `src/components/flows/ReceiveFlow.tsx`, `flows/SourcingFlow.tsx` — `recipient_phone`.
- `src/lib/parseClientNotes.ts` — commentaires exemples.
- Edge Functions : grep `supabase/functions/**` sur `1221891` et remplacer.

Ne pas toucher : pages client `607`, pages légales (sauf fallback `phoneGp` qui pointe vers la mauvaise ligne).

## Partie 2 — Actions GP admin sur 926 uniquement

Cible : `src/components/admin/TransporteursTab.tsx` (menu `…`) et `src/components/admin/GpActionsPanel.tsx` (modal Actions GP).

Tous les envois passent par `supabase.functions.invoke('send-whatsapp', { body: { recipient_phone, recipient_type: 'gp', message, transporteur_id, trigger_type } })` (qui sort déjà depuis `WHATSAPP_PHONE_ID_GP` = 926).

Refonte du menu déroulant ligne GP :

1. **Inviter sur Konnekt** → API 926, texte :
   `Bonjour [prénom], je vous invite à rejoindre Konnekt votre espace GP : https://usekonnekt.com/onboarding/[ref_gp]`
2. **Onboarder sur le bot** → API 926, template `konnekt_gp_invitation` (variables : prénom, ref_gp). Pas de gate fenêtre 24h.
3. **Envoyer msg WhatsApp (wa.me)** → **supprimer** l'item.
4. **Envoyer URL départ (WhatsApp)** → API 926 :
   `Votre lien de départ Konnekt : https://usekonnekt.com/gp/[ref_gp]/departures`
5. **Envoyer lien de modification** → API 926 :
   `Complétez votre profil GP : https://usekonnekt.com/onboarding/[ref_gp]/edit`
6. **Copier le lien WhatsApp d'invitation GP** → conservé tel quel, copie `wa.me/221789269756?text=[message_onboarding]`.

Dans `GpActionsPanel.tsx` :

7. **SendMessageDialog** ("Envoyer un message au GP") — déjà sur `send-whatsapp` ; vérifier qu'aucun fallback `wa.me` ne se déclenche, et que le `recipient_type` force la sortie 926.

Toasts succès/erreur uniformes : `Message envoyé via WhatsApp (926)` / `Échec envoi via 926`.

## Partie 3 — Dashboard GP `/gp/:ref`

### Route et garde d'accès

- Ajouter `/gp/:ref` dans `src/App.tsx` (page publique, sans auth).
- Lookup `transporteurs` par `reference = ref` (la table existante a déjà `reference`, `prenom`, `nom`, `whatsapp_confirmed_at`, `adresse_collecte_dakar`, etc.).
- Si introuvable → `Navigate` vers `/onboarding/[ref]`.
- Pas de mot de passe : la `ref` (4 chars) est la clé d'accès. Conserver la même logique d'opacité que la page `/onboarding/[ref]` existante.

### Wizard de bienvenue (3 étapes)

Affiché tant que `profile_completed_at IS NULL` sur la fiche transporteur. Stocker l'état d'avancement en colonne `wizard_step` (0–3) pour reprise.

**Étape 1 — Profil**
Champs : prénom, nom, photo (upload Storage bucket `gp-avatars`, optionnel), ville résidence principale (select 36 villes), téléphone (lecture seule = `telephone` confirmé). Save → `transporteurs`.

**Étape 2 — Mes départs**
Réutilise la table `manual_departures` (déjà utilisée par le bot). Formulaire : `origin_city`, `destination_city`, `departure_date`, `total_capacity_kg`, `price_override_xof` (FCFA) ou conversion € → XOF. `source='gp_self'`, `created_via='gp_dashboard'`, `status='active'`. Liste inline des départs ajoutés + bouton "Ajouter un départ".

**Étape 3 — Mes tarifs**
Nouvelle table `gp_rates` :
```
id uuid pk, transporteur_id uuid fk, scope text ('default'|'route'),
origin_city text null, destination_city text null,
price_per_kg_xof int not null, currency text default 'XOF',
notes text null, created_at, updated_at
```
RLS : lecture/écriture par service_role uniquement (le dashboard appellera une Edge Function `gp-dashboard-save` qui valide la `ref` puis écrit). GRANT service_role + politiques. Formulaire : tarif par défaut + cartes "tarif spécial par route" + zone notes (ex : "pas de médicaments").

À la fin de l'étape 3 → `profile_completed_at = now()`, on bascule sur le dashboard.

### Dashboard principal

Sections (cartes) :

- **Mes départs actifs** — `manual_departures` où `transporteur_ref = ref` et `status='active'`, ordonné par date. Actions : éditer capacité, annuler.
- **Mes missions Yobbanté en cours** — `dossiers` où `assigned_transporteur_ref = ref` et `status` ∈ liste actives.
- **Mon historique paiements** — `dossiers` avec `gp_amount IS NOT NULL`, agrégat payé/en attente.
- **Bouton flottant "Ajouter un départ"** → réouvre le formulaire de l'étape 2.

Toutes les lectures côté client utilisent le client Supabase anonyme avec policies RLS dédiées (`SELECT` autorisé si `transporteur_ref = :ref` est passé en filtre). Pour rester simple et sûr, ajouter une RPC `public.get_gp_dashboard(_ref text)` `SECURITY DEFINER` qui retourne en une requête : profil, départs, missions, paiements.

### Bot 926 — message de bienvenue

Dans `supabase/functions/gp-bot/index.ts`, au moment de l'activation (réponse "✅ Bienvenue sur Konnekt…", ligne ~440), ajouter en bas du message :

```
Votre espace personnel :
https://usekonnekt.com/gp/[ref_gp]
Complétez votre profil pour recevoir vos premières missions 🚀
```

## Détails techniques

- Migration SQL : table `gp_rates`, colonnes `transporteurs.profile_completed_at TIMESTAMPTZ`, `transporteurs.wizard_step SMALLINT DEFAULT 0`, `transporteurs.photo_url TEXT`, `transporteurs.ville_residence TEXT`. GRANT + RLS conformes (lecture service_role + policy publique `SELECT` filtrée par `reference` via RPC SECURITY DEFINER).
- Edge Function `gp-dashboard-save` : valide `ref` → autorise writes scopés (profil, départ, tarifs).
- Storage bucket `gp-avatars` public read, upload via Edge Function (pas anon direct).
- Pages nouvelles :
  - `src/pages/gp/GpDashboardPage.tsx` (route `/gp/:ref`)
  - `src/components/gp/wizard/WizardProfile.tsx`
  - `src/components/gp/wizard/WizardDepartures.tsx`
  - `src/components/gp/wizard/WizardRates.tsx`
  - `src/components/gp/dashboard/ActiveDepartures.tsx`, `ActiveMissions.tsx`, `PaymentsHistory.tsx`
- Hook `useGpDashboard(ref)` qui appelle la RPC.
- Constantes 926 centralisées dans `src/lib/contact.ts` — supprimer toute valeur hard-codée `+221781221891` ailleurs et importer la constante.

## Validation

- `rg -n "1221891|78 122|\\(122\\)"` doit retourner 0 résultat après purge.
- Tester depuis `/admin/terrain` : chaque action envoie bien via 926 (vérifier `whatsapp_outbound_messages.phone_number_id`).
- `/gp/[ref_valide]` : wizard si profil incomplet, sinon dashboard ; `/gp/[ref_inconnue]` → redirige `/onboarding/[ref]`.
- Bot 926 : à la prochaine activation, le message contient le lien `usekonnekt.com/gp/[ref]`.

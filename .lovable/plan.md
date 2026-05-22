# Système relances GP + Fix envoi 607 API

## 1. Fix wa.me → API send-whatsapp (Partie 1)

**Fichiers** : `NewIntakeDialog.tsx`, `OrderDetailDrawer.tsx`

- Supprimer tous les `window.open('https://wa.me/...')` pour messages client.
- Remplacer par `supabase.functions.invoke('send-whatsapp', { body: { recipient_phone, recipient_type: 'client', message } })`.
- Si erreur API : toast admin "Envoi WhatsApp échoué pour {tracking}. Vérifiez /admin/messages." + log déjà fait côté edge.
- Conserver wa.me uniquement pour messages GP (122) via `sendGpMessage` existant.

## 2. Migration DB (Parties 2, 5, 7)

```sql
ALTER TABLE dossiers
  ADD COLUMN gp_reminded_at TIMESTAMPTZ,
  ADD COLUMN gp_reminder_count INT DEFAULT 0,
  ADD COLUMN gp_last_action_at TIMESTAMPTZ,
  ADD COLUMN gp_no_response_alert_sent BOOLEAN DEFAULT false;

ALTER TABLE transporteurs
  ADD COLUMN last_bot_activity_at TIMESTAMPTZ;
```

(weight_status existe déjà selon contexte précédent — sinon ajouter enum to_be_weighed/estimated/known.)

## 3. Nouvelle edge function `cron-gp-reminders`

Exécution horaire. Implémente RELANCE A à G :
- **A** : ASSIGNED + 2h sans confirmation → 1 message GP
- **B** : déjà géré par `gp_mission_recap_j1` (vérifier appel)
- **C** : Jour J 7h → liste des collectes
- **D** : COLLECTED + 1h sans poids → rappel POIDS
- **E** : IN_TRANSIT + 72h sans livraison → rappel LIVRE
- **F** : Aucune réponse 24h + 2 relances → alerte admin +221784604003 + `gp_no_response_alert_sent = true`
- **G** : WEIGHED + paid → notifier GP "EN ROUTE possible"

Garde-fous : max 3 relances par dossier, 1h min entre 2 relances, skip si `gp_last_action_at > gp_reminded_at`, log dans `whatsapp_outbound_messages` avec `trigger_type='gp_reminder'`.

Cron horaire via `pg_cron` (SQL insert tool, pas migration).

## 4. Bot GP — nouvelle commande EN ROUTE (Partie 4)

Dans `gp-bot/index.ts` :
- Parser `EN ROUTE {tracking}` → ne change pas le statut (reste IN_TRANSIT)
- Insert `dossier_events` event_type=`gp_departed`
- Notifier client depuis 607 via send-whatsapp
- Réponse GP : "Bon voyage…"
- UPDATE `gp_last_action_at = now()`

## 5. Tracker activité GP (Partie 5)

Dans `gp-bot/index.ts`, après succès de COLLECTE, POIDS, LIVRE, EN ROUTE, MES MISSIONS, MES DEPARTS :
- UPDATE `dossiers.gp_last_action_at = now()` (sur dossier concerné)
- UPDATE `transporteurs.last_bot_activity_at = now()`

## 6. Panneau admin "GP sans réponse" (Partie 6)

Dans `GpOperationsTab.tsx` (existant), ajouter une section en haut :
- Liste dossiers où `gp_no_response_alert_sent=true OR gp_reminder_count>=2`
- Affichage : GP, tracking, statut, dernière activité, nb relances
- Actions : [Appeler] (tel:), [Réassigner] (placeholder dialog réutilisant GpActionsPanel), [Relance manuelle] (send-whatsapp depuis 122)

## Hors-périmètre / clarifications

- **Partie 7 (weight_status badges)** : suppose que `weight_status` enum existe déjà sur `dossiers`. Si non, à ajouter dans la migration. Je vérifierai et adapterai.
- **RELANCE B** : je vérifie juste que `gp_mission_recap_j1` est déclenché par un cron existant — pas de nouveau code.
- **"Réassigner"** dans le panneau : je branche un simple bouton qui ouvre `GpActionsPanel` existant en mode réassignation (pas de nouveau flow complet).

## Détails techniques

- Nouveau fichier : `supabase/functions/cron-gp-reminders/index.ts`
- Migration : nouvelles colonnes + index sur `(status, gp_reminded_at)` pour perf cron
- Cron via `pg_cron` insert (pas migration car contient URL projet)
- Tous textes bot sans accents, UI en français, design dark + #F5C518
- Aucun crash si GP sans téléphone (guard `if (!phone) continue`)

Confirmez et je lance l'implémentation complète.

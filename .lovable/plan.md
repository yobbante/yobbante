
## Objectif

Refonte complète du système WhatsApp : 2 numéros API (607 clients / 122 GP), webhook unifié, bot GP, page admin Messages, triggers automatiques, logging complet.

## Phase A — Critique (à livrer en premier)

### 1. Secrets requis (à ajouter avant tout code)

À demander à l'utilisateur via `add_secret` :
- `WHATSAPP_PHONE_ID_CLIENTS` (Phone ID du 607)
- `WHATSAPP_PHONE_ID_GP` (Phone ID du 122)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (token de vérif Meta, libre)
- `ADMIN_WHATSAPP_NUMBER` (+221786078080)

`WHATSAPP_TOKEN` existe déjà. L'ancien `WHATSAPP_PHONE_ID` reste comme fallback legacy.

### 2. Migration DB (Partie 1+2+6)

Une seule migration regroupant :
- `whatsapp_outbound_messages` (log envois)
- `whatsapp_inbound_messages` (log réception, channel client/gp)
- `dossier_events` (timeline dossiers) + trigger AFTER UPDATE status
- RLS staff-only sur les 3 tables (`is_staff(auth.uid())`)
- Index sur `to_phone`, `from_phone`, `wamid`, `dossier_id`, `received_at`
- Publication realtime sur `whatsapp_inbound_messages` (badge non-lus admin)

### 3. Edge function `send-whatsapp` (refonte complète, Partie 1)

Rétro-compatible avec l'ancien payload (`client_name`, `service_type`…) mais accepte le nouveau schéma :
```ts
{ recipient_phone, recipient_type: 'client'|'gp'|'admin',
  template_name?, template_params?, message?,
  dossier_id?, transporteur_id?, trigger_type? }
```
- Routing du `phoneId` selon `recipient_type` (gp → 122, sinon 607).
- Mode template → POST Graph v21.0 avec components/parameters.
- Fallback texte libre si pas de `template_name`.
- Log systématique dans `whatsapp_outbound_messages` (status, wamid, error).
- Si template non approuvé → status `template_not_approved`, retour 200 sans crash.
- Tag `WA_ERROR` sur tous les console.error.

### 4. Edge function `webhook-whatsapp` (Partie 2)

Nouveau fichier `supabase/functions/webhook-whatsapp/index.ts`. Config `verify_jwt = false` dans `supabase/config.toml`.
- GET → vérification Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- POST → parse `entry[0].changes[0].value` :
  - `statuses[]` → update `whatsapp_outbound_messages` (sent/delivered/read/failed).
  - `messages[]` → router selon `metadata.display_phone_number` :
    - contient `607` → workflow client : insert inbound (`channel='client'`), résoudre `dossier_id` via `from_phone`, notifier admin sur 607 en texte libre.
    - contient `122` → workflow GP : appel interne à `gp-bot`.

### 5. Edge function `gp-bot` (Partie 3)

`supabase/functions/gp-bot/index.ts`. Appelée par `webhook-whatsapp`.
- Parser d'intents (regex insensitive aux accents/casse) : DEP, COLLECTE, POIDS, LIVRE, MES_DEPARTS, MES_MISSIONS, AIDE, START.
- Identifier GP via `transporteurs.telephone` ≈ `from_phone` (normalisation: strip `+`, espaces, doublon `00`).
- Exécuter l'action correspondante (insert/update Supabase) + réponse via `send-whatsapp` (recipient_type='gp').
- Logger toutes interactions dans `whatsapp_inbound_messages` (channel='gp').
- Gestion d'erreurs : tracking inconnu, dossier non-assigné, GP non trouvé → message explicite.

### 6. `src/lib/whatsappTemplates.ts` (Partie 8)

Constantes typées des 16 templates :
```ts
export const WA_TEMPLATES = {
  ORDER_CONFIRMATION: { name: 'order_confirmation', recipient: 'client', params: ['client_name','tracking_id','destination','amount'] },
  // …
  MISSION_ASSIGNED_GP: { name: 'mission_assigned_gp', recipient: 'gp', params: [...] },
  GP_MISSION_RECAP_J1: { name: 'gp_mission_recap_j1', recipient: 'gp', params: [...] },
  _1537_CLIENT_REMINDER_48H_V3: { name: '_1537_client_reminder_48h_v3', recipient: 'client', params: [...] },
  FEEDBACK_REQUEST_V3: { name: 'feedback_request_v3', recipient: 'client', params: [...] },
} as const;
```

## Phase B — Cette semaine

### 7. Triggers automatiques (Partie 5)

Triggers `AFTER INSERT/UPDATE` sur `dossiers` qui invoquent `send-whatsapp` via `pg_net.http_post`. Chaque trigger filtre sur la transition exacte (ex: `OLD.status = 'CONFIRMED' AND NEW.status = 'ASSIGNED'`). Référence à la fonction edge construite dynamiquement depuis `SUPABASE_URL`.

### 8. Page `/admin/messages` (Partie 4)

- Nouveau composant `src/pages/admin/MessagesPage.tsx` + route dans `AdminPage.tsx`.
- 2 colonnes : conversations (groupées par `from_phone`, onglets Clients/GP/Tous, recherche, badge non-lu) / conversation ouverte (bulles, zone réponse client avec dropdown templates depuis `WA_TEMPLATES`, parsing commandes bot pour GP, bouton "Marquer traité").
- Realtime via `supabase.channel('whatsapp_inbound')` sur INSERT.
- Sidebar admin : nouveau lien "Messages" + badge count non-lus.

## Détails techniques

- Imports edge : `npm:@supabase/supabase-js@2` (CORS via `npm:@supabase/supabase-js@2/cors`), pas de `deno.json`.
- Validation des bodies edge : zod ou `safeParse` manuel (le bot accepte du texte libre, validation légère).
- Normalisation des numéros : helper `normalizePhone(p)` = strip non-digits, garde 8-15 chars.
- `dossier_events` : trigger PL/pgSQL local (pas d'edge function) pour la timeline. Champ `visible_to_client` pour filtrage futur.
- `OrderDetailDrawer` : ajouter une section Timeline lisant `dossier_events` (Phase B uniquement si temps).

## Risques

- Le frontend appelle déjà `send-whatsapp` à plusieurs endroits (SendFlow, etc.) avec l'ancien payload `{ client_name, service_type, origin, destination, weight, recipient_phone }`. La nouvelle fonction DOIT rester compatible avec ce schéma legacy en l'interprétant comme un message texte libre (fenêtre 24h) ou en le mappant sur `order_confirmation`. Sinon on casse les flows existants.
- Les triggers DB qui appellent une edge function nécessitent `pg_net` (à activer si absent).
- Les RLS sur `whatsapp_*` doivent permettre aux edge functions (service role) d'écrire, et à l'admin (`is_staff`) de lire/écrire depuis le frontend.

## Hors scope

- Pas de modification des templates Meta côté Business Manager (ils existent déjà).
- Pas de migration des anciens logs WhatsApp (table `notifications_log` reste telle quelle).
- Pas de paiement / facturation automatique (la commande POIDS calcule `final_amount` mais ne déclenche pas de paiement).

## Ordre d'exécution

1. Demander les 4 secrets manquants → bloque jusqu'à confirmation.
2. Migration DB.
3. `src/lib/whatsappTemplates.ts`.
4. Refonte `send-whatsapp` + tests via `curl_edge_functions`.
5. Création `webhook-whatsapp` + `gp-bot` + config `verify_jwt=false`.
6. Donner à l'utilisateur l'URL du webhook à coller dans Meta Business Manager.
7. Phase B : triggers + page admin.

## Modes de livraison finale — 3 options client

Système permettant au client de choisir comment recevoir son colis à l'arrivée : récupération chez le GP (par défaut, gratuit), livraison à un point relais, ou livraison à domicile (carrier ou livreur Yobbanté).

---

### 1. Base de données

**Migration** — ajout de colonnes à `dossiers` :
- `delivery_mode TEXT DEFAULT 'pickup_gp'` avec CHECK (`pickup_gp` | `relay_point` | `home_delivery`)
- `relay_point_address TEXT`
- `relay_point_name TEXT`
- `delivery_appointment TIMESTAMPTZ`
- `delivery_confirmed_by_client BOOLEAN DEFAULT false`
- `delivery_carrier TEXT` (DHL/FedEx/Yobbante quand `home_delivery`)
- `delivery_cost_xof INT` (frais calculés)
- `delivery_notified_at TIMESTAMPTZ` (anti-spam relances)
- `delivery_reminder_count INT DEFAULT 0`

Index sur `(status, delivery_mode, delivery_notified_at)` pour les crons de relance.

---

### 2. Formulaire client — `SendFlow.tsx`

Nouvelle section **"Mode de réception"** dans l'étape Destinataire :

```text
◉ Recuperer chez notre partenaire (GP)
    Gratuit — adresse communiquee a l'arrivee

○ Livraison a un point relais
    Frais selon distance
    └─ [Nom du point relais]
    └─ [Adresse complete du point relais]

○ Livraison a domicile
    └─ Affiche tarifs carriers (DHL/FedEx/Yobbante)
       via edge function get-shipping-rates
```

Sauvegarde dans `dossier_draft` puis flush vers `dossiers` à la création.

---

### 3. Comportement à l'arrivée — `status = ARRIVED_HUB`

Nouveau trigger `trg_dossier_delivery_dispatch` (AFTER UPDATE) qui appelle l'edge function **`delivery-dispatch`** :

| Mode | Action |
|------|--------|
| `pickup_gp` | WhatsApp 607 → client avec coordonnées GP (nom, tel, adresse remise) |
| `relay_point` | WhatsApp 122 → GP : "Livrez au point relais {adresse}, repondez DEPOSE {tracking}". WhatsApp 607 → client : "Colis arrive au point relais, retirez sous 5 jours". |
| `home_delivery` | Si carrier externe → générer label + notifier. Si livreur Yobbante → créer `delivery_missions` + bot livreur (V2, hors scope ici, log événement). |

Nouvelle commande GP : **`DEPOSE {tracking}`** → `status = DELIVERED_RELAY`, event `relay_deposit`, notif client.

---

### 4. Relances automatiques — `cron-delivery-reminders`

Nouvelle edge function appelée toutes les heures (`pg_cron`) :

| Mode | T+48h | T+5j | T+7j |
|------|-------|------|------|
| `pickup_gp` | Rappel client "N'oubliez pas de recuperer chez {gp}" | — | Alerte admin |
| `relay_point` | — | "Dernier rappel : retrait expire dans 2 jours" | Alerte admin |
| `home_delivery` | Suivi carrier (out of scope manuel) | — | — |

Anti-spam : `delivery_notified_at` + `delivery_reminder_count ≤ 3`.

---

### 5. UI Admin — `OrderDetailDrawer.tsx`

Nouveau panneau **"Livraison finale"** affiché quand `status` ≥ `ARRIVED_HUB` :

```text
┌─ Livraison finale ───────────────────┐
│ Mode    : Recuperation chez le GP    │
│ Adresse : {gp.adresse_remise}        │
│ Statut  : En attente de retrait      │
│                                      │
│ [Notifier le client]                 │
│ [Contacter le GP]                    │
│ [Marquer comme recupere]  ← DELIVERED│
└──────────────────────────────────────┘
```

- Boutons contextuels selon `delivery_mode`
- "Marquer comme recupere" → `status = DELIVERED` + `delivery_confirmed_by_client = true` + event
- Tous textes français, accents OK côté UI admin (mais sans accents dans les messages bot)

---

### 6. Logging

Événements `dossier_events` ajoutés :
- `delivery_mode_chosen` (création dossier)
- `delivery_dispatch_sent` (notif initiale)
- `delivery_reminder_sent` (chaque relance, avec `reminder_index`)
- `relay_deposit` (GP a déposé au relais)
- `delivery_completed` (client confirme ou admin marque récupéré)

---

### Contraintes respectées

- Default `pickup_gp` (gratuit, comportement actuel inchangé)
- Tarifs domicile via `get-shipping-rates` existant
- Tous événements loggés
- Messages bot **sans accents**, UI admin en français
- Design dark Yobbante + `#F5C518`
- Pas de régression : dossiers existants tombent en `pickup_gp` par défaut

---

### Hors scope (à confirmer)

- Bot livreur Yobbanté complet (mode `home_delivery` interne) → V2, on logge juste l'événement
- Génération automatique label DHL/FedEx → on prépare le hook mais l'intégration carrier reste manuelle

Dis-moi si tu valides ; j'enchaîne la migration puis le code (SendFlow, edge functions, drawer admin, cron).

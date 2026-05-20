## Yobbanté — Gestion interne adaptée au workflow réel (Départs-centric)

### Compréhension
Le "Départ planifié" (`manual_departures`) est l'entité centrale. Les admins capturent les départs des GP (statuts WhatsApp), publient une liste hebdo, puis rattachent les dossiers clients aux départs via une référence courte (4 chiffres).

---

### Priorité 1 — Bloquant launch

**Fix 6 — Route `/suivre/:trackingNumber`**
- Ajouter routes dans `App.tsx`:
  - `/suivre/:trackingNumber` → `TrackPage`
  - `/suivre` → `TrackPage` (gère `?ref=` via redirect interne vers `/suivre/:ref`)
- Adapter `TrackPage.tsx` pour lire `useParams().trackingNumber` en plus du query param existant, et pré-charger.
- Mettre à jour `buildClientRecap` (dans `useInboxDossiers.ts` / `NewIntakeDialog.tsx`) pour générer `https://yobbante.com/suivre/<ref>`.

**Fix 1 — Référence courte sur `manual_departures`**
- Migration:
  - `short_ref TEXT UNIQUE` (4 chiffres)
  - `publication_status TEXT CHECK (...) DEFAULT 'draft'`
  - `published_at TIMESTAMPTZ`
  - `notes_admin TEXT`
  - `max_capacity_kg NUMERIC`
  - `reserved_capacity_kg NUMERIC DEFAULT 0`
  - Fonction `generate_unique_short_ref()` (loop random 1000-9999, vérifie unicité)
  - Trigger BEFORE INSERT : si `short_ref` NULL, génère auto
  - Backfill: générer un `short_ref` pour les départs existants
- Update `ManualDepartureForm.tsx` : input `short_ref` optionnel + suggestion "4 derniers chiffres du WhatsApp GP" + bouton "Générer".
- Affichage gros "Réf #XXXX" dans `DeparturesTab` et carte.

**Fix 3 — Étape "Quel départ ?" dans NewIntakeDialog**
- Remplacer/ajouter dans `NewIntakeDialog.tsx` une étape "Départ" (entre Service et Récap):
  - Radio: A) Réf publiée, B) Trouver départ pour route, C) GP connu, D) Skip
  - A: input 4 chiffres → query `manual_departures` par `short_ref` → card + check capacité
  - B: liste filtrée par route (origine/destination)
  - C: autocomplete transporteurs → statut `EN_RECHERCHE_DEPART`
  - D: aucun
- Ajouter colonnes `dossiers`:
  - `assigned_departure_id UUID REFERENCES manual_departures(id)`
  - `assigned_transporteur_ref TEXT`
- Ajouter valeur enum `dossier_status`: `EN_RECHERCHE_DEPART`

**Fix 2C — Format texte WhatsApp à copier (page Départs semaine)**
- Nouvelle page `/admin/departs-semaine` (`DeparturesWeekPage.tsx`):
  - Liste groupée par date (semaine courante + 2 suivantes)
  - Carte avec date, mode, route, **Réf #XXXX**, GP, capacité, statut publication, nb dossiers
  - Bouton "Copier texte WhatsApp" → génère format texte spécifié
  - Bouton "Marquer comme publié" → maj `publication_status='published'`, `published_at=now()`
  - Filtres : route, GP, mode
- Lien dans `AdminSidebar.tsx`.

---

### Priorité 2 — Semaine prochaine

**Fix 2A — Export image Canva-ready** : `html2canvas` sur template 1080×1080 / 1080×1920 (logo + tableau + URL).
**Fix 4 — Drawer "Par départ"** : ouvre détails + liste dossiers attachés.
**Fix 5 — "Notifier le GP"** : génère message récap mission + ouvre `wa.me`.

---

### Détails techniques

```text
manual_departures
├── short_ref (UNIQUE, auto 4 chiffres)
├── publication_status (draft|ready|published|closed|completed)
├── published_at, notes_admin, max_capacity_kg, reserved_capacity_kg
└── (existant : origin_*, destination_*, departure_date, transport_mode, ...)

dossiers
├── assigned_departure_id → manual_departures.id
├── assigned_transporteur_ref TEXT
└── status enum + 'EN_RECHERCHE_DEPART'
```

Trigger `reserved_capacity_kg` : recalculé à l'INSERT/UPDATE/DELETE sur `dossiers.assigned_departure_id` (somme `estimated_weight` des dossiers liés non annulés).

---

### Confirmation
Je livre P1 en premier (Fix 6 → Fix 1 → Fix 3 → Fix 2C). Je peux enchaîner sur P2 dans la même session ou attendre ton OK après P1.

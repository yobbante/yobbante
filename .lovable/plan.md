
## État actuel découvert

Plusieurs éléments existent déjà :
- Enum `dossier_status` contient déjà `COLLECTED`, `WEIGHED`, `ARRIVED_HUB`, `IN_TRANSIT`, etc.
- Colonnes existantes : `actual_weight_kg`, `final_amount_xof`, `payment_status` (TEXT default 'pending'), `cash_on_delivery`, `collected_at`, `weighed_at`, `delivered_at`.
- `ReceptionKanbanTab` a déjà une UI de pesée (pour réceptions, pas dossiers WEIGHED).
- `PayPage.tsx` existe et lit déjà `payment_status` via `lookup_dossier_public`.
- Trigger `trg_dossier_whatsapp_notify` envoie déjà `package_in_transit` quand `IN_TRANSIT` ET `payment_status='paid' OR cash_on_delivery`.

## Plan d'implémentation

### 1. Migration DB
- Ajouter à `dossiers` : `payment_method TEXT`, `payment_provider_ref TEXT`, `paid_at TIMESTAMPTZ`, `weighed_by UUID`, `payment_reminders_count INT DEFAULT 0`, `last_payment_reminder_at TIMESTAMPTZ`, `weigh_location TEXT`.
- Étendre le CHECK `payment_status` pour inclure `'not_required'`, `'paid'`, `'pending'`, `'refunded'`, `'failed'`.
- Créer table `weight_logs` (dossier_id, weight_kg, measured_by, measured_at, location, notes) avec RLS staff-only.
- Mettre à jour `lookup_dossier_public` pour exposer `actual_weight_kg`, `final_amount_xof`, `cash_on_delivery`.
- Créer trigger `block_in_transit_if_unpaid` AVANT UPDATE qui empêche `IN_TRANSIT` si `payment_status='pending'` et `cash_on_delivery=false`.

### 2. Statuts & libellés (`src/lib/statusLabels.ts`)
Ajouter mappings français : `COLLECTED`, `WEIGHED` ("Pesé - En attente de paiement"), `ASSIGNED`, `ARRIVED_HUB`, `OUT_FOR_DELIVERY`, `AWAITING_CLIENT`.

### 3. Panneau pesée (nouveau composant `WeighingPanel.tsx`)
Affiché dans `GpOperationsTab` (où la collecte est déjà gérée) quand un dossier est en `COLLECTED`. Contient :
- Poids estimé en readonly, input poids réel, dropdown hub (Dakar/Paris/NY/Dubaï/Chine).
- Calcul live du montant (poids × tarif via `calculate_quote_v2` côté front, ou simple `final_amount_xof = poids × prix_unitaire` selon route).
- Checkbox cash_on_delivery.
- 3 boutons : "Confirmer + Demander paiement", "Confirmer + Cash on delivery", "Annuler".
- Sur soumission : UPDATE dossier + INSERT weight_log + invoke `send-whatsapp` avec template `weight_confirmation` ou `cash_on_delivery_confirmed`, lien `https://yobbante.com/pay/{tracking_id}`.

### 4. Page `/pay/:trackingId` (`src/pages/PayPage.tsx`)
Refactor pour utiliser `actual_weight_kg` et `final_amount_xof` (XOF directement, pas conversion EUR). Affichage récap (route, poids réel, GP). Montant en gros. 3 boutons placeholder (Wave/OM/Carte) avec message "Paiement bientôt disponible — Contactez +221 78 460 4003". États : déjà payé, lien invalide, en attente.

### 5. Cron relances paiement
Étendre `relance-dossiers` (ou créer section dans le cron existant) :
- 48h après `weighed_at` si `payment_status='pending'` et `reminders=0` → template `payment_reminder_48h`, increment counter.
- 96h si counter=1 → texte libre admin vers +221 78 460 4003 + counter=2.

### 6. Templates WhatsApp
Ajouter dans `whatsappTemplates.ts` les variantes `weight_confirmation`, `cash_on_delivery_confirmed`, `payment_reminder_48h` (textes français sans accents, paramètres positionnels).

## Notes techniques
- Tarifs : utiliser `calculate_quote_v2` RPC (existant) pour recalculer avec le poids réel.
- Le trigger DB bloque la transition `IN_TRANSIT` côté serveur ; côté UI on affiche toast d'erreur.
- RLS `weight_logs` : SELECT staff ou propriétaire du dossier ; INSERT staff uniquement.
- Tous les textes affichés en français, design dark + #F5C518.
- Ne pas casser : ne pas modifier les dossiers existants (defaults), garder colonnes optionnelles.

## Questions ouvertes
- L'UI de pesée doit-elle vivre dans `GpOperationsTab` (recommandé, c'est là que la collecte est gérée) ou ailleurs ?
- Pour le calcul du montant final : recalcul live via `calculate_quote_v2` ou simple règle de 3 (estimated_cost × actual/estimated) ? Je recommande `calculate_quote_v2` pour cohérence.

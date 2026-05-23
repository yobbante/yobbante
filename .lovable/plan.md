# Refonte Pricing Engine — Plan d'implémentation

Refonte complète de la logique tarifaire Yobbanté avec marge agence, enlèvement Dakar, livraison destination, et tarifs GP personnalisés via bot 122.

## Vue d'ensemble

Le système actuel utilise `calculate_quote_v2` basé sur des zones et coefficients. La nouvelle logique passe à un modèle **tarif GP + marge agence 20% + frais enlèvement intégrés + frais hors Dakar + carrier livraison destination**.

Tout est segmenté : **visible client** (prix final uniquement) vs **visible admin** (décomposition complète, marge nette).

---

## Étape 1 — Base de données (migration)

1. **Nouvelle table `route_default_rates`** — tarifs par défaut par zone (Europe, Amérique, Asie, etc.) avec coefficient express, modifiable depuis l'admin.
2. **Seed initial** des 8 zones du brief (europe_ouest 6000, amerique_nord 8000, afrique_ouest 3500, asie 9000, etc.).
3. **Étendre `transporteurs`** : `rates_per_city JSONB` (ex: `{"Paris": 6500, "New York": 8000}`).
4. **Étendre `dossiers`** :
   - `gp_rate_per_kg`, `yobbante_margin_pct` (default 0.20)
   - `enlevement_amount` (default 5000), `hors_dakar_surcharge` (0 ou 5000)
   - `delivery_carrier_cost`, `displayed_price_per_kg`, `total_displayed_price`
   - `total_cost_price` (admin only), `yobbante_gross_margin` (admin only)
   - `price_is_estimate` boolean
5. **Fonction SQL `calculate_dossier_pricing(dossier_id)`** : recalcule et écrit toutes les colonnes ci-dessus à partir du GP assigné (ou tarif de zone par défaut si pas assigné).
6. **Trigger** sur `dossiers` : recalcul auto à l'insert et quand `assigned_transporteur_ref`, `estimated_weight`, ou adresse change.

## Étape 2 — Bot GP (122) : onboarding tarifs + commandes

Modifier `supabase/functions/gp-bot/index.ts` :
- Après la saisie des navettes, lancer la **séquence tarifs** : pour chaque ville déclarée, demander le tarif/kg. SKIP → applique le tarif de zone par défaut.
- Sauvegarder dans `transporteurs.rates_per_city`.
- **Commande `TARIFS`** : affiche les tarifs courants + instructions de modif.
- **Commande `TARIF {ville} {prix}`** : met à jour un tarif + notifie l'admin (+221784604003).

## Étape 3 — Rappels automatiques

Étendre `cron-weekly-gp-reminder` (ou nouveau cron quotidien) :
- GP avec navettes mais sans tarifs renseignés depuis 24h → message WhatsApp "Tapez TARIFS".
- Après 48h sans tarifs → alerte admin via `enqueue_admin_notification`.

## Étape 4 — Lib pricing côté client (frontend)

Créer `src/lib/yobbantePricing.ts` :
- `getDefaultRateForCountry(country)` → consulte cache `route_default_rates`.
- `isDakarZone(address|city)` → liste blanche (Dakar, Pikine, Guédiawaye, Rufisque, Bargny, Sébikotane, Diamniadio).
- `computeDisplayPrices({gpRate, weight, isExpress, isOutsideDakar})` → renvoie `{standard, express, perKgStandard, perKgExpress, outsideDakarSurcharge}`.
- Coefficient express = 1.45, marge = 0.20, enlèvement = 5000.

## Étape 5 — UI client (SendFlow)

Refondre l'étape Transport de `src/components/flows/SendFlow.tsx` :
- Deux cartes : **Standard** et **Express** avec le format du brief (badges, délais, prix/kg).
- Encart "Adresse hors Dakar — +5 000 FCFA" si détecté.
- Badge "Prix estimatif — confirmé sous 2h" ou "Prix confirmé".
- **Ne jamais** mentionner GP, tarif brut, ou marge.

## Étape 6 — Étape "Mode de réception" (3 options)

Mettre à jour l'écran déjà existant pour exposer :
- **A. Récupération chez le partenaire** (gratuite)
- **B. DHL / Colissimo / FedEx** (appel `get-shipping-rates`)
- **C. Livreur Yobbanté local** (si dispo pour la ville)

Mapping `delivery_mode` : `pickup_gp` / `carrier_postal` / `local_delivery`.

## Étape 7 — Admin

- **OrderDetailDrawer / AdminDossierSheet → onglet Transport** : panneau "Décomposition" admin-only (tarif GP brut, marge 20%, enlèvement, hors Dakar, total client, coût GP, marge nette).
- **Page `/admin/parametres`** : nouvelle section "Tarifs par défaut" — table éditable de `route_default_rates` (tarif et coefficient express).

## Étape 8 — Nettoyage textes site

Recherche/remplacement dans les pages publiques (`TarifsPage`, `ServicesPage`, FAQ, footer, etc.) :
- ❌ "Enlèvement payant" → ✅ "Enlèvement gratuit à Dakar"
- ❌ "Nos GP livrent à domicile en Europe" → ✅ "Livraison via DHL, Colissimo ou FedEx"
- Ajouter blocs explicatifs sur la page tarifs et FAQ.

---

## Détails techniques

- Toutes les valeurs configurables (marge 20%, coef express 1.45, enlèvement 5000, hors-Dakar 5000) sont stockées en base ou dans une table `pricing_config` simple, modifiables par admin sans déploiement.
- Le prix affiché client est **toujours** calculé via la fonction SQL côté serveur, jamais reconstruit côté front à partir du tarif GP.
- Détection Dakar : matching insensible aux accents sur les noms de villes/zones connues.
- La logique existante `calculate_quote_v2` reste pour les estimations rapides du devis instantané, mais elle est désormais alimentée par `route_default_rates` au lieu de `zone_pricing`.
- Tous les triggers SQL sont SECURITY DEFINER avec `search_path = public`.
- RLS : `route_default_rates` lecture publique, écriture admin seulement. Nouvelles colonnes `dossiers` admin-only protégées par RLS sur les colonnes `total_cost_price` et `yobbante_gross_margin` (vue masquée pour clients).

## Risques / hors scope

- **Hors scope** : refonte complète de `calculate_quote_v2`. On garde la fonction et on l'aligne sur les nouveaux tarifs par défaut. Cela évite de casser le simulator public.
- **Risque** : si un dossier n'a ni GP ni tarif de zone, fallback sur 6000 FCFA/kg (Europe) avec flag `price_is_estimate = true`.
- **Migration des dossiers existants** : on n'écrit pas rétroactivement les nouvelles colonnes — seuls les nouveaux dossiers et ceux qui sont édités/réassignés sont recalculés.

Confirme et je commence par l'étape 1 (migration SQL).

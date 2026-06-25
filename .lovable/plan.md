# Réordonner SendFlow pour afficher le prix dès que les infos déterminantes sont saisies

## Objectif

Aujourd'hui, dans `/expedier` :
1. Collecte / pickup
2. Destinataire
3. Description colis (poids)
4. Type de marchandise
5. Transport & priorité
6. Protection colis
7. Paiement

Le client doit remplir 2 étapes avant qu'on lui demande le **poids** et le **type de marchandise** — les seules variables qui définissent le prix. On veut inverser : prix d'abord, paperasse ensuite.

## Nouvelle séquence

Après le choix de la destination (déjà fait via la barre `ExpedierSearchBar` en haut, hors étapes) :

1. **Colis** (ex-step 3) — poids + dimensions (SEA/ROAD) + description courte
2. **Type de marchandise** (ex-step 4)
3. **Transport & priorité** (ex-step 5) — Standard / Express et mode
4. **Prix calculé** — bandeau récap "Votre prix : XX FCFA" affiché juste après l'étape 3, avec détail (fret, billet, dossier, agence, TVA). C'est la nouvelle étape 4 visuelle (pas une étape de saisie, juste une révélation forte).
5. **Collecte / pickup** (ex-step 1)
6. **Destinataire** (ex-step 2)
7. **Protection colis** (ex-step 6)
8. **Paiement & récapitulatif** (ex-step 7)

Justification du placement de "Transport & priorité" avant le prix : Express applique un coefficient ×1.45 sur le fret, et le mode (AIR/SEA/ROAD) change aussi le prix. Sans cette étape, le "prix" affiché serait incomplet et changerait après. Donc on l'inclut dans le bloc "qui définit le prix".

## Modifications techniques

Fichier unique impacté : `src/components/flows/SendFlow.tsx` (3065 lignes).

1. **Renuméroter les `step={n}`** dans les `<FlowSection>` et `<LockedStep>` :
   - ex-3 (Package) → step 1
   - ex-4 (Goods) → step 2
   - ex-5 (Transport) → step 3
   - ex-1 (Collecte) → step 5
   - ex-2 (Recipient) → step 6
   - ex-6 (Protection) → step 7
   - ex-7 (Paiement) → step 8
   - Nouveau bloc "Prix" → entre step 3 et step 5 (révélé quand `packageOk && goodsOk`).

2. **Déplacer les blocs JSX** dans le `return` pour refléter le nouvel ordre.

3. **Mettre à jour les structures d'état dépendantes des numéros** :
   - `STEP_DOM_ID` (lignes 682-688)
   - `stepValidity` (lignes 711-715)
   - `advanceFromStep`, `goToStep` continuent de fonctionner via les nouveaux numéros
   - Le `total={7}` passe à `total={8}` dans les `<LockedStep>` et `<FlowSection>`.

4. **Nouveau bloc "Votre prix"** : carte sticky/highlight utilisant `calculatePricing(...)` déjà importé. Affiche TTC + ligne "détail" repliable. Pas de nouvelle dépendance.

5. **Préserver la logique conditionnelle** : `skipGoodsStep`, `showInsuranceStep`, banner "Dépôt entrepôt" SEA/ROAD à l'étape Collecte — inchangés, juste déplacés.

6. **Garder intact** : moteur de prix, edge functions, ExpedierSearchBar, recap tab, soumission `submit()`.

## Hors scope

- Pas de changement visuel sur la barre de recherche du haut.
- Pas de modification de `pricingEngine.ts`.
- Pas de modification du flow Recevoir / Sourcing.

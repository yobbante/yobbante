# Prochaine étape : extraire `useSendPricing`

## Contexte
`SendFlow.tsx` est à 2 480 lignes. Les 3 hooks métier candidats — `useSendPreset`, `useStepMachine`, `useSendPricing` — sont les plus sensibles car ils touchent la logique commerciale (prix, machine à états, préréglages). Je propose de commencer par le plus **isolé** : `useSendPricing`.

## Pourquoi celui-ci en premier
- Bloc contigu (lignes ~440-560) : ~120 lignes
- **Entrées pures** : state déjà défini plus haut (weight, goodsType, priority, transportMode, insurance, declaredLocal, adresses, ville origine/dest, forfaitId, forfaitQty)
- **Sorties dérivées** consommées plus bas dans le JSX/submit : `pricing`, `totalEur`, `fraisEnlevement`, `surchargeEur`, `insuranceCostFcfa/Eur`, `transportPriceEur`, `effectiveTarifGP`, `declaredEur`, `selectedForfait`, `forfaits`
- Aucune interaction avec le stepper ou les side-effects navigation
- Facile à valider : type-check + comparaison visuelle du prix affiché

## Ce que je ferai

1. **Créer `src/components/flows/send/useSendPricing.ts`** :
   - Signature : `useSendPricing(input) => output`
   - `input` = objet regroupant tous les state values nécessaires (weight, goodsType, priority, transportMode, insurance, declaredLocal, originProfile, originCity, destCity, direction, pickupAddress, pickupQuartier, deliveryAddress, forfaitId, forfaitQty, chosen, rawTransportEur)
   - Encapsule à l'intérieur :
     - `useState` local pour `forfaits` (chargées via `useEffect` sur destCountry+mode)
     - Le `useMemo` `priceVolatilityCoeff` (stable session)
     - Tous les `useMemo` de prix : `selectedForfait`, `effectiveTarifGP`, `pricing`
     - Le `useEffect` dev de garde-fou `assertPriceCoherence`
     - Le `useEffect` de reset forfait
   - Retourne l'objet complet des valeurs dérivées

2. **Mettre à jour `SendFlow.tsx`** :
   - Supprimer le bloc ~440-560
   - Retirer l'import de `calculatePricing`, `assertPriceCoherence`, `ratePerKgForCorridor`, `calculerFraisEnlevement` (déplacés dans le hook)
   - Retirer `useState<Forfait[]>` local (encapsulé)
   - Appeler `const { pricing, totalEur, fraisEnlevement, ... } = useSendPricing({ ... })`
   - Conserver `forfaitId`/`setForfaitId` dans `SendFlow` (utilisé aussi par la sélection UI) → le hook prend `forfaitId` en entrée, expose `forfaits` en sortie

3. **Vérification** :
   - `tsgo` type-check
   - Vérif visuelle rapide via Playwright sur `/expedier/envoyer` : ouvrir un devis (Dakar→Paris, 5 kg) et confirmer que le prix affiché est identique à avant

## Risques et parade
- **Risque principal** : oublier une valeur dérivée utilisée plus bas dans le JSX (`declaredEur` p.ex.) → je fais un `rg` sur chaque nom retourné avant/après pour m'assurer que tout est branché.
- **Non-régression prix** : le hook contient exactement les mêmes calculs, dans le même ordre, avec les mêmes deps `useMemo`/`useEffect`. Le garde-fou `assertPriceCoherence` reste actif en dev.
- **Étapes suivantes** (non incluses ici) : `useStepMachine` (validation/gates/goToStep/advanceFromStep) puis `useSendPreset` (restauration depuis location.state / draft).

## Résultat attendu
- `SendFlow.tsx` : ~2 480 → **~2 360 lignes** (–120)
- Nouveau `useSendPricing.ts` : ~140 lignes, testable en isolation plus tard
- Zéro changement visuel, zéro changement de prix

## Problème
Aujourd'hui le bouton sticky "Continuer" appelle directement `advanceFromStep(currentStep)` sans vérifier si l'étape en cours est valide. L'utilisateur passe à l'étape suivante même s'il a oublié des champs. Le surlignage rouge + scroll existe déjà mais seulement lors du `submit()` final.

## Solution

Réutiliser la mécanique de validation existante (`submitAttempted` + `sectionErrors` + `fieldErrors` + `scrollToFirstError()`) à chaque clic sur "Continuer", pas uniquement à la soumission finale.

### Changements dans `src/components/flows/SendFlow.tsx`

1. **`handleSummaryAction` (≈ ligne 2195)** — avant d'appeler `advanceFromStep(currentStep)` :
   - Lire `stepValidity[currentStep]`.
   - Si `false` : `setSubmitAttempted(true)`, appeler `scrollToFirstError()` ciblé sur la section de l'étape courante, et afficher un toast `Étape incomplète — Remplissez les champs surlignés en rouge.` Puis `return`.
   - Si `true` : continuer le flow normal (ne pas reset `submitAttempted` ici pour ne pas masquer d'autres erreurs).

2. **`scrollToFirstError()` (≈ ligne 614)** — accepter un argument optionnel `preferredSectionId?: string`. Si fourni et qu'il est en erreur, scroller vers lui en priorité plutôt que vers la première section invalide du flow. Mapping `currentStep → section id` (réutilisable depuis `STEP_DOM_ID` + ajout pour step 7).

3. **Étape 7 (`section-final`)** — déjà couverte par `sectionErrors['section-final']`. Le bouton sticky affiche déjà "Confirmer ma commande" en step 7, le chemin existant via `allReady` reste inchangé.

4. **Étapes 5 (transport) et 6 (récap)** — `stepValidity` les marque déjà `true`, donc rien à bloquer. Pas de changement.

### Résultat attendu
- L'utilisateur sur l'étape 1 (Collecte) clique "Continuer" sans avoir saisi date/créneau/adresse → la section devient `ring-2 ring-red-400/70`, les inputs concernés passent `aria-invalid`, le scroll cible le premier champ vide, un toast s'affiche.
- Même comportement pour étapes 2 (destinataire), 3 (colis), 4 (type marchandise), 7 (expéditeur).
- Une fois les champs remplis, le clic suivant avance comme d'habitude.

### Hors scope
- Pas de modification du calcul de pricing, du flow d'authentification, ni du composant `FlowPrimitives.tsx` (le bouton sélectionné est rendu par `LiveSummaryBar`, la logique vit dans `SendFlow.tsx`).

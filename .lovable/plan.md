
## Objectif

Rendre le `SendFlow` plus rigoureux et plus compact en formalisant la logique de rôle (sender / recipient / third-party), en consolidant le récapitulatif, et en ajoutant une validation explicite avec renvoi à l'étape concernée. Tout reste en frontend / présentation — pas de changement DB ni d'edge function.

## 1. Matrice de cas (rôle → champs)

Source de vérité unique dans `SendFlow.tsx` :

```text
Rôle utilisateur     Étape 1 (Identité)        Étape 2 (Collecte)         Étape 3 (Livraison)         Étape 4 (Colis)
sender               Mes infos                 Mon adresse + créneau      Coordonnées destinataire    Description + poids
recipient            Mes infos (=destinataire) Adresse expéditeur + slot  Mon adresse de livraison    Description + poids
third (mandataire)   Mes infos (payeur)        Adresse expéditeur + slot  Coordonnées destinataire    Description + poids
```

- Un objet `FIELD_MATRIX[role]` décrit pour chaque étape : `title`, `subtitle`, et la liste de champs à afficher (typés).
- Le rendu de chaque étape lit la matrice — plus de `if (role === 'sender')` éparpillés.
- Les libellés (« Vos coordonnées », « Coordonnées de l'expéditeur », « Coordonnées du destinataire ») sont dérivés du rôle, jamais codés en dur.
- Le rôle est déjà choisi en pré-étape (existant) ; on garde le toggle mais on le branche sur la matrice.

## 2. Validation au submit avec saut d'étape

- Une fonction `validateAll(state, role)` retourne `{ ok: boolean, errors: Record<FieldId, string>, firstInvalidStep: number }`.
- Au clic sur « Confirmer » du récapitulatif :
  - Si `!ok` → on stocke `errors` dans un state local `fieldErrors`, on `setStep(firstInvalidStep)`, on `scrollIntoView` la première erreur, et on affiche un toast « Complétez les champs en rouge ».
  - Les inputs concernés reçoivent `aria-invalid` + bordure rouge (`border-danger`, déjà géré par `Input`).
  - On efface l'erreur d'un champ dès qu'il est modifié.
- Pas de double validation par étape : on garde la progression libre, seule la confirmation finale bloque.

## 3. Récapitulatif ultra compact

Nouveau composant local `RecapTab` (rendu dans le `TabsContent value="recap"` existant) avec 4 sections :

```text
┌─ Personnes ─────────────────────  [Modifier]
│  Expéditeur · Awa Ndiaye · +221 …
│  Destinataire · Modou Sy · +223 …
├─ Collecte ──────────────────────  [Modifier]
│  Dakar · Sacré-Cœur 3 · Matin 8-12h
├─ Colis ─────────────────────────  [Modifier]
│  Électronique · 4 kg · 800 €
├─ Coût ──────────────────────────
│  Aérien · 7 j · 42 500 FCFA TTC
└─ [Confirmer l'envoi]
```

- Chaque section = `<section>` avec titre 11px uppercase muted, contenu 13px, et bouton `Modifier` (ghost, sm) qui appelle `setStep(n)` + bascule sur l'onglet « Étapes ».
- Densité : `divide-y border-[0.5px]`, padding vertical 12px, pas d'icônes décoratives.
- En cas d'erreurs après tentative de submit, chaque section incomplète gagne un point rouge à gauche du titre et un libellé « X champs manquants ».

## 4. Étape 4 (biens) — présentation premium et compacte

- Garder le sélecteur de description (chips à 2 colonnes mobile / 3 desktop) mais réduire le padding (py-2 px-3), retirer les descriptions longues en faveur d'un tooltip au survol.
- Remettre l'ancien sélecteur de poids (slider existant dans `FlowPrimitives`).
- Champ « Valeur déclarée » : input compact à droite du poids sur desktop.
- Quand l'étape 4 est validée et qu'on quitte (via Suivant ou Modifier depuis recap), repli en mode synthèse : « Électronique · 4 kg · 800 € · [Modifier] » comme les autres étapes (cohérence déjà introduite précédemment).
- L'avertissement corridor (`corridorRisk`) passe en bandeau compact sous la sélection, plus en encart pleine largeur.

## Détails techniques

- Aucun changement de schéma DB ni d'API.
- Fichiers touchés :
  - `src/components/flows/SendFlow.tsx` — matrice de rôles, validation, RecapTab, étape 4 redessinée.
  - `src/components/flows/FlowPrimitives.tsx` — exposer une prop `error?: string` sur `TextField` (déjà via `aria-invalid`, à vérifier) et un petit `SectionRow` réutilisable pour le récap si besoin.
- Tokens : utiliser `border-danger`, `text-danger`, `bg-danger/5` (déjà définis). Pas de couleur en dur.
- Le toggle de rôle existant et les drafts (`useFlowDraft`) sont conservés tels quels.

## Hors scope

- Pas de modification de `SourcingFlow` ou `ReceiveFlow`.
- Pas de changement de routing ni de persistance URL (déjà fait dans les loops précédentes).
- Pas de changement du moteur de quote / pricing.

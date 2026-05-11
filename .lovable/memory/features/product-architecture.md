---
name: product-architecture
description: 2-CTA architecture (Expédier/Sourcing), routes, and the rule that all jargon stays internal
type: feature
---
# Yobbanté — Architecture produit (post-refonte)

## Règle d'or
Le site public ne doit JAMAIS exposer plus de **2 entrées** :
1. **Expédier un colis** → `/expedier`
2. **Sourcing produit** → `/sourcing` (URL canonique)

## Routes
- `/` → LandingPage
- `/expedier` → ExpedierPage (`<DossierWizard presetIntent="ship" />`)
- `/sourcing` → SourcingPage (rend `SourcingFlow` directement, pas d'écran de sélection)
- `/acheter` → **redirect 301 → /sourcing** (legacy)
- `/acheter/sourcing` → redirect 301 → /sourcing
- `/acheter/recevoir` → AcheterPage (parcours merchant Amazon/AliExpress, conservé)
- `/expedier/recevoir` → flow Recevoir (alias)
- `/obtenir-adresse` → /expedier (legacy)
- `/confier-dossier` → /sourcing (legacy)

## Pourquoi /sourcing rend SourcingFlow direct
L'écran de sélection de /acheter (2 cartes Sourcing/Recevoir) provoquait une perception
de "page vide" — peu de contenu au-dessus du fold + animations motion. La page canonique
sert maintenant directement le formulaire pour garantir un contenu visible immédiat.

## Nav publique
PublicNav : Logo · Expédier · Sourcing · Dëkk · Réception · Suivre · Tarifs.

## Copy interdite en surface
"GP", "aérien/maritime/routier", "douane", "import/export", "FCL/LCL", "groupage", "dédouanement".
OK à l'intérieur du wizard une fois l'intent choisi.

---
name: product-architecture
description: 2-CTA architecture (Expédier/Acheter), routes, and the rule that all jargon stays internal
type: feature
---
# Yobbanté — Architecture produit (post-refonte)

## Règle d'or
Le site public ne doit JAMAIS exposer plus de **2 entrées** :
1. **Expédier un colis** → `/expedier`
2. **Acheter un produit** → `/acheter`

Tout le reste (sourcing, douane, GP/aérien/maritime/routier, import/export, adresses internationales, groupage) est une **mécanique interne** révélée uniquement à l'intérieur des flows.

## Routes
- `/` → LandingPage (hero 2-CTAs, How it works, Why, Trust, Final CTA)
- `/expedier` → ExpedierPage (ouvre `<DossierWizard presetIntent="ship" />`)
- `/acheter` → AcheterPage (ouvre `<DossierWizard presetIntent="buy" />`)
- `/obtenir-adresse` → redirect vers `/expedier` (legacy)
- `/confier-dossier` → redirect vers `/acheter` (legacy)
- `/services`, `/entreprises`, `/simulateur`, `/devis-entreprise` → accessibles uniquement via le footer

## Wizard (DossierWizard)
Accepte `presetIntent?: 'ship' | 'buy'`. Si fourni, skip l'écran 0 (intent split) et démarre directement step 1.
Le flow ship a 5 steps + success ; le flow buy a 5 steps + success (avec parsing produit via edge function `parse-product`).

## Nav publique
`PublicNav` n'expose plus que : Logo · Expédier · Acheter · Connexion · Mon espace.
Le burger mobile met les 2 CTAs en avant et range l'auth + pages secondaires en dessous.

## Copy interdite en surface
"GP", "aérien/maritime/routier", "douane", "import/export", "FCL/LCL", "groupage", "dédouanement". Ces termes sont OK à l'intérieur du wizard une fois l'intent choisi.

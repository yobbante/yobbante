---
name: design-tokens
description: Design system v2 — Primary CTA noir #1a1a1a, success vert #1D9E75, sans ombres ni gradients
type: design
---
# Design tokens — Yobbanté v2

## Couleurs
- **Primary CTA** `#1a1a1a` (noir) → boutons, --primary
- **Success** `#1D9E75` → bordure card featured (2px), --success, badges success
- **Warning** `#BA7517` → --warning
- **Danger** `#A32D2D` → --danger, --destructive
- **Background** `#FAF8F4` (primary), `#FFFFFF` (surface/card)
- **Foreground** `#141414` · **Muted** `#635F58` · **Tertiary** ~`#7A7670`
- **Border** `0.5px solid hsl(var(--color-border-tertiary))` partout
- **Card featured** `2px solid hsl(var(--success))`

## Typo
- H1 28/500/-0.02em · H2 18/500 · Body 14/400/1.6
- Label 11/500/UPPERCASE/0.08em (`.text-label`)
- Price 22-28/500/-0.02em (`.text-price`)
- Muted 12/text-tertiary (`.text-muted`)

## Cards
- bg `--background-surface` (#FFF) · radius 12px · padding 16-20px
- border 0.5px tertiary · **PAS d'ombre, PAS de gradient**
- Utilitaire: `.surface-card`, modifier `.card-featured`

## Buttons
- Primary `.btn-cta` → bg #1a1a1a · text white · radius 8px · padding 10×20 · 13px/500
- Touch target ≥ 44px sur mobile (auto via media query)

## Badges
- `.badge-success` (#E1F5EE / #085041) · `.badge-warning` (#FAEEDA / #633806) · `.badge-danger`
- radius 20px · 9-11px

## Inputs
- height 36-40px · bg surface · border 0.5px · radius 8px · `.input-base`

## Règles globales
- ZÉRO gradient, ZÉRO ombre, ZÉRO blur
- Prix toujours arrondis (jamais de décimales)
- XOF affiché sous EUR en 11px muted
- Mobile-first, 1 colonne < 640px

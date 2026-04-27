---
name: design-tokens
description: Palette neutre noir/blanc cassé, vert #33CCAD réservé aux CTA uniquement
type: design
---
# Design tokens — Yobbanté × Konnekt

## Palette
- **Background** `#0A0A0A` (noir profond), **Card** `#121212`, **Sidebar** `#0D0D0D`
- **Foreground** `#F7F5F2` (blanc cassé chaud), **Muted** `#A6A29E` (gris doux)
- **Borders/inputs** `#292929`
- **Accent (hover/highlight neutres)** `#242424` — JAMAIS le vert pour ces usages

## Vert de marque #33CCAD — RÉSERVÉ
Utiliser UNIQUEMENT pour :
- Boutons CTA (`btn-cta`, `bg-primary`)
- Focus ring (`--ring`)
- États actifs sidebar/onglets sélectionnés
- Sélection de texte (subtil, opacité 35%)

NE PAS utiliser le vert pour : bordures de cartes au hover, badges informatifs, liens de texte courants, illustrations de fond.

## Radius
14px partout (`--radius: 0.875rem`)

## Hover sur cards
`.hover-glow` → bordure neutre + fond accent neutre, PAS de vert.

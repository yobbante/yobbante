---
name: design-tokens
description: Palette éditoriale claire — blanc cassé dominant, noir profond ponctuel, vert #33CCAD réservé aux CTA
type: design
---
# Design tokens — Yobbanté × Konnekt

## Direction
**Éditorial premium clair.** Plus de blanc que de noir. Le noir est un accent, pas une dominante.

## Palette
- **Background** `#FAF8F4` (blanc cassé chaud, dominant)
- **Card** `#FFFFFF` (blanc pur, pour faire ressortir sur le fond cassé)
- **Secondary** `#F1ECE3` (beige doux)
- **Foreground** `#141414` (noir profond, lecture)
- **Muted-foreground** `#635F58` (gris chaud lisible)
- **Border** `#DDD7CB`
- **Sidebar** `#141414` (noir profond — seule grande surface noire)

## Vert de marque #33CCAD (en clair: hsl 168 60% 42% pour contraste WCAG)
**RÉSERVÉ EXCLUSIVEMENT** à :
- Boutons CTA (`btn-cta`, `bg-primary`)
- Focus ring (`--ring`)
- États actifs sidebar / onglets sélectionnés
- Sélection de texte (opacité 25%)
- Indicateurs de succès (refund "sent", etc.)

NE PAS utiliser le vert pour : bordures de cartes au hover, badges informatifs neutres, liens courants, fonds décoratifs.

## Radius
14px partout (`--radius: 0.875rem`)

## Hover sur cards
`.hover-glow` → bordure foncée subtile + ombre douce, PAS de vert.

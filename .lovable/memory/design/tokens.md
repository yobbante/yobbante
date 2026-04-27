---
name: Design tokens
description: Premium green design system (#33CCAD) — dark infrastructure aesthetic, semantic tokens, CTA classes
type: design
---

# Yobbanté × Konnekt — Premium Green Design System

## Brand color: #33CCAD (HSL 168 60% 50%)

| Token | Hex | HSL | Usage |
|---|---|---|---|
| `--primary` | #33CCAD | 168 60% 50% | CTA, active states, highlights |
| `--primary-hover` | #2BB89C | 168 62% 45% | hover |
| `--primary-active` | #249E88 | 168 63% 38% | pressed |
| `--primary-soft` | #E6FAF6 | 168 70% 95% | badges, soft surfaces |
| `--primary-foreground` | near-black | 168 80% 6% | text on green CTA |

## Surfaces (dark green infrastructure)

| Token | Hex |
|---|---|
| `--background` | #061A17 |
| `--secondary` | #0B2621 |
| `--card` | #0F332C |
| `--border` | dark green-grey |

## Text

- Primary: white (#FFFFFF)
- Secondary / muted: #A8CFC6 (168 25% 73%)

## Radius
- `--radius`: 14px (0.875rem) — premium feel

## Component classes (in src/index.css)
- `.btn-cta` — primary green CTA, 14px radius, `box-shadow: var(--shadow-cta)`, hover lift + scale 1.02
- `.btn-cta-yellow` — alias of `.btn-cta` (legacy back-compat)
- `.surface-card` — gradient surface + shadow
- `.glow-primary` — green glow ring
- `.text-gradient` — gradient text fill
- `.input-glow` — focus ring on inputs
- `.hover-glow` — card hover lift

## Animations (tailwind.config.ts)
`fade-in`, `slide-up`, `scale-in`, `glow-pulse`, `marquee`, `accordion-*`

## Rules
- Green = ACTION ONLY. Never decorative.
- Strong contrast: green on dark background only.
- Avoid: full green backgrounds, multiple green nuances, green + other flashy color.
- Use semantic tokens (`bg-primary`, `text-primary`, `bg-card`) — never raw hex in components.

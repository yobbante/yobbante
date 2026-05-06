# Project Memory

## Core
Design system v2: Primary CTA #1a1a1a noir. Success #1D9E75. Warning #BA7517. Danger #A32D2D.
Bg #FAF8F4 / surface #FFF. Borders 0.5px tertiary. Cards radius 12px. Buttons radius 8px.
ZÉRO gradient, ZÉRO ombre, ZÉRO blur. Prix arrondis (jamais décimales). XOF sous EUR en 11px muted.
Toasts: bg card + accent gauche 3px (success/warning/danger/foreground). Bottom sheet: rounded-t-[16px].
Capacity bars: 4px height, vert <70 / amber 70-89 / rouge ≥90. Featured card: 2px solid success.
Badges: pill 10-11px medium via Badge variants (success/warning/danger/outline) ou .badge-* classes.
YOBBANTÉ — logistics orchestration platform. Timeline-first UI, no dashboards.
Supabase with RLS. All tables scoped to auth.uid(). Enums for status/country.
Konnekt API mocked for now. Dev panel: Ctrl+Shift+D.
Mobile: bottom nav (Home/Shipments/Profile). Desktop: top nav. Touch targets ≥ 44px.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: profiles, addresses, packages, shipments, timeline_events with enums
- [Auth](mem://features/auth) — Email+password + Google OAuth via Lovable Cloud. Auto-create profile+addresses on signup
- [State Machine](mem://features/state-machine) — Package: CREATED→RECEIVED→IN_STORAGE→READY_TO_SHIP→SHIPPED→DELIVERED. No backward transitions.
- [Design Tokens](mem://design/tokens) — v2: noir CTA, success vert, no shadows/gradients, typography scale

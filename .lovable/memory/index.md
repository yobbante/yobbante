# Memory: index.md
Updated: today

# Project Memory

## Core
Premium green dark theme. Brand: #33CCAD (HSL 168 60% 50%). Background #061A17, cards #0F332C. Radius 14px.
Green = ACTION only (CTA, active, highlights). Never decorative. Always green-on-dark, strong contrast.
YOBBANTÉ — logistics orchestration platform. Timeline-first UI, no dashboards.
Public site exposes ONLY 2 entries: /expedier and /acheter. /services & /simulateur redirect into flows.
Supabase with RLS. All tables scoped to auth.uid(). Enums for status/country.
Package status is FORWARD-ONLY (DB trigger enforce_package_status_forward + frontend canTransitionPackage in src/lib/packageStatus.ts).
Realtime: useTimeline subscribes to timeline_events INSERT/UPDATE/DELETE and mutates cache in-place. Tables packages/shipments/timeline_events have REPLICA IDENTITY FULL.
Konnekt API mocked for now. Dev panel: Ctrl+Shift+D.
Mobile: bottom nav (Home/Shipments/Profile). Desktop: top nav.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: profiles, addresses, packages, shipments, timeline_events with enums
- [Auth](mem://features/auth) — Email+password + Google OAuth via Lovable Cloud. Auto-create profile+addresses on signup
- [State Machine](mem://features/state-machine) — Package: CREATED→RECEIVED→IN_STORAGE→READY_TO_SHIP→SHIPPED→DELIVERED. Backward transitions blocked by DB trigger AND frontend guard.
- [Design Tokens](mem://design/tokens) — Dark theme, glow utilities, text-gradient, surface colors
- [Product Architecture](mem://features/product-architecture) — 2-CTA architecture (Expédier/Acheter), routes, jargon-free public surface

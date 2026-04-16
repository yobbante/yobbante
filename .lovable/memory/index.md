# Project Memory

## Core
Light white theme (#FFFFFF). Primary: Apple blue (211 100% 45%). 12px radius.
YOBBANTÉ — logistics orchestration platform. Timeline-first UI, no dashboards.
Supabase with RLS. All tables scoped to auth.uid(). Enums for status/country.
Anti-template: no gradients, no generic icon grids, typography-first hierarchy.
6 warehouses: FR, CN, US, CA, AE, DE. French UI copy.
Mobile: bottom nav (Home/Shipments/Profile). Desktop: top nav.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: profiles, addresses, packages, shipments, timeline_events with enums
- [Auth](mem://features/auth) — Email+password + Google OAuth via Lovable Cloud. Auto-create profile+addresses on signup
- [State Machine](mem://features/state-machine) — Package: CREATED→RECEIVED→IN_STORAGE→READY_TO_SHIP→SHIPPED→DELIVERED. No backward transitions.
- [Design Tokens](mem://design/tokens) — Light Apple HIG theme, solid colors, no gradients, system font stack

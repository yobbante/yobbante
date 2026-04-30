# Memory: index.md
Updated: now

# Project Memory

## Core
Dark navy theme (#0A0E1A). Primary: electric blue (217 91% 60%). 14px radius.
YOBBANTÉ — logistics orchestration platform. Timeline-first UI, no dashboards.
Supabase with RLS. All tables scoped to auth.uid(). Enums for status/country.
Konnekt API mocked for now. Dev panel: Ctrl+Shift+D.
Mobile: bottom nav (Home/Shipments/Profile). Desktop: top nav.
Auth: Google + Apple OAuth only (Lovable Cloud managed). Email/password is removed/hidden from UI.
Pricing: `calculate_quote_v2` v_margin = 1.22 (origin spec). Do not lower without owner approval.
Cities: strict 36-city catalog in `worldCities.ts`. Dakar is the hub — never in selectable list, always locked via `HUB_DAKAR`/`<DakarHubLock>`.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: profiles, addresses, packages, shipments, timeline_events with enums
- [Auth](mem://features/auth) — Email+password + Google OAuth via Lovable Cloud. Auto-create profile+addresses on signup
- [State Machine](mem://features/state-machine) — Package: CREATED→RECEIVED→IN_STORAGE→READY_TO_SHIP→SHIPPED→DELIVERED. No backward transitions.
- [Design Tokens](mem://design/tokens) — Dark theme, glow utilities, text-gradient, surface colors
- [City catalog](mem://features/city-catalog) — 36-city list + Dakar hub lock pattern

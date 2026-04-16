# Project Memory

## Core
Light white theme, Apple HIG. Primary: #0071E3 (211 100% 45%). 12px radius.
YOBBANTÉ — logistics orchestration platform. Timeline-first UI.
Supabase with RLS. All tables scoped to auth.uid(). Enums for status/country.
SF Pro system font stack. No dark mode. No glow utilities.
Landing page at /. App dashboard at /app. Auth inline.
Mobile: bottom nav (Home/Shipments/Profile). Desktop: top nav.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: profiles, addresses, packages, shipments, timeline_events with enums
- [Auth](mem://features/auth) — Email+password + Google OAuth via Lovable Cloud. Auto-create profile+addresses on signup
- [State Machine](mem://features/state-machine) — Package: CREATED→RECEIVED→IN_STORAGE→READY_TO_SHIP→SHIPPED→DELIVERED. No backward transitions.
- [Design Tokens](mem://design/tokens) — Light Apple HIG theme, secondary=#F5F5F7, muted=#86868B, border=#D2D2D7

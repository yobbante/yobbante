# Project Memory

## Core
Light white theme (#FFFFFF). Primary: Apple blue (211 100% 45%). 12px radius.
YOBBANTÉ — opérateur logistique end-to-end (sourcing, achat, transport, douane, livraison). Pas un fournisseur d'adresses.
Timeline-first UI, no dashboards. Dossier est l'entité métier centrale (B2B), adresses + groupage = offre B2C.
Supabase with RLS. All tables scoped to auth.uid(). Enums for status/country.
Anti-template: no gradients, no generic icon grids, typography-first hierarchy, sections à identité visuelle distincte.
6 warehouses: FR, CN, US, CA, AE, DE. French UI copy.
Mobile: bottom nav (Home/Shipments/Profile). Desktop: top nav. Landing: nav avec Services/Adresses/Simulateur/Dossier.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: profiles, addresses, packages, shipments, timeline_events, dossiers (avec enum dossier_status 8 stages)
- [Auth](mem://features/auth) — Email+password + Google OAuth via Lovable Cloud. Auto-create profile+addresses on signup
- [State Machine](mem://features/state-machine) — Package: CREATED→RECEIVED→IN_STORAGE→READY_TO_SHIP→SHIPPED→DELIVERED. Dossier: SUBMITTED→IN_REVIEW→SOURCING→PROCURED→IN_TRANSIT→CUSTOMS→DELIVERED→CLOSED
- [Design Tokens](mem://design/tokens) — Light Apple HIG theme, solid colors, no gradients, system font stack


# YOBBANTÉ — Logistics Orchestration Platform

## Overview
A premium, timeline-first logistics platform where users buy products globally, receive them in international warehouses, and get them delivered locally. Dark, minimal design inspired by Linear/Stripe.

---

## Phase 1: Foundation

### Database Schema (Supabase + Lovable Cloud)
- **users** — leverages Supabase auth
- **profiles** — id, user_id (FK auth.users), full_name, default_delivery_country, created_at
- **addresses** — id, user_id, country (enum: FR, CN, US), address_line, identifier_code (unique per user+country), created_at
- **packages** — id, user_id, warehouse_country, status (enum: CREATED → RECEIVED → IN_STORAGE → READY_TO_SHIP → SHIPPED → DELIVERED), weight, shipment_id (nullable FK), description, created_at
- **shipments** — id, user_id, status (enum: PENDING → IN_TRANSIT → CUSTOMS → DELIVERED), total_cost, eta, transport_type, konnekt_id, origin_country, destination_country, created_at
- **timeline_events** — id, user_id, event_type, title, description, metadata (jsonb), related_package_id, related_shipment_id, created_at

### Security
- RLS on all tables: `user_id = auth.uid()`
- Security-definer helper function for role checks

### Auth
- Email + Password + Google OAuth
- On signup trigger: auto-create profile + 3 warehouse addresses (France, China, USA) with unique identifier codes

---

## Phase 2: Design System

### Theme (Dark Mode Default)
- Background: deep navy (`#0A0E1A`)
- Surface: `#111827`
- Accent: electric blue (`#3B82F6`) with neon glow variants
- Text: white primary, muted gray secondary
- Border radius: 14px, soft shadows, no heavy borders

### Typography
- Large bold titles (tracking tight)
- Clean hierarchy with generous whitespace

### Micro-interactions
- Hover scale (1.02) with spring easing
- Skeleton loading states
- Smooth status transitions with subtle animations

---

## Phase 3: Core UI — Timeline-First Interface

### Home Screen
1. **Action Bar** — 3 minimal CTAs: "Track Package", "Ship Now", "Buy Product"
2. **Smart Timeline** — Real-time event feed with clickable items, contextual CTAs, country flag emojis, and subtle entrance animations
3. **Active Shipments** — Route visualization (origin → destination), animated progress bar, ETA display
4. **Warehouse Addresses** — Country + address + copy-to-clipboard, minimal card layout

### Shipments Page
- List of all shipments with status badges
- Shipment detail view with package list, route, and tracking
- Smart consolidation prompt: "You have 3 packages in France — save by shipping together"

### Profile Page
- Account settings, delivery country configuration
- Warehouse addresses management

### Mobile Layout
- Bottom navigation (3 items): Home, Shipments, Profile
- Native-app feel with gesture-friendly spacing

---

## Phase 4: Business Logic

### Auto Address Generation
- Database trigger on user signup creates FR/CN/US addresses with generated identifier codes

### Package State Machine
- Enforced enum transitions (no backward moves)
- Timeline events auto-created on each status change

### Smart Consolidation
- When multiple packages sit in the same warehouse, surface a consolidation suggestion with estimated savings

### Idle Package Alerts
- Packages in storage >48h trigger a "Ready to ship?" prompt in the timeline

### Conversion Triggers
- Badge: "2 packages waiting"
- CTA: "Save money by grouping shipments"
- Bold, high-contrast action buttons

---

## Phase 5: Konnekt Integration (Mocked)

### Edge Functions
- `create-shipment` — POST to mock Konnekt API, creates shipment record, returns tracking
- `konnekt-webhook` — receives status updates, syncs shipment status, creates timeline events
- Built with retry logic and failure fallback stubs, ready for real API swap

---

## Phase 6: Dev/Test Mode

### Hidden Dev Panel (activated via keyboard shortcut)
- Simulate: package arrival, shipment creation, delivery
- Trigger any status transition
- Reset test data

---

## Architecture
- Reusable component library (StatusBadge, TimelineItem, ShipmentCard, AddressCard, ActionBar)
- Custom hooks: `usePackages`, `useShipments`, `useTimeline`, `useConsolidation`
- Service layer separating UI from business logic
- Lazy-loaded routes, optimistic updates, skeleton screens



# YOBBANTÉ — Design Overhaul: Anti-Template, Apple HIG

## Problem
The current landing page is a generic SaaS template: every section uses the same centered-text-plus-grid pattern, same `bg-secondary/50` alternation, same `rounded-2xl border border-border` cards. No personality, no visual rhythm, no brand presence. The dashboard is flat and undifferentiated.

---

## Landing Page — 9 Unique Sections

Each section has a distinct visual identity. No gradients. No generic icon grids. Solid colors, whitespace, typography hierarchy.

| # | Section | Visual Treatment |
|---|---------|-----------------|
| 1 | **Nav** | Sticky white bar. Logo left, section anchors center (Services, Adresses, Comment ça marche), Sign In + CTA right. No blur/glass effect — clean solid white with hairline bottom border |
| 2 | **Hero** | Left-aligned on desktop (not centered). Massive 72px headline "Achetez partout. Recevez chez vous." Small pill badge above. Two stacked CTAs. Right side: a simple visual — 3 stacked address cards (FR/CN/US) as a product preview, not an illustration |
| 3 | **How it Works** | White bg. Horizontal numbered steps connected by a thin line (not cards). Step number in a 32px circle, title below, 1-line desc. Feels like a progress bar, not a card grid |
| 4 | **Services** | Full-width. 6 services in a 3×2 grid on desktop, stacked on mobile. Each service: large step number (01–06), bold title, 2-line desc. No icons, no cards — just clean typography rows with a left border accent. Services: Import Complet, Adresses Internationales, Groupage, Sourcing, Dédouanement, Livraison |
| 5 | **Warehouses** | Light gray `bg-secondary` section. 6 country cards (FR, CA, CN, AE, DE, US) in a responsive grid. Each: oversized flag (48px), country name, one-line value prop. Cards are white with hover shadow — the only section using cards |
| 6 | **How Addresses Work** | White bg. Left column: 5 numbered steps as a vertical list (Receive address → Shop → We receive → Verify/Store → Ship). Right column: static mockup of an address card with the identifier code. Asymmetric two-column layout |
| 7 | **Numbers** | Full-width `bg-foreground text-background` (black bg, white text). 4 metrics in a row: 6 Entrepôts, 150+ Pays, 48h Livraison, 10K+ Colis. Large bold numbers, small labels. The dark inversion creates a visual break |
| 8 | **CTA** | White bg. Centered. Simple headline + subtitle + single primary button. No decoration |
| 9 | **Footer** | 3-column: Brand + tagline, Links (Services, Adresses, Contact), Legal. Hairline top border |

**Key design rules:**
- No `bg-secondary/50` alternation — use solid white / solid `bg-secondary` / solid black for contrast
- No rounded icon-in-box pattern everywhere — reserve it for one section max
- Typography-first: let font size and weight create hierarchy, not borders and shadows
- French copy (matching the brand's positioning document)

---

## Dashboard Improvements

### Index.tsx
- Increase `max-w-2xl` to `max-w-3xl` for desktop breathing room

### HomeView
- **ActionBar**: Replace flat buttons with 3 vertical cards — each 80px tall with icon top, title, subtitle. White bg, border, hover shadow. More visual weight
- **Section headers**: Replace uppercase tracking-wider style with normal-case 16px semibold + optional count badge
- **Empty state**: Larger icon (48px), more descriptive text, primary CTA button instead of just text

### ShipmentsView
- Add `Tabs` component (from shadcn) for Packages/Shipments toggle instead of stacking both
- Package rows: add a colored dot before the description (status color)

### ProfileView
- Group into Apple Settings-style sections with rounded `bg-card` containers and section labels
- Sections: Account, Delivery Preferences, Warehouse Addresses, Actions (sign out)

### Auth Page
- Add `YOBBANTÉ` wordmark with larger size (text-4xl)
- Add a tagline below: "Votre logistique, simplifiée."
- Remove the `bg-secondary border-0` input styling — use proper bordered inputs for light theme clarity

---

## Types Update

Expand `WarehouseCountry` to include `'CA' | 'AE' | 'DE'` with corresponding flags and names in `COUNTRY_FLAGS` and `COUNTRY_NAMES`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/LandingPage.tsx` | Full rewrite — 9 unique sections, French copy, no template patterns |
| `src/pages/HomeView.tsx` | ActionBar cards, section headers, empty states |
| `src/pages/ShipmentsView.tsx` | Add Tabs toggle |
| `src/pages/ProfileView.tsx` | Settings-style grouped sections |
| `src/pages/Auth.tsx` | Larger wordmark, bordered inputs |
| `src/pages/Index.tsx` | max-w-3xl |
| `src/components/ActionBar.tsx` | Vertical card layout with subtitle |
| `src/lib/types.ts` | Add CA, AE, DE countries |
| `mem://index.md` | Update |
| `mem://design/tokens.md` | Update with anti-template rules |


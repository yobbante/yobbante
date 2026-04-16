

# YOBBANTÉ — Full Redesign: Light Theme + Apple HIG + Landing Page

## Summary

Complete visual overhaul from dark navy to a clean white/light theme following Apple Human Interface Guidelines. Fix all design inconsistencies, add a high-converting landing page, and polish the entire app to production-ready 2026 standards.

---

## 1. Design System — Light Theme Overhaul

**What changes:**
- Replace all CSS custom properties in `src/index.css` with a light Apple-inspired palette
- Background: pure white (`#FFFFFF`) / light gray (`#F5F5F7`) surfaces
- Foreground: near-black (`#1D1D1F`) text
- Primary accent: refined blue (`#0071E3` — Apple blue)
- Muted: `#86868B`, borders: `#D2D2D7`
- Remove `glow-*` utilities (dark-theme artifact), replace with subtle `shadow-sm` elevations
- Remove `text-gradient` class, use solid color headings
- Update `tailwind.config.ts` colors, remove `surface`, `glow` tokens
- Cards: white with `#F5F5F7` hover, 12px radius, `shadow-sm` on hover
- Typography: SF Pro-inspired — system font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display'`)

**Files:** `src/index.css`, `tailwind.config.ts`

## 2. Component Fixes & Apple HIG Polish

Every component updated to light theme with proper hierarchy:

| Component | Issues | Fix |
|-----------|--------|-----|
| `ActionBar` | Dark `bg-card`, `border-border/50` | White cards, subtle shadow, larger touch targets (48px min) |
| `BottomNav` | `bg-background/80` dark blur | White blur `bg-white/80`, iOS-style tab bar with proper safe area |
| `DesktopNav` | Dark gradient text | Clean black wordmark, light header with bottom border |
| `ShipmentCard` | Dark card, `border-border/50` | White card, hover shadow elevation, cleaner route display |
| `AddressCard` | Dark card, `bg-muted` code block | Light gray surface, refined copy button |
| `TimelineItem` | Dark hover states, tinted icon backgrounds | Light tinted circles, Apple-style list rows |
| `StatusBadge` | Dark-themed color tokens (`text-amber-400`) | Light-friendly badge colors (`text-amber-600`, `bg-amber-50`) |
| `DevPanel` | Dark floating panel | Light panel with proper shadow and backdrop |
| `Skeleton` | `bg-muted` (dark) | Light gray pulse animation |
| `Button` | Blue on dark | Proper Apple-style button hierarchy |

**Files:** All component files listed above

## 3. Page Redesign

### Auth Page (`src/pages/Auth.tsx`)
- Centered minimal form on white background
- Apple-style large heading, clean input fields with light borders
- Remove `text-gradient`, use solid black title
- Subtle card container with shadow

### Home Page (`src/pages/HomeView.tsx`)
- Clean white background, proper section spacing (Apple's 80px+ sections)
- Greeting: refined typography, no `md:hidden` restriction
- Cards with subtle elevation on hover, not border color changes

### Shipments Page (`src/pages/ShipmentsView.tsx`)
- Clean list view with Apple-style grouped sections
- Better empty states with illustration-style messaging

### Profile Page (`src/pages/ProfileView.tsx`)
- Apple Settings-style grouped sections
- Proper form field styling for light theme

### NotFound Page (`src/pages/NotFound.tsx`)
- Updated to match light theme

**Files:** All page files

## 4. Landing Page (NEW)

Create `src/pages/LandingPage.tsx` — a high-converting marketing page for unauthenticated users.

**Structure:**
1. **Hero** — Bold headline ("Shop anywhere. Ship everywhere."), subtitle, primary CTA "Get Started", secondary "Learn More"
2. **How It Works** — 3-step visual: Shop globally → We receive it → Delivered to you. Clean icons, numbered steps
3. **Warehouse Locations** — FR/CN/US cards with flags, showing the value proposition
4. **Features Grid** — Smart consolidation, real-time tracking, auto-optimization. 2x2 grid with icons
5. **Social Proof** — Metrics: "3 Warehouses", "150+ Countries", "48h Delivery"
6. **CTA Section** — Final conversion block: "Start shipping smarter today" + signup button

**Design:** Full-width sections, generous whitespace, Apple-style typography hierarchy, subtle scroll animations with framer-motion.

**Routing update in `src/App.tsx`:**
- `/` → Landing page (public)
- `/app` → Dashboard (authenticated, Index component)
- Auth page accessible from landing CTA

**Files:** `src/pages/LandingPage.tsx`, `src/App.tsx`, `src/pages/Index.tsx`

## 5. Missing Functionality & Polish

- **Toast styling**: Update Sonner theme to light mode
- **Loading states**: Refine spinner to Apple-style (not just border-spin)
- **Empty states**: Better messaging with contextual illustrations
- **Responsive**: Ensure all components work 390px–1400px+
- **Safe areas**: Proper `env(safe-area-inset-bottom)` for iOS bottom nav
- **Accessibility**: Proper focus rings, contrast ratios for light theme (WCAG AA)
- **Font stack**: Add system font override in index.css for Apple feel

## 6. Memory Update

Update `mem://index.md` and `mem://design/tokens` to reflect the new light theme system.

---

## Technical Details

### CSS Variable Changeset (index.css)
```
--background: 0 0% 100%        (white)
--foreground: 0 0% 11%          (#1D1D1F)
--card: 0 0% 100%               (white)
--primary: 211 100% 45%         (#0071E3)
--secondary: 240 5% 96%         (#F5F5F7)
--muted: 240 5% 96%
--muted-foreground: 0 0% 53%    (#86868B)
--border: 0 0% 82%              (#D2D2D7)
--destructive: 0 84% 60%
--radius: 0.75rem               (12px)
```

### File Count
- **Modified:** ~20 files (all components, pages, CSS, tailwind config, App.tsx)
- **Created:** 1 file (LandingPage.tsx)
- **Memory:** 2 files updated


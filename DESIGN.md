---
name: PocketKirana Master Design System
version: 2.0.0
format: awesome-design-md (VoltAgent standard)
author: PocketKirana Design & Engineering
updated: 2026-09-19
colors:
  # Primary Brand Palette (Fresh Leaf & Quick-Commerce Emerald)
  primary: '#0F532B'
  primary-light: '#1B733D'
  primary-dark: '#0A3B1E'
  primary-surface: '#E8F5E9'
  primary-container: '#22C55E'
  on-primary: '#FFFFFF'
  on-primary-container: '#004B1E'

  # Secondary & Accent (Sunburst Orange / Urgency / Deals)
  accent: '#FF7A00'
  accent-light: '#FFA040'
  accent-dark: '#D96200'
  accent-surface: '#FFF3E0'
  accent-container: '#FFEDD5'
  on-accent: '#FFFFFF'

  # Flash Deal / Special Savings
  deal-tag: '#E11D48'
  deal-surface: '#FFE4E6'
  savings-green: '#15803D'
  savings-surface: '#DCFCE7'

  # Neutrals & Surfaces (Modern Soft-Tactile)
  background: '#F8FAFC'
  background-dark: '#0B0F14'
  surface: '#FFFFFF'
  surface-dark: '#151B23'
  surface-card: '#FFFFFF'
  surface-card-dark: '#182130'
  surface-subtle: '#F1F5F9'
  surface-subtle-dark: '#1E293B'
  surface-border: '#E2E8F0'
  surface-border-dark: '#334155'

  # Text & Content
  text-primary: '#0F172A'
  text-primary-dark: '#F8FAFC'
  text-secondary: '#475569'
  text-secondary-dark: '#94A3B8'
  text-muted: '#94A3B8'
  text-muted-dark: '#64748B'

  # Feedback & State
  success: '#10B981'
  success-surface: '#D1FAE5'
  warning: '#F59E0B'
  warning-surface: '#FEF3C7'
  error: '#EF4444'
  error-surface: '#FEE2E2'
  info: '#0284C7'
  info-surface: '#E0F2FE'

  # Dietary & Operational Badges
  veg-green: '#16A34A'
  non-veg-red: '#DC2626'
  egg-yellow: '#D97706'

typography:
  font-family:
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    display: 'Outfit, Inter, sans-serif'
    mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

  scale:
    display-xl: { fontSize: '40px', fontWeight: '800', lineHeight: '48px', letterSpacing: '-0.03em' }
    display-lg: { fontSize: '32px', fontWeight: '800', lineHeight: '40px', letterSpacing: '-0.02em' }
    headline-lg: { fontSize: '24px', fontWeight: '700', lineHeight: '32px', letterSpacing: '-0.02em' }
    headline-md: { fontSize: '20px', fontWeight: '700', lineHeight: '28px', letterSpacing: '-0.01em' }
    headline-sm: { fontSize: '18px', fontWeight: '600', lineHeight: '24px' }
    title-lg: { fontSize: '16px', fontWeight: '700', lineHeight: '22px' }
    title-md: { fontSize: '14px', fontWeight: '700', lineHeight: '20px' }
    body-lg: { fontSize: '16px', fontWeight: '400', lineHeight: '24px' }
    body-md: { fontSize: '14px', fontWeight: '400', lineHeight: '20px' }
    body-sm: { fontSize: '12px', fontWeight: '500', lineHeight: '16px' }
    label-lg: { fontSize: '13px', fontWeight: '600', lineHeight: '18px' }
    label-md: { fontSize: '11px', fontWeight: '700', lineHeight: '14px', letterSpacing: '0.02em' }
    label-sm: { fontSize: '10px', fontWeight: '800', lineHeight: '12px', letterSpacing: '0.04em' }
    price-hero: { fontSize: '22px', fontWeight: '900', lineHeight: '26px' }
    price-card: { fontSize: '15px', fontWeight: '800', lineHeight: '18px' }
    price-mrp: { fontSize: '12px', fontWeight: '500', lineHeight: '14px', textDecoration: 'line-through' }

elevation:
  shadow-card: '0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 1px 4px -1px rgba(15, 23, 42, 0.04)'
  shadow-card-hover: '0 12px 24px -4px rgba(15, 23, 42, 0.1), 0 4px 12px -2px rgba(15, 23, 42, 0.05)'
  shadow-floating: '0 20px 32px -8px rgba(15, 83, 43, 0.25), 0 8px 16px -4px rgba(15, 23, 42, 0.08)'
  shadow-sheet: '0 -8px 24px -4px rgba(15, 23, 42, 0.12)'
  backdrop-blur: 'blur(12px)'

radii:
  badge: '6px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  card: '20px'
  modal: '28px'
  sheet: '32px 32px 0 0'
  pill: '9999px'

motion:
  duration-fast: '150ms'
  duration-normal: '250ms'
  duration-slow: '400ms'
  ease-spring: 'cubic-bezier(0.16, 1, 0.3, 1)'
  ease-smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
---

# PocketKirana Master Design System (`awesome-design-md`)

PocketKirana is an ultra-fast, 10-minute grocery delivery and local kirana ecosystem designed specifically for Indian consumers, store managers, pickers, and delivery partners.

---

## 1. Visual Philosophy & Core Pillars

### 🌿 Freshness & Vitality
Deep, lush emerald greens (`#0F532B` to `#22C55E`) combined with crisp white cards evoke fresh farm produce, dairy, and trusted staples.

### ⚡ 10-Minute Velocity & High Conversion
Prominent 10-minute express delivery tags, instant 1-tap cart steppers, live animated delivery tracking radars, and high-visibility savings chips.

### 🤝 Trust, Clarity & Zero Cognitive Friction
- Real-time inventory badges with exact unit packaging (e.g. `500 g`, `1 kg`, `Pack of 2`).
- Strict Veg (Green dot) / Non-Veg (Red triangle) / Egg (Yellow circle) compliance on every food item.
- Dual pricing showing both selling price and struck-through MRP with exact `% OFF` savings chips.

---

## 2. Surface-Specific UX Architecture

### 🛒 Surface A: Customer Web Platform (Desktop / Tablet)
- **Header:** Sticky, backdrop-blurred navigation with pincode serviceability detector, rich search bar with autocomplete suggestions, quick category mega-menu, and cart drawer trigger with real-time total.
- **Hero & Promotions:** Dual promo banners and live AI festival campaign canvas with rich gradients and countdown timers.
- **Product Grid:** Responsive 4 to 6 column card grid with image hover zoom, instant "+ ADD" stepper transition, and savings badges.
- **Floating Cart Bar:** Mobile/tablet bottom tray showing item count, total price, and "Proceed to Checkout" button.

### 📱 Surface B: Customer Mobile PWA (iOS / Android)
- **Top Bar:** 1-line location address picker with delivery ETA pill (`⚡ 10 MINS`).
- **Category Split Catalog:** Vertical left-side sticky category rail (with icons and active indicator bar) + 2-column scrollable product grid.
- **Cart & Checkout Bottom Sheet:** Sliding sheet with item summary, delivery address picker, payment gateway selector (PhonePe / Razorpay / COD), and single-tap order placement.
- **Live Order Radar:** Step-by-step circular tracking (Confirmed $\to$ Packing $\to$ Out for Delivery $\to$ Delivered) with rider location and OTP card.

### 🛵 Surface C: Delivery Partner App
- **Duty Header:** Single-tap Online/Offline toggle with pulse indicator and GPS hardware status guard.
- **Order Cards:** High-contrast, sunlight-legible typography with customer address, distance (`km`), delivery fee (`₹40`), and call-to-customer action.
- **Workflow Pipeline:**
  1. `ACCEPT` $\to$ 2. `PICKUP FROM HUB` $\to$ 3. `OUT FOR DELIVERY` $\to$ 4. `ARRIVED AT CUSTOMER` $\to$ 5. `VERIFY 4-DIGIT OTP` $\to$ 6. `COLLECT COD / COMPLETE`.
- **Dispatch Messages:** Live operational broadcasts and store notices with immediate Store Dispatch dialer.

### 📦 Surface D: Store Picker App
- **Ergonomics:** Oversized tap targets designed for one-handed store picking with haptic confirmations.
- **Task HUD:** Displays order number, customer item count, target completion timer (< 8 mins), and shelf storage coordinates (`A-02-B`).
- **Scanning & FEFO Safety:** Barcode scanner modal, expiry date safety check, quantity increment stepper, and bag seal checklist.

### 📊 Surface E: Unified Admin Console
- **Dashboard Radar:** Real-time metrics (Orders today, GMV, Active Riders, Picking SLA, Inventory Out-of-Stock).
- **Control Bar:** Emergency circuit breaker (`killSwitchActive`), festival campaign publisher, invoice generator, and driver fleet settlements.

---

## 3. Reusable Component Design Tokens

### 🔘 Buttons
- **Primary Action:**
  ```css
  background: #0F532B;
  color: #FFFFFF;
  border-radius: 14px;
  font-weight: 800;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(15, 83, 43, 0.25);
  transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
  ```
- **Cart Stepper Button (`+` / `-`):**
  - Unadded: White background, emerald border (`#0F532B`), bold text `ADD`.
  - Added: Emerald background (`#0F532B`), white text, animated stepper `[-]  qty  [+]`.

### 🃏 Product Card
```text
┌──────────────────────────────────────┐
│ [veg/non-veg]               [15% OFF]│
│                                      │
│           [Product Image]            │
│                                      │
│ 500 g                                │
│ Aashirvaad Superior MP Sharbati Atta │
│ ⭐ 4.8 (1.2k)                        │
│                                      │
│ ₹245  ₹290                    [ADD] │
└──────────────────────────────────────┘
```

### 🏷️ Dietary Badges
- **Pure Veg:** `border: 1.5px solid #16A34A;` with a solid `6px` green circle inside a `14px` white square.
- **Non-Veg:** `border: 1.5px solid #DC2626;` with a solid red triangle.
- **Contains Egg:** `border: 1.5px solid #D97706;` with a solid yellow circle.

---

## 4. UI/UX Rules for AI Coding Agents

When generating or editing any UI page in PocketKirana:
1. **Always Use Established Tokens:** Never use raw colors like plain `#ff0000` or `#0000ff`. Use the curated semantic palette defined in `DESIGN.md`.
2. **Never Show Blank Skeletons on Error:** Always handle empty states with custom friendly illustrations, descriptive copy, and a high-converting CTA (e.g., "Browse All Products").
3. **No Unfinished UI Placeholders:** Every button must either perform a real API/store action or be intentionally disabled with a clear tool tip.
4. **Mobile First Responsive Design:** Ensure bottom navigation and floating cart drawers do not overlap page content (use `pb-20` on scroll containers).
5. **Dark Mode Cohesion:** When rendering dark surfaces, use `#151B23` for cards and `#0B0F14` for page backgrounds with `#334155` borders.

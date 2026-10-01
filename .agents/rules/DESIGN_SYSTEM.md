# PocketKirana Design System & UI/UX Standards

All UI, component, and page development in PocketKirana MUST adhere to the design specifications defined in [`DESIGN.md`](file:///d:/pocketkirana/DESIGN.md) (VoltAgent `awesome-design-md` standard).

## Core Directives
1. **Palette & Theming:**
   - Primary: `#0F532B` (PocketKirana Emerald), Container: `#22C55E`, Surface: `#F8FAFC` (Light) / `#0B0F14` (Dark).
   - Accents: `#FF7A00` for flash deals, `#16A34A` for veg badge, `#DC2626` for non-veg.
2. **Typography:**
   - Inter / Outfit sans-serif hierarchy.
   - Dual-pricing display: Struck-through MRP + Bold Selling Price + Savings Chip (`% OFF`).
3. **Touch Ergonomics & Mobile Layout:**
   - Minimum tap target $44\times 44\text{px}$.
   - Ensure sticky bottom bars (cart, checkout, navigation) provide `pb-20` or `pb-24` padding so bottom content is never obscured.
4. **Resilience & State Handling:**
   - Every product list or feed must provide: Loading Shimmer, Empty State with Illustration, and Error Recovery Button.
   - Never inject mock/demo products when production queries return 0 items.

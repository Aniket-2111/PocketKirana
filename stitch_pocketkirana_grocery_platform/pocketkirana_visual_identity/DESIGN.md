---
name: PocketKirana Visual Identity
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3d4a3d'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7b6c'
  outline-variant: '#bccbb9'
  surface-tint: '#006e2f'
  primary: '#006e2f'
  on-primary: '#ffffff'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#4ae176'
  secondary: '#416900'
  on-secondary: '#ffffff'
  secondary-container: '#acf847'
  on-secondary-container: '#457000'
  tertiary: '#855300'
  on-tertiary: '#ffffff'
  tertiary-container: '#ef9900'
  on-tertiary-container: '#5c3800'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#acf847'
  secondary-fixed-dim: '#91db2a'
  on-secondary-fixed: '#102000'
  on-secondary-fixed-variant: '#304f00'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  price-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  price-sm-mrp:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  container-max: 1280px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system for this platform is built on the pillars of **Freshness, Speed, and Trust**. It utilizes a **Modern Corporate** aesthetic with **Minimalist** leanings to ensure that the interface feels as fresh as the produce it delivers.

The UI targets urban Indian consumers who value efficiency and reliability. To evoke an emotional response of security and ease, the design system employs high-quality whitespace, a vibrant natural color palette, and a "soft-tactile" feel. By combining clean layouts with oversized rounded corners, the system achieves a friendly yet premium retail experience that differentiates it from utilitarian competitors.

## Colors
The palette is rooted in the "Fresh Leaf Green" primary color, symbolizing vitality and health. 

- **Primary & Secondary:** Used for brand moments, main actions, and price highlights.
- **Accent (Orange/Yellow):** Reserved exclusively for "Offers," "Flash Sales," and "Urgency" indicators (e.g., "Limited Stock").
- **Neutral/Text:** Dark Charcoal ensures high legibility and a premium feel against the Very Light Neutral background.
- **Surface:** All interactive containers and cards use pure White to pop against the background, creating clear structural separation without heavy borders.

## Typography
This design system uses **Inter** for its systematic, utilitarian, yet modern feel. The hierarchy is strictly enforced to guide the user through complex product grids.

- **Headlines:** Use Bold (700) weights with slight negative letter spacing for a punchy, editorial look.
- **Product Titles:** Use SemiBold (600) for "headline-md" to ensure they stand out in the grid.
- **Price Points:** Use a specific "Price" token. The Current Price should always be 25% larger than the MRP.
- **Mobile Scaling:** Display-lg should scale down to 24px (headline-lg) on mobile devices to prevent excessive wrapping.

## Layout & Spacing
The layout follows a **Fluid Grid** system based on an 8px rhythm. 

- **Desktop:** 12-column grid with a 1280px max-width.
- **Mobile:** Single or double-column product feed with 16px side margins.
- **Spacing Philosophy:** Use "lg" (24px) for section vertical spacing and "md" (16px) for internal card padding. This generous use of space reinforces the "premium" brand positioning.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Ambient Shadows**.

- **Level 0 (Background):** #F9FAFB.
- **Level 1 (Cards/Surface):** White (#FFFFFF) with a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.05)).
- **Level 2 (Floating/Active):** Used for the Bottom Navigation and Active Search bars. These use a more pronounced shadow (0px 10px 30px rgba(0, 0, 0, 0.08)).
- **Outlines:** Use soft-gray (#E5E7EB) for inactive states or secondary containers (like address cards) to maintain a flat, modern appearance without over-relying on shadows.

## Shapes
The shape language is overtly **Rounded**, conveying friendliness and approachability. 

- **Cards:** Use `2xl` (24px) for product cards and promo banners.
- **Buttons:** Use `xl` (16px) to create a distinct, touch-friendly appearance.
- **Inputs:** Use `lg` (12px) for a slightly more structured but still soft feel.
- **Icons:** Should always be placed in circular or highly rounded containers.

## Components

### Buttons
- **Primary:** Solid #22C55E with White text. XL roundedness.
- **Secondary:** Subtle #DCFCE7 (Light Green) background with #166534 text.
- **Outline:** 1px #E5E7EB border with #1F2937 text. Use for secondary actions like "View Details."

### Product Card
- **Structure:** Image (Top), Name (Headline-md), Size/Weight (Body-md Gray), Price Row (Price-lg + Price-sm-mrp), and Add Button.
- **State:** On hover, the shadow deepens. If the item is in the cart, the "Add" button transforms into a Quantity Controller (+/-) with a Primary Green background.

### Search Bar
- **Styling:** Full-width on mobile. Height: 56px. Background: White. Border: 1px #E5E7EB. 
- **Icons:** Search icon (left) in Gray-400; Microphone icon (right) in Primary Green.

### Bottom Navigation (Mobile)
- **Style:** Fixed to bottom, white background, blurred backdrop filter. 
- **Icons:** Use 24px stroke icons. Active state uses Primary Green with a small 4px dot indicator underneath.

### Promo Banners
- **Styling:** Aspect ratio 2:1. Uses 24px corner radius. Backgrounds should use Secondary or Accent gradients.

### Skeleton Loaders
- **Animation:** Shimmer effect from left to right.
- **Color:** #F3F4F6 to #E5E7EB. Match the roundedness of the components they represent (e.g., 24px for product skeleton).
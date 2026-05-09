# DESIGN.md

> Design system: ProShop — Tech-Minimal Dark
> Format: stack-agnostic CSS custom properties (current: react-bootstrap 1.3; future: shadcn/ui + Tailwind 4)
> Last updated: 2026-05-09

---

## How to use this document

This is the single source of truth for visual decisions in ProShop. Tokens
live as CSS custom properties on `:root` (light) and `.dark` (dark, default),
so they apply to the current Bootstrap stack via overrides today and survive
a migration to Tailwind/shadcn later.

**Never hardcode hex / px values in components.** Always reference a token
(`var(--primary)`, `var(--space-md)`, `var(--radius-lg)`).

---

## 1. Color Palette

Semantic roles only — components reference role names, not raw hex.

### Dark mode (default)

| Role             | Hex        | Usage                                 |
|------------------|------------|---------------------------------------|
| `--background`   | `#242424`  | page surface (Level 0)                |
| `--foreground`   | `#F2F2F2`  | primary text                          |
| `--card`         | `#2E2E2E`  | card surface (Level 1)                |
| `--card-alt`     | `#383838`  | modals, dropdowns, popovers (Level 2) |
| `--primary`      | `#C6FF3D`  | CTA, prices, active links             |
| `--primary-fg`   | `#0A0A0A`  | text on primary background            |
| `--muted`        | `#999999`  | secondary text, hints (small text only) |
| `--accent`       | `#C6FF3D`  | == primary in this system             |
| `--destructive`  | `#FF6B6B`  | errors, destructive actions           |
| `--border`       | `#3A3A3A`  | dividers, subtle outlines             |
| `--ring`         | `#C6FF3D`  | focus ring                            |

### Light mode (alt)

| Role             | Hex        |
|------------------|------------|
| `--background`   | `#FAFAFA`  |
| `--foreground`   | `#1A1A1A`  |
| `--card`         | `#FFFFFF`  |
| `--card-alt`     | `#F0F0F0`  |
| `--primary`      | `#4A7000`  |
| `--primary-fg`   | `#FFFFFF`  |
| `--muted`        | `#666666`  |
| `--accent`       | `#4A7000`  |
| `--destructive`  | `#D63838`  |
| `--border`       | `#E0E0E0`  |
| `--ring`         | `#4A7000`  |

**Why `--primary` differs across modes:** `#C6FF3D` on `#FFFFFF` measures 1.4:1 — fails WCAG AA. The light-mode primary is the same hue darkened to a 4.5:1+ ratio (`#4A7000` on white = 5.7:1, white on `#4A7000` = 5.7:1).

**Contrast self-check:**
- `#F2F2F2` on `#242424` = **15.3:1** (AAA)
- `#C6FF3D` on `#242424` = **13.4:1** (AAA)
- `#999999` on `#242424` = **4.6:1** (AA — small text only, never body)
- `#0A0A0A` on `#C6FF3D` = **14:1** (AAA)

**Dark mode strategy:** CSS variables only. `.dark` class on `<html>` swaps `:root` values. Initial value derived from `prefers-color-scheme` and persisted via `localStorage` toggle in header. **Never use `dark:bg-gray-900` hardcodes.**

---

## 2. Typography

**Display + body:** Manrope (weights 400 / 500 / 600 / 700 / 800)
**Mono:** DM Mono (weights 400 / 500)
**Fallback:** `system-ui, -apple-system, sans-serif` / `'SF Mono', Consolas, monospace`

Import:
```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
```

### Scale

| Step    | Size  | Line-height | Letter-spacing | Weight  | Usage                                  |
|---------|-------|-------------|----------------|---------|----------------------------------------|
| Display | 56px  | 1.0         | -0.04em        | 800     | Hero headline                          |
| H1      | 40px  | 1.1         | -0.03em        | 700     | Page title                             |
| H2      | 28px  | 1.2         | -0.02em        | 700     | Section header                         |
| H3      | 20px  | 1.3         | -0.015em       | 600     | Card header, subhead                   |
| H4      | 16px  | 1.4         | -0.005em       | 600     | Mini-subhead                           |
| Body    | 15px  | 1.6         | 0              | 400     | Main content (compact, "no fluff")     |
| Small   | 13px  | 1.5         | 0              | 400     | Secondary text                         |
| Caption | 11px  | 1.4         | 0.08em         | 600     | UPPERCASE labels, category, nav        |
| Mono    | 13px  | 1.5         | 0              | 500     | Prices, SKUs, IDs, JSON, code          |

**Mono is mandatory for all numeric data:** prices, counts, SKUs, order IDs, dates. Apply `font-feature-settings: "tnum" 1` on cells with numeric mono content so figures share a fixed advance width and columns do not jitter on re-render.

---

## 3. Spacing Scale

Strict multiples of 8px (4px reserved for micro). No arbitrary values.

```
4px   — micro    (icon ↔ label gap)
8px   — xs       (tight padding, badge inner)
16px  — sm       (component inner padding, form-field gap)
24px  — md       (card padding, section gap inside a section)
32px  — lg       (section padding)
48px  — xl       (between major sections, desktop)
64px  — 2xl      (hero, page-level breathing)
96px  — 3xl      (between landing-page sections — rare)
```

If a component "needs" 14px / 18px / 22px — the component is broken, not the scale.

---

## 4. Border Radius Scale

Compact / sharp — angles read as engineered.

```
none   0px      — tables, data grids, code blocks
sm     4px     — badges, chips, tags, small inputs
md     8px     — buttons, inputs (default), select
lg     12px    — cards (default), panels, dropdown menus
xl     16px    — modals, large bottom sheets
full   9999px  — pills, avatars, toggle switches, IconButton
```

Forbidden: rounding above 16px on non-pill elements (luxury vibe, conflicts with "no fluff").

---

## 5. Elevation / Shadow Approach

**Philosophy: NO box-shadows on standard elements. Depth from background contrast.**

3-level system:

- **Level 0 (page):** `var(--background)` = `#242424`
- **Level 1 (card):** `var(--card)` = `#2E2E2E` — lift via background color, not shadow
- **Level 2 (modal/popover/dropdown):** `var(--card-alt)` = `#383838` — floating elements

**Functional exceptions** (overlay separation only, never decoration):

```css
--shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.4);  /* dropdown, tooltip */
--shadow-modal:   0 8px 32px rgba(0, 0, 0, 0.5);  /* modal only */
```

Buttons, cards, inputs, badges — **no shadows at all**.

Light mode follows the same principle: `#FAFAFA` → `#FFFFFF` → `#F0F0F0` (lift via lighter layers, never via dirty shadows).

---

## 6. Component Patterns

### Cards

```
Background:    var(--card)
Padding:       24px (md)
Border radius: 12px (lg)
Border:        1px solid var(--border)
Hover:         border-color → var(--primary), bg → var(--card-alt)
Transition:    150ms ease (border-color, background-color)
```

### Buttons

**Primary**
```
Background:    var(--primary)
Color:         var(--primary-fg)
Radius:        8px (md)
Padding:       10px 20px
Font:          Manrope 600, 13px, letter-spacing 0.04em, UPPERCASE
Hover:         filter brightness(1.08)
Active:        scale(0.98)
Transition:    150ms ease
```

**Secondary**
```
Background:    transparent
Border:        1px solid var(--border)
Color:         var(--foreground)
Hover:         bg var(--card-alt), border-color var(--foreground)
Other:         same as primary
```

**Danger**
```
Background:    var(--destructive)
Color:         #FFFFFF
Other:         same as primary
```

**Ghost**
```
Background:    transparent
Border:        none
Color:         var(--muted)
Hover:         color var(--foreground), bg var(--card-alt)
```

**Icon**
```
Size:          40×40px
Radius:        9999px (full)
Background:    transparent
Hover:         bg var(--card-alt)
```

**Disabled (any variant)**
```
Opacity:       0.4
Cursor:        not-allowed
No hover effect
```

### Inputs

```
Background:    var(--background)
Border:        1px solid var(--border)
Radius:        8px (md)
Padding:       10px 14px
Font:          Manrope 400, 14px
Placeholder:   var(--muted)
Focus:         border-color var(--ring),
               box-shadow 0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent)
Error:         border-color var(--destructive)
               + helper text 13px var(--destructive) below
```

### Badges / Chips

```
Padding:       2px 8px
Radius:        9999px (full)
Font:          DM Mono 500, 11px, UPPERCASE, letter-spacing 0.06em
```

Variants:
- **Default**: bg `color-mix(in srgb, var(--foreground) 10%, transparent)`, color `var(--foreground)`
- **Primary**: bg `color-mix(in srgb, var(--primary) 15%, transparent)`, color `var(--primary)`
- **Danger**:  bg `color-mix(in srgb, var(--destructive) 15%, transparent)`, color `var(--destructive)`

### Tables (admin screens — UserList, OrderList, ProductList)

```
Header:        bg var(--card), border-bottom 1px var(--border)
               font: Manrope 600, 11px UPPERCASE, letter-spacing 0.08em, color var(--muted)
Row:           border-bottom 1px var(--border), padding 12px 16px
Hover:         bg var(--card-alt)
Numeric cols:  font-family DM Mono, text-align right
```

### Modals / Drawers

```
Overlay:       bg rgba(0, 0, 0, 0.6), backdrop-filter blur(2px)
Surface:       bg var(--card-alt), radius 16px (xl), padding 32px
Shadow:        var(--shadow-modal)
Close:         IconButton, top-right
Focus trap:    required; first focusable element receives focus on open;
               focus restored to trigger on close
```

---

## 7. Interactive States

**Every interactive element MUST define ALL of these states.**

| Element            | Default      | Hover                           | Focus                       | Active        | Loading              | Disabled / Empty           |
|--------------------|--------------|---------------------------------|-----------------------------|---------------|----------------------|----------------------------|
| Button (primary)   | normal       | `brightness(1.08)`              | ring 2px var(--ring), offset 2px | scale(0.98)   | inline spinner, opacity 0.7 | opacity 0.4, no-pointer    |
| Button (secondary) | normal       | bg var(--card-alt)              | ring 2px                    | scale(0.98)   | inline spinner       | opacity 0.4                |
| Input              | normal       | border brighter                 | ring 2px + border var(--ring) | —             | spinner inside (right) | bg muted, read-only cursor |
| Card (clickable)   | normal       | border var(--primary), bg var(--card-alt) | outline ring 2px            | —             | skeleton shimmer     | empty state component      |
| Link               | normal       | underline                       | outline ring                | color var(--primary) | —                    | —                          |
| Tab                | muted color  | color foreground                | ring                        | underline 2px var(--primary) | —                    | opacity 0.4                |
| Checkbox / Radio   | empty        | border var(--foreground)        | ring 2px                    | checked: bg var(--primary) | —                    | opacity 0.4                |

### Empty states

Mandatory for every list / table / feed:
- Icon (48px, opacity 0.5)
- Heading 17px ("No products yet" / "Cart is empty")
- Subtitle 13px `var(--muted)` ("Try adjusting filters" / "Browse the catalogue")
- Optional primary CTA button

### Loading states

Skeleton shimmer for surface loading. Spinner only for action-triggered loading (e.g., the button you just clicked).

```css
@keyframes skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--card) 0%, var(--card-alt) 50%, var(--card) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite linear;
}
```

---

## 8. Animation / Transitions

**Philosophy: purposeful, not decorative.**

```
Base transition:   150ms ease       (hover, color, background)
Slow transition:   200ms ease-out   (modal in, drawer in)
Hover effects:     brightness(1.08) | bg shift | underline — never scale on large elements
Fade in:           opacity 0 → 1, 200ms ease-out (modal, toast)
Slide up:          translateY(8px) → 0, 200ms ease-out (toast, drawer)
Skeleton shimmer:  1.5s infinite linear
Sequence stagger:  50ms between list items (first mount only, never re-render)
```

**Forbidden:** random animations, parallax, transition > 300ms, "look-at-me" pulses, bouncy easing.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Accessibility

**Contrast (WCAG AA minimum):**
- Body text on background: ≥ 4.5:1
- Large text (18px+ / 14px+ bold): ≥ 3:1
- UI components, graphical objects: ≥ 3:1
- Verified targets in Section 1.
- `--muted` is at the AA boundary — use only for small text (13px+), never for body.

**Keyboard:**
- All interactive elements reachable via Tab
- Focus ring: `2px solid var(--ring)`, offset 2px, never `outline: none` without replacement
- Skip-to-content link as first element in `<body>`:
  ```html
  <a href="#main" class="sr-only-focusable">Skip to content</a>
  ```

**ARIA:**
- Meaningful icons: `aria-label` or `aria-labelledby`
- Decorative icons: `aria-hidden="true"`
- Form inputs: `<label>` or `aria-label`
- Dynamic regions (toasts, cart counter): `aria-live="polite"`
- Modals: `role="dialog"`, `aria-modal="true"`, focus trap, focus restored on close
- Prices: wrap with `aria-label` so screen readers don't read `$` separately, e.g., `<span aria-label="2,499 dollars">$2,499.00</span>`

**Touch targets:** minimum 44×44px on mobile (including IconButton).

**Reduced motion:** see Section 8.

---

## 10. Format Declaration

```
Component library: react-bootstrap 1.3 (current) → shadcn/ui (after migration)
CSS framework:     vanilla CSS + CSS custom properties (stack-agnostic)
Token system:      CSS custom properties on :root (light) and .dark (dark, default)
Icon set:          react-icons (FontAwesome subset, current)
                   → Lucide Icons (after migration)
```

CSS variables setup in `frontend/src/index.css`:

```css
:root {
  /* light mode (default if user picks light or OS prefers light) */
  --background:   #FAFAFA;
  --foreground:   #1A1A1A;
  --card:         #FFFFFF;
  --card-alt:     #F0F0F0;
  --primary:      #4A7000;
  --primary-fg:   #FFFFFF;
  --muted:        #666666;
  --accent:       #4A7000;
  --destructive:  #D63838;
  --border:       #E0E0E0;
  --ring:         #4A7000;

  --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-modal:   0 8px 32px rgba(0, 0, 0, 0.18);

  --space-micro: 4px;
  --space-xs:    8px;
  --space-sm:   16px;
  --space-md:   24px;
  --space-lg:   32px;
  --space-xl:   48px;
  --space-2xl:  64px;
  --space-3xl:  96px;

  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-full: 9999px;
}

.dark {
  --background:   #242424;
  --foreground:   #F2F2F2;
  --card:         #2E2E2E;
  --card-alt:     #383838;
  --primary:      #C6FF3D;
  --primary-fg:   #0A0A0A;
  --muted:        #999999;
  --accent:       #C6FF3D;
  --destructive:  #FF6B6B;
  --border:       #3A3A3A;
  --ring:         #C6FF3D;

  --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-modal:   0 8px 32px rgba(0, 0, 0, 0.5);
}

/* OS preference applies when user has not chosen explicitly */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background:   #242424;
    --foreground:   #F2F2F2;
    --card:         #2E2E2E;
    --card-alt:     #383838;
    --primary:      #C6FF3D;
    --primary-fg:   #0A0A0A;
    --muted:        #999999;
    --accent:       #C6FF3D;
    --destructive:  #FF6B6B;
    --border:       #3A3A3A;
    --ring:         #C6FF3D;
  }
}
```

For the current Bootstrap stack, override Bootstrap 4 SCSS variables in a single file (`frontend/src/bootstrap-overrides.scss`) so `$body-bg`, `$primary`, `$card-bg`, `$border-color` etc. read from these CSS custom properties. After migration, the same tokens map directly to Tailwind 4 / shadcn theme.

---

## 11. Anti-AI-slop Guards (mandatory)

These rules close gaps that token-level decisions alone do not cover. Every guard below is enforceable in code review.

### Layout & composition
- **NO 2-column comparison blocks.** Forbidden patterns: "Without us / With us", "Before / After", "Old way / New way" side-by-side. Use single-column storytelling, a 3-card grid, or a table — never two columns.
- **ASCII wireframe first.** Before generating any UI code: produce an ASCII wireframe (HERO / sections / cards / footer). Generated code matches the wireframe exactly. Do not invent additional sections.
- **Generous spacing between sections.** Minimum 48px desktop / 32px mobile between major sections. Section internal padding minimum 24px. Never 12-16px between sections.

### Visual style
- **NO gradients** on backgrounds, buttons, or hero blocks. Solid colors only, drawn from the tokens in Section 1. Single exception: skeleton shimmer animation.
- **NO heavy borders.** 1px maximum, color `var(--border)` or `color-mix` with transparency. Forbidden: `border: 2px+`, double borders, hard black outlines.
- **shadcn/ui MUST be customized** (when migrated). Never ship default slate / zinc / gray. Theme is generated from the tokens here (TweakCN.com or hand-mapped) and pasted into `globals.css`.

### UX-first
- **User journey before visual style.** Before generating any page, answer: (1) Who is on this page? (2) What are they trying to do? (3) Where is the primary CTA? (4) What is the next logical step? Visual decisions follow user journey, not the reverse.
- **Primary CTA above the fold.** Hero takes max 60vh. On 1366×768 the primary CTA must be visible without scroll.
- **Contrast ≥ 4.5:1 for body text always.** No light-gray on white "for screenshot aesthetic". UX outranks screenshot beauty.

### Magic phrase

> "Be a human designer so it doesn't look like AI. With design taste."

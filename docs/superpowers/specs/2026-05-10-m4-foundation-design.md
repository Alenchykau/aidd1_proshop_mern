# M4 Phase 0 — Foundation (theme toggle + shared atoms + Bootstrap overrides)

> Status: design
> Owner: frontend
> Created: 2026-05-10
> Branch: `m4-redesign`
> Predecessors: `2026-05-09-feature-dashboard-redesign-design.md`
> Successors: Phase 1 (public), Phase 2 (auth), Phase 3 (admin) — separate specs

---

## 1. Goal

Lay the rails for the rest of M4. After Phase 0, redesigning any of the
remaining 15 screens should be a routine application of shared atoms +
group wireframe templates — no further infrastructure work needed.

Concretely, Phase 0 ships:

1. A new **M4 section in `report.md`** with the sitemap progress table.
2. A functional **light/dark theme toggle** in the Header that survives reloads,
   cooperates with OS preference on first visit, and applies to every page on
   the site (including legacy screens).
3. A CSS foundation that conforms to `DESIGN.md` §10 (`:root` = light,
   `.dark` = dark, `prefers-color-scheme` only when user has not chosen) and
   has no flash-of-wrong-theme.
4. **`bootstrap-overrides.scss`** — Bootstrap 4 theme variables read from our
   CSS custom properties so legacy screens visually follow the active theme.
5. A redesigned **Header** — token-driven, with the theme toggle wired in,
   no more hard-coded `bg='dark' variant='dark'`.
6. A small set of **shared UI atoms** under `frontend/src/components/ui/`
   that Phase 1–3 will compose into screens: `Card`, `FormCard`, `FormField`,
   `Button`, `Badge`, `DataTable`, `Pagination`, `ThemeToggle`. `EmptyState`
   already exists.
7. **8 group wireframes** (in this spec) that serve as contracts for Phase
   1–3 redesigns: HomeProductGrid, ProductDetails, Cart, AuthFormCard,
   CheckoutStep, OrderSummary, AdminListTable, AdminEditForm.

Out of scope: redesigning any of the 15 remaining screens. Their per-screen
CSS stays untouched in Phase 0. The bootstrap overrides will reskin them
implicitly so the site does not look like "two worlds".

---

## 2. Decisions (recap of the brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Theme scope | Global + Bootstrap overrides | Avoid "two worlds" between redesigned and legacy screens during the transition. |
| Strategy | Hybrid — atoms first, then per-screen | Admin uses the same Table 5x; auth uses FormCard 4x. Extracting first is cheaper than refactoring later. |
| Default theme | Follow OS, fallback dark | Conforms to DESIGN.md §1 ("dark mode default") while respecting OS preference if user has one. |
| Wireframes | 8 group templates | One template per screen archetype covers all 16 screens; per-screen wireframes would mostly repeat. |
| Toggle states | 2-state (light ↔ dark) | Simpler UX than tri-state cycle; first-visit OS preference still applied before user picks. |
| Phase split | 4 phases (Foundation → Public → Auth → Admin) | Single mega-spec is too large; this spec is Phase 0 only. |

---

## 3. Architecture

### 3.1 File layout (new files)

```
frontend/src/
  context/
    ThemeContext.js              # Provider + useTheme hook
  components/
    ui/
      Button.js / Button.css
      Card.js   / Card.css
      Badge.js  / Badge.css
      DataTable.js / DataTable.css
      FormCard.js  / FormCard.css
      FormField.js / FormField.css
      Pagination.js / Pagination.css
      ThemeToggle.js / ThemeToggle.css
      index.js                   # barrel re-exports
    EmptyState.js                # already exists
  bootstrap-overrides.scss       # NEW
  index.css                      # MODIFIED — see §3.3
  index.js                       # MODIFIED — wrap App in <ThemeProvider>
  components/Header.js           # MODIFIED — drop bg='dark', add ThemeToggle
  components/Header.css          # NEW (small)
frontend/public/index.html       # MODIFIED — inline anti-FOUC script in <head>
report.md                        # MODIFIED — new "## M4 — Redesign" section
```

### 3.2 ThemeContext

```js
// frontend/src/context/ThemeContext.js
const STORAGE_KEY = 'proshop-theme'    // 'light' | 'dark'
// Absence of the key means "follow OS".

export function ThemeProvider({ children }) {
  // 1. Initial state read by anti-FOUC script already; mirror it here.
  // 2. resolvedTheme is derived from explicit choice OR matchMedia.
  // 3. On change, set documentElement.dataset.theme + classList.toggle('dark').
  // 4. Subscribe to matchMedia ONLY when user has no explicit choice.
}

export function useTheme() {
  return useContext(ThemeContext)
  // -> { theme: 'light' | 'dark' | 'system',
  //      resolvedTheme: 'light' | 'dark',
  //      toggleTheme(): void,           // flips between light and dark explicitly
  //      setTheme(value): void }        // accepts 'light' | 'dark' | 'system'
}
```

`toggleTheme` is the only method the 2-state UI needs. `setTheme('system')`
is exposed for completeness (a future preferences screen could use it) but
is not surfaced in the Header.

### 3.3 CSS contract (`index.css`)

```css
/* Light = :root default (no class needed) */
:root { --background: #FAFAFA; ...; --ring: #4A7000; }

/* Dark explicitly via class */
.dark { --background: #242424; ...; --ring: #C6FF3D; }

/* OS preference applies ONLY when user has not chosen.
   We mark explicit choice via data-theme attribute on <html>. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --background: #242424; ...; --ring: #C6FF3D;
  }
}
```

Order of class/attribute application by the anti-FOUC script and ThemeProvider:

| State (localStorage) | `<html>` attributes/classes | Effective tokens |
|---|---|---|
| absent (system, OS=dark) | `<html>` (no attr/class) | dark via media query |
| absent (system, OS=light) | `<html>` (no attr/class) | light from :root |
| `'light'` | `<html data-theme="light">` | light from :root, media query suppressed |
| `'dark'` | `<html data-theme="dark" class="dark">` | dark from `.dark`, media query irrelevant |

### 3.4 Anti-FOUC script

Plain inline script in `frontend/public/index.html`, inside `<head>` BEFORE
the React bundle, no dependencies:

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('proshop-theme');
      var html = document.documentElement;
      if (saved === 'dark') {
        html.setAttribute('data-theme', 'dark');
        html.classList.add('dark');
      } else if (saved === 'light') {
        html.setAttribute('data-theme', 'light');
      }
      // No saved value → leave attribute off; CSS media query handles OS pref.
    } catch (e) { /* localStorage blocked → fall back to OS pref */ }
  })();
</script>
```

The script must run synchronously before paint. Background flash on reload
is the canonical proof of FOUC; verifying it stays gone is part of the QA
checklist (§7).

### 3.5 Bootstrap overrides

`frontend/src/bootstrap-overrides.scss`:

```scss
$body-bg:            var(--background);
$body-color:         var(--foreground);
$primary:            var(--primary);
$danger:             var(--destructive);
$info:               var(--info);
$border-color:       var(--border);
$card-bg:            var(--card);
$card-border-color:  var(--border);
$input-bg:           var(--background);
$input-color:        var(--foreground);
$input-border-color: var(--border);
$input-placeholder-color: var(--muted);
$navbar-dark-bg:     var(--card);
$navbar-dark-color:  var(--foreground);
$navbar-dark-hover-color: var(--primary);
$dropdown-bg:        var(--card-alt);
$dropdown-link-color:var(--foreground);
$dropdown-link-hover-bg: var(--card);
$table-color:        var(--foreground);
$table-border-color: var(--border);
$table-hover-bg:     var(--card-alt);
$pagination-bg:      var(--card);
$pagination-color:   var(--foreground);
$pagination-active-bg: var(--primary);
$pagination-active-color: var(--primary-fg);

@import '~bootstrap/scss/bootstrap';
```

**Critical gotcha:** Bootstrap 4 uses `lighten()`, `darken()`, `mix()` on
some of these variables (e.g. `$btn-primary-bg-hover` is derived from
`$primary`). SCSS color functions cannot operate on CSS `var(--…)` strings
— Sass will fail to compile or produce broken output for those derivations.
Mitigation:
- For derived variables Bootstrap uses internally, override the **derived**
  variable too with our own `var(--…)` (e.g. `$btn-primary-hover-bg:
  color-mix(in srgb, var(--primary) 92%, black)`).
- Where unavoidable, accept that the derived state is slightly off-palette
  on legacy screens until the screen is redesigned (cost is cosmetic, not
  functional).
- Maintain the override list as a single file; do not split.

CRA 3.4.3 supports Sass via webpack but does **not** ship the compiler.
Phase 0 adds `node-sass@4.14.1` as a frontend devDependency (`npm i -D
node-sass@^4.14.1 --prefix frontend` — `node-sass@4.x` is the version
compatible with the Webpack 4 / Node ≥ 14 the project pins). The new
`.scss` import works out of the box once installed. The import order in
`frontend/src/index.js` is:

```js
import './bootstrap-overrides.scss';   // sets vars + imports bootstrap
import './index.css';                   // tokens layer on top
```

Bootswatch (if it loads via CDN in `public/index.html`) **must** be removed
or its `<link>` must come BEFORE our overrides import. We will check this
at implementation time and remove if redundant. (See `DESIGN.md` §1 note
on Bootswatch shadowing — today our `:root` already shadowed Bootswatch's
`--primary`/`--info`, so dropping Bootswatch's `<link>` is safe.)

### 3.6 Header

Before:

```jsx
<Navbar bg='dark' variant='dark' expand='lg' collapseOnSelect>
```

After:

```jsx
<Navbar expand='lg' collapseOnSelect className='app-navbar'>
  ...
  <Nav className='ml-auto align-items-center'>
    <ThemeToggle />          {/* sits left of Cart, before user menu */}
    <LinkContainer to='/cart'> ... </LinkContainer>
    {/* unchanged: user dropdown, admin dropdown */}
  </Nav>
```

`Header.css`:

```css
.app-navbar {
  background: var(--card);
  border-bottom: 1px solid var(--border);
}
.app-navbar .navbar-brand,
.app-navbar .nav-link {
  color: var(--foreground);
}
.app-navbar .nav-link:hover { color: var(--primary); }
```

This explicitly drops Bootstrap's "dark navbar" semantics so the navbar
follows the active theme like every other surface.

### 3.7 ThemeToggle

```jsx
function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type='button'
      className='theme-toggle'
      aria-label={`Switch to ${next} theme`}
      onClick={toggleTheme}
    >
      {resolvedTheme === 'dark' ? <FaSun /> : <FaMoon />}
    </button>
  )
}
```

Sized 40×40, `border-radius: var(--radius-full)`, transparent background,
hover `var(--card-alt)`, focus ring per `DESIGN.md` §7.

---

## 4. Shared atoms

All under `frontend/src/components/ui/`. Each file: functional component +
sibling `.css` reading tokens. No TypeScript (project is JS). No tests in
Phase 0 — atoms are token-thin and the project has almost no test
infrastructure outside `FeatureListScreen.test.js`. Smoke tests are a
deliberate Phase 1+ deliverable when consumers exist.

### 4.1 Card

```jsx
<Card className='...'>{children}</Card>
```

CSS: `bg var(--card)`, `padding var(--space-md)`, `border-radius var(--radius-lg)`,
`border 1px solid var(--border)`, hover (when given `is-clickable` prop) →
`border-color var(--primary); background var(--card-alt)`.

### 4.2 FormCard

`<Card>` wrapper centered with `max-width: 480px; margin: var(--space-2xl) auto;`
— used as the page-level container for Login, Register, Shipping, Payment.

### 4.3 FormField

```jsx
<FormField
  id='email'
  label='Email Address'
  type='email'
  required
  value={...}
  onChange={...}
  error={errors.email}
  helperText='We never share your email'
/>
```

Renders `<label htmlFor>`, `<input>` with `aria-invalid`, `aria-describedby`
pointing at the error/helper element. Error state uses
`var(--destructive)`. Conforms to `DESIGN.md` §6 inputs.

### 4.4 Button

`variant`: `primary` (default) | `secondary` | `danger` | `ghost` | `icon`.
`size`: `md` (default) | `sm`. `loading` prop renders an inline spinner +
sets `aria-busy="true"` + `disabled`.

Independent from `react-bootstrap` `<Button>`. The latter remains usable in
legacy screens via Bootstrap overrides.

### 4.5 Badge

`variant`: `default` | `primary` | `danger` | `info`. Mono font, UPPERCASE,
`var(--radius-full)`. Used for order status, isAdmin flag, stock label.

### 4.6 DataTable

Wrapper around `<table>`:

```jsx
<DataTable
  columns={[
    { key: 'id',     header: 'ID',     mono: true,  align: 'left' },
    { key: 'name',   header: 'Name',                align: 'left' },
    { key: 'price',  header: 'Price',  mono: true,  align: 'right' },
    { key: 'actions',header: '',       align: 'right',
      render: row => <RowActions row={row} /> },
  ]}
  rows={data}
  emptyState={<EmptyState ... />}
  loading={loading}
/>
```

CSS per `DESIGN.md` §6 Tables. `loading` renders a skeleton-shimmer body
of N rows. Empty body renders the `emptyState` slot.

### 4.7 Pagination

Simple page-number row. `currentPage`, `totalPages`, `onPageChange`.
Active page uses `var(--primary)` background + `var(--primary-fg)` text.

### 4.8 ThemeToggle

See §3.7.

### 4.9 EmptyState (existing)

No changes in Phase 0. Stays as-is from the FeatureDashboard redesign.

### 4.10 Barrel

`frontend/src/components/ui/index.js` re-exports everything for ergonomic
imports: `import { Card, Button, FormField } from '../components/ui'`.

---

## 5. Wireframes (group templates)

These eight wireframes are the visual contract for Phase 1–3. Each later
phase implements the screens that map onto a template; the mapping is in
§5.0.

### 5.0 Wireframe-to-screen map

| Template | Screens | Phase |
|---|---|---|
| 5.1 HomeProductGrid | HomeScreen (Home / Search / Page) | 1 |
| 5.2 ProductDetails  | ProductScreen | 1 |
| 5.3 Cart            | CartScreen | 1 |
| 5.4 AuthFormCard    | LoginScreen, RegisterScreen | 2 |
| 5.5 CheckoutStep    | ShippingScreen, PaymentScreen, PlaceOrderScreen | 2 |
| 5.6 OrderSummary    | OrderScreen, ProfileScreen ("My Orders" section) | 2 |
| 5.7 AdminListTable  | UserListScreen, ProductListScreen, OrderListScreen, FeatureListScreen (reference, already shipped) | 3 |
| 5.8 AdminEditForm   | UserEditScreen, ProductEditScreen | 3 |

### 5.1 HomeProductGrid

```
+----------------------------------------------------------------------------+
| Header (Navbar + ThemeToggle + Cart + User/Admin)                          |
+----------------------------------------------------------------------------+
|                                                                            |
|  [SearchBox]                                       [Filters: Category ▾]   |
|                                                                            |
|  HERO CAROUSEL  (3 top-rated products, 56vh max)                           |
|                                                                            |
|  ----------------------------------------------------------------          |
|  LATEST PRODUCTS                                                           |
|                                                                            |
|  [Card][Card][Card][Card]   ← grid: 4 cols desktop, 2 tablet, 1 mobile     |
|  [Card][Card][Card][Card]                                                  |
|                                                                            |
|  [Pagination 1 2 3 ... ›]                                                  |
+----------------------------------------------------------------------------+
| Footer                                                                     |
+----------------------------------------------------------------------------+

NOTES
- Card: image (1:1, var(--radius-lg)), name (H4), rating (small + mono),
  price (mono primary). Whole card clickable → /product/:id.
- Carousel: existing react-bootstrap; restyle borders/captions to tokens.
- States: Loading = 8 skeleton cards. Empty = EmptyState "No products match".
  Error = inline Message component (existing).
- A11y: each card is a single <a> wrapping the <Card>. Carousel exposes
  prev/next buttons with aria-labels.
- Responsive: search row stacks under filters on mobile (<768px).
```

### 5.2 ProductDetails

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  ‹ Go Back                                                                 |
|                                                                            |
|  +--------------------+  +-------------------+  +-----------------------+  |
|  |                    |  |  Name (H1)        |  |  Price:    $999.00    |  |
|  |    Image (1:1)     |  |  ★★★★★ (n)        |  |  Status:   In Stock   |  |
|  |                    |  |  Price: $999.00   |  |  Qty:      [1 ▾]      |  |
|  |                    |  |  Description...   |  |                       |  |
|  +--------------------+  +-------------------+  |  [ Add to Cart ]      |  |
|                                                  +-----------------------+  |
|                                                                            |
|  ----------------------------------------------------------------          |
|  REVIEWS                                                                   |
|  [Review card] [Review card] [Review card]                                 |
|  [Write a review form — auth-only]                                         |
+----------------------------------------------------------------------------+

NOTES
- Three-column desktop, stacks on tablet (image + info, then sidebar full
  width), single column mobile.
- "Add to Cart" = primary Button, disabled if countInStock === 0.
- Status badge (Badge primary if In Stock, danger if Out).
- Reviews list: empty state "No reviews yet — be the first to review".
- Review form requires auth → unauthed shows a secondary Button "Sign in to
  review".
```

### 5.3 Cart

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  Shopping Cart (H1)                                                        |
|                                                                            |
|  +----------------------------------------+   +----------------------+    |
|  | [img] Name              $99.00 [Qty▾] [✕] |   | Subtotal (3)         |    |
|  | [img] Name              $42.00 [Qty▾] [✕] |   | Total: $390.00 (mono)|    |
|  | [img] Name              $20.00 [Qty▾] [✕] |   |                      |    |
|  +----------------------------------------+   |  [ Proceed to Checkout ] |    |
|                                                +----------------------+    |
+----------------------------------------------------------------------------+

NOTES
- Empty state: EmptyState "Your cart is empty" + CTA "Browse the catalogue"
  → /.
- Qty select uses tokens (var(--background), border var(--border)).
- Remove button = ghost icon (FaTrash), aria-label "Remove {name}".
- Sidebar Card sticky on desktop (top: var(--space-lg)), inline on mobile.
- Numeric values mono with tabular-nums.
```

### 5.4 AuthFormCard

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|                       +--------------------------+                         |
|                       |  Sign In  (H1)           |                         |
|                       |                          |                         |
|                       |  [FormField: Email]      |                         |
|                       |  [FormField: Password]   |                         |
|                       |                          |                         |
|                       |  [   Sign In   (primary)]|                         |
|                       |                          |                         |
|                       |  Need an account?        |                         |
|                       |  <Register>  ← Link      |                         |
|                       +--------------------------+                         |
|                                                                            |
+----------------------------------------------------------------------------+

NOTES
- FormCard wrapper, max-width 480px, centered.
- Loading: Button shows inline spinner, disabled.
- Error: Message above the form (existing component, restyle to var(--destructive)).
- Register screen: identical layout, with Name + Email + Password + Confirm.
- A11y: Submit on Enter; first field receives autofocus on mount.
```

### 5.5 CheckoutStep

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|   [Step 1: Sign In ✓]──[Step 2: Shipping ●]──[Step 3: Payment]──[Step 4: Place Order]
|                                                                            |
|                       +--------------------------+                         |
|                       |  Shipping  (H1)          |                         |
|                       |                          |                         |
|                       |  [FormField: Address]    |                         |
|                       |  [FormField: City]       |                         |
|                       |  [FormField: Postal]     |                         |
|                       |  [FormField: Country]    |                         |
|                       |                          |                         |
|                       |  [   Continue   ]        |                         |
|                       +--------------------------+                         |
+----------------------------------------------------------------------------+

NOTES
- CheckoutSteps stays as a separate component above the form. Restyle:
  active step = var(--primary), completed = check icon var(--primary),
  pending = var(--muted). Connectors = 1px var(--border) lines.
- PaymentScreen: same layout, radio-group of payment methods inside FormCard.
- PlaceOrderScreen: differs — it's a summary, NOT a form (use OrderSummary
  template §5.6 for the body, with a "Place Order" primary button at the
  bottom of the right-rail card).
```

### 5.6 OrderSummary

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  Order #12345  (H1)                                                        |
|                                                                            |
|  +------------------------------------------+  +------------------------+  |
|  | Shipping                                 |  | Order Summary          |  |
|  |   Name, Address, Country                 |  | Items:    $390.00      |  |
|  |   Status: [Badge: NOT DELIVERED]         |  | Shipping: $10.00       |  |
|  +------------------------------------------+  | Tax:      $58.50       |  |
|  | Payment                                  |  | Total:    $458.50      |  |
|  |   Method: PayPal                         |  | (mono, tabular-nums)   |  |
|  |   Status: [Badge: PAID 2026-05-08]       |  |                        |  |
|  +------------------------------------------+  | [PayPal Button]        |  |
|  | Items                                    |  | (or "Place Order" CTA) |  |
|  |   [img] Name × 2          $40.00         |  |                        |  |
|  |   [img] Name × 1         $999.00         |  | (admin only:)          |  |
|  +------------------------------------------+  | [ Mark Delivered ]     |  |
|                                                +------------------------+  |
+----------------------------------------------------------------------------+

NOTES
- Three Cards stacked left, one summary Card right (sticky desktop).
- Status Badges follow variants: PAID/DELIVERED = primary, NOT * = danger.
- ProfileScreen "My Orders" section reuses just the items table column from
  this template (DataTable variant — see §5.7).
- PayPal sandbox button retains existing react-paypal-button-v2 wrapping;
  we only restyle the surrounding Card.
```

### 5.7 AdminListTable

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  Users (H1)                                  [+ Create] (rare)             |
|                                                                            |
|  [Search input] (where applicable)                                         |
|                                                                            |
|  +------+----------+--------------------+--------+----------+              |
|  | ID   | NAME     | EMAIL              | ADMIN  | ACTIONS  |  ← header   |
|  +------+----------+--------------------+--------+----------+              |
|  | 5f.. | John Doe | john@example.com   | [✓]    | [ed][rm] |              |
|  | 5f.. | Jane     | jane@example.com   | [✗]    | [ed][rm] |              |
|  +------+----------+--------------------+--------+----------+              |
|                                                                            |
|  [Pagination 1 2 3 ›]                                                      |
+----------------------------------------------------------------------------+

NOTES
- DataTable component. Header UPPERCASE muted, mono ID, right-align numeric.
- Row hover var(--card-alt). Action buttons: ghost-icon (FaEdit, FaTrash),
  destructive variant for trash.
- States: Loading = 6 skeleton rows. Empty = EmptyState "No users yet".
  Error = inline Message.
- ProductListScreen adds an [+ Create Product] primary button in the header.
- OrderListScreen has more columns (USER, TOTAL, PAID, DELIVERED) — same
  template, more columns, two boolean columns rendered as Badge.
- FeatureListScreen is the reference implementation already shipped; it
  uses search + filter row that other admin lists do not need.
```

### 5.8 AdminEditForm

```
+----------------------------------------------------------------------------+
| Header                                                                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  ‹ Back to Users                                                           |
|                                                                            |
|                +-----------------------------------+                       |
|                |  Edit User  (H1)                  |                       |
|                |                                   |                       |
|                |  [FormField: Name]                |                       |
|                |  [FormField: Email]               |                       |
|                |  [Checkbox: Is Admin]             |                       |
|                |                                   |                       |
|                |  [ Update ]    [ Cancel (ghost) ] |                       |
|                +-----------------------------------+                       |
+----------------------------------------------------------------------------+

NOTES
- FormCard, max-width 560px (wider than auth — more fields in ProductEdit).
- ProductEditScreen variant: image upload field (existing multer endpoint),
  more fields (price, brand, category, count in stock, description).
- Save state: Button shows inline spinner during PUT.
- Validation errors render inline (FormField error prop). API errors → Message above form.
```

### 5.9 Five required states (per DESIGN.md / SKILL appendix)

For each of the eight templates above, Phase 1–3 implementations MUST
deliver:

1. **Default** — data present, normal interaction.
2. **Empty** — `EmptyState` component, friendly copy + CTA.
3. **Loading** — skeleton shimmer for surface-level loads, inline spinner
   for action-triggered loads (e.g. the just-clicked button).
4. **Error** — `Message` component (existing) restyled to tokens, with a
   recovery action (Retry / Reload / link).
5. **Success** — for actions, confirmation via existing Message component
   or optimistic update.

These states are not enumerated per-screen in this spec — they apply
uniformly. Phase plans will check each off per screen.

---

## 6. Report.md M4 section

Will be appended to `report.md` after the M3 section. Contents:

```markdown
## M4 — Redesign

Дизайн-система: ProShop Tech-Minimal Dark (см. `DESIGN.md`). Подход —
семантические CSS-токены на `:root` (light) и `.dark` (dark), функциональный
переключатель тем в Header, OS preference как fallback. Bootstrap 4
переведён на токены через `bootstrap-overrides.scss`, поэтому легаси-экраны
меняют тему вместе с редизайн-экранами.

Стратегия — гибрид: сначала общие atoms (`Card`, `Button`, `FormField`,
`FormCard`, `DataTable`, `Pagination`, `Badge`, `ThemeToggle`), потом
per-screen редизайн в порядке public → auth → admin. Восемь групповых
ASCII-wireframes в спеке Phase 0 покрывают все 16 экранов как шаблоны.

Phase split: Phase 0 — Foundation (этот PR). Phase 1 — Public.
Phase 2 — Auth/Checkout. Phase 3 — Admin.

| #  | Page                       | Route                              | File                       | Видимость | Сделал?           |
|----|----------------------------|------------------------------------|----------------------------|-----------|-------------------|
| 1  | Home / Search results      | /, /search/:keyword, /page/:n      | HomeScreen.js              | public    | [ ]               |
| 2  | Product details            | /product/:id                       | ProductScreen.js           | public    | [ ]               |
| 3  | Cart                       | /cart/:id?                         | CartScreen.js              | public    | [ ]               |
| 4  | Login                      | /login                             | LoginScreen.js             | public    | [ ]               |
| 5  | Register                   | /register                          | RegisterScreen.js          | public    | [ ]               |
| 6  | Profile                    | /profile                           | ProfileScreen.js           | auth      | [ ]               |
| 7  | Shipping                   | /shipping                          | ShippingScreen.js          | auth      | [ ]               |
| 8  | Payment                    | /payment                           | PaymentScreen.js           | auth      | [ ]               |
| 9  | Place Order                | /placeorder                        | PlaceOrderScreen.js        | auth      | [ ]               |
| 10 | Order details              | /order/:id                         | OrderScreen.js             | auth      | [ ]               |
| 11 | Admin: Users list          | /admin/userlist                    | UserListScreen.js          | admin     | [ ]               |
| 12 | Admin: User edit           | /admin/user/:id/edit               | UserEditScreen.js          | admin     | [ ]               |
| 13 | Admin: Products list       | /admin/productlist                 | ProductListScreen.js       | admin     | [ ]               |
| 14 | Admin: Product edit        | /admin/product/:id/edit            | ProductEditScreen.js       | admin     | [ ]               |
| 15 | Admin: Orders list         | /admin/orderlist                   | OrderListScreen.js         | admin     | [ ]               |
| 16 | Admin: Feature Dashboard   | /admin/featuredashboard            | FeatureDashboardScreen.js  | admin     | [x] обязательно   |

(Phase 0 — Foundation сама по себе галочки в таблице не ставит — это
инфраструктура. Phase 1/2/3 будут отмечать по мере сдачи.)
```

---

## 7. Acceptance criteria (Phase 0 done = all of these hold)

1. `report.md` contains the new "## M4 — Redesign" section with the table
   above; only #16 is checked.
2. Toggling the button in the Header switches the entire site (Header,
   FeatureListScreen, every legacy screen) between light and dark.
3. Reloading the page preserves the chosen theme; no FOUC visible on a
   hard refresh (manually verified on dev server).
4. With no localStorage entry, the OS preference (`prefers-color-scheme:
   dark`) determines the initial theme. With no preference, dark wins.
5. `frontend/src/components/ui/{Card, Button, FormField, FormCard, Badge,
   DataTable, Pagination, ThemeToggle}` exist, render in isolation
   (verified by importing each into a throwaway demo route or by storybook-
   style smoke import in `App.js`), and use only design tokens.
6. `bootstrap-overrides.scss` compiles; the dev server starts; no SCSS
   errors. The Bootstrap navbar and Bootstrap buttons on legacy screens
   read from tokens (visually verified on Cart and Login).
7. Header no longer has `bg='dark' variant='dark'`; the navbar background
   matches `var(--card)` in both themes.
8. The eight wireframes (§5.1–5.8) are present in this spec; the Phase
   1/2/3 mapping table (§5.0) lists every one of the 15 remaining screens.
9. No new screen is redesigned in Phase 0; the diff in `frontend/src/screens/`
   is limited to whatever is needed to keep them rendering after Bootstrap
   overrides land (ideally zero changes).
10. `npm run dev` starts cleanly; the existing `FeatureListScreen.test.js`
    still passes (`npm test --prefix frontend -- --watchAll=false`).
11. Keyboard: ThemeToggle is focusable via Tab, activatable via Enter/Space,
    has `aria-label` reflecting the next theme.
12. Contrast spot-checks: navbar text vs `var(--card)` ≥ 4.5:1 in both themes.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| SCSS color functions on `var(--…)` break Bootstrap derived variables. | Override the derived variable directly; document affected hover-states; accept cosmetic drift on legacy screens until they redesign. |
| Removing Bootswatch reveals previously-hidden Bootstrap defaults on legacy screens. | Visually QA Cart, Login, OrderList in both themes after override import; if a screen breaks visibly, patch it in Phase 0 with a minimal style-only fix (no logic changes). |
| Inline anti-FOUC script blocked by strict CSP. | Project ships no CSP today (CLAUDE.md confirms). When CSP arrives, switch to a `nonce` attribute. Out of scope. |
| `localStorage` blocked (Safari private mode, embedded). | The script catches; fallback path = OS preference. Documented in §3.4. |
| Phase 0 PR diff too large to review. | Split commits per concern: (a) report.md, (b) index.css refactor + anti-FOUC, (c) ThemeContext + ThemeToggle, (d) bootstrap-overrides.scss + Header, (e) atoms one-by-one, (f) wireframe spec doc. |
| `node-sass@4.x` install fails on newer Node (≥17 needs node-sass ≥7) or breaks on `npm ci` clean install. | We pin to `4.14.1` and document Node 14–16 requirement in CLAUDE.md. If install fails on the developer machine, fall back to `sass@1.x` (Dart Sass) — CRA 3 supports both; the syntax in `bootstrap-overrides.scss` is the lowest-common-denominator that compiles on either. |

---

## 9. Out of scope (explicit non-goals)

- Per-screen redesigns of any of the 15 remaining screens (handled by Phase 1–3).
- Migration to Tailwind 4 / shadcn / Lucide icons (DESIGN.md §10 — explicitly future work).
- Replacing `react-bootstrap` `<Button>` / `<Form.Control>` etc. across legacy screens (Bootstrap overrides keep them visually consistent; replacement happens organically when each screen is redesigned).
- Storybook or Jest tests for atoms (project has almost no test infrastructure; Phase 1+ adds tests where consumers exist).
- Server-side rendering / pre-render of theme (CRA SPA — anti-FOUC inline script is sufficient).
- Backend changes; API surface unchanged.

---

## 10. Open questions

None as of this writing — all five brainstorm questions are decided
(§2 table). New ambiguity arising during implementation will be raised
in the implementation plan or PR review, not here.

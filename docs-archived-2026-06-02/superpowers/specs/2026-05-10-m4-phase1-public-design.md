# M4 Phase 1 — Public screens (Home / Product / Cart)

> Status: design
> Owner: frontend
> Created: 2026-05-10
> Branch: `m4-redesign`
> Predecessors: `2026-05-10-m4-foundation-design.md` (Phase 0)
> Successors: Phase 2 (auth/checkout), Phase 3 (admin) — separate specs

---

## 1. Goal

Redesign the three public screens listed in `sitemap.md` (#1, #2, #3) to use
the design system tokens, the `ui/` atoms shipped in Phase 0, and the
HomeProductGrid / ProductDetails / Cart wireframes from
`2026-05-10-m4-foundation-design.md` §5. After Phase 1, an unauthenticated
visitor sees a fully redesigned site for the routes they have access to,
with the rest of the site still functional but visually un-redesigned (the
Bootstrap-overrides bridge from Phase 0 keeps it usable in both themes).

In scope:

- `screens/HomeScreen.js` (covers `/`, `/search/:keyword`, `/page/:n`,
  `/search/:keyword/page/:n`)
- `screens/ProductScreen.js` (`/product/:id`)
- `screens/CartScreen.js` (`/cart/:id?`)
- Five supporting components touched by the above:
  - `components/Product.js` (card on Home grid)
  - `components/ProductCarousel.js` (hero on Home)
  - `components/Paginate.js` (page row on Home and admin lists)
  - `components/Rating.js` (star row on Product card and ProductScreen)
  - `components/Loader.js`, `components/Message.js` (used everywhere)

Out of scope (deferred to later phases):

- Auth/checkout screens (#4–#10) — Phase 2
- Admin screens (#11–#15) — Phase 3
- Replacing `react-bootstrap` Carousel / Spinner / Alert with custom atoms
- Backend, Redux store, action creators, route configuration

---

## 2. Decisions (recap from brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| atoms vs supporting | Hybrid — `Product.js` and `Paginate.js` wrap `ui/Card` and `ui/Pagination` internally; `Rating.js`/`Loader.js`/`Message.js` get token-CSS in place | Keeps data/route logic in supporting components (admin lists also use `Paginate`); avoids inlining atoms into every screen; keeps the touch-surface narrow for Phase 1 |
| Carousel | Restyle `react-bootstrap` Carousel via CSS; minimal markup change (caption gets price + CTA) | Custom carousel is risk for cosmetic gain; the visual jump comes from removing the round image + token color application |
| Per-screen CSS | One `.css` sibling per screen + per touched component | Matches Phase 0 (`Header.css`, `ThemeToggle.css`) and the existing `FeatureListScreen.css` precedent |
| Anti-slop | No gradients on carousel caption (use solid `var(--card-alt)` overlay); generous spacing (`var(--space-2xl)` between hero and grid) | Conforms to `DESIGN.md` §11 |

---

## 3. Architecture

### 3.1 File layout (new files)

```
frontend/src/
  screens/
    HomeScreen.css           # NEW
    ProductScreen.css        # NEW
    CartScreen.css           # NEW
  components/
    Product.css              # NEW (sibling to Product.js)
    ProductCarousel.css      # NEW
    Rating.css               # NEW
    Loader.css               # NEW
    Message.css              # NEW
```

### 3.2 Modified files

```
frontend/src/
  screens/HomeScreen.js          # MODIFIED — wireframe layout, EmptyState, skeleton loading
  screens/ProductScreen.js       # MODIFIED — 3-col grid, sticky sidebar, ui/Badge, ui/Button, ui/FormField
  screens/CartScreen.js          # MODIFIED — 2-col grid, sticky summary, EmptyState
  components/Product.js          # MODIFIED — wraps ui/Card, restructured markup
  components/ProductCarousel.js  # MODIFIED — caption price+CTA, drop bg-dark
  components/Paginate.js         # MODIFIED — wraps ui/Pagination, history-driven navigation
  components/Rating.js           # MODIFIED — className hooks for Rating.css; no logic change
  components/Loader.js           # MODIFIED — className hooks; no logic change
  components/Message.js          # MODIFIED — className hooks; no logic change
```

### 3.3 Dependencies on Phase 0 atoms

| Consumer | Atom used | Notes |
|---|---|---|
| `HomeScreen.js` | `ui/EmptyState` (existing component, not in `ui/`) | Imported from `../components/EmptyState` |
| `Product.js` | `ui/Card` | Replaces `react-bootstrap` `<Card>` |
| `Paginate.js` | `ui/Pagination` | Replaces `react-bootstrap` `<Pagination>` |
| `ProductScreen.js` | `ui/Badge`, `ui/Button`, `ui/FormField` | Status badge, Add-to-Cart, Review form |
| `CartScreen.js` | `ui/Card`, `ui/Button`, `ui/EmptyState` | Summary card, Proceed-to-Checkout, empty state |

---

## 4. Per-screen design

### 4.1 HomeScreen

Structure (matches `2026-05-10-m4-foundation-design.md` §5.1 wireframe):

```
[Search row: SearchBox lives in Header; this row reserved for future filters]
[Go Back link — only when keyword present]
[ProductCarousel hero — only when no keyword]
[H2 "Latest Products" — caption-style, var(--muted) UPPERCASE]
[Grid of <Product> cards — Bootstrap Row/Col 12/6/4/3]
[<Paginate> when pages > 1]
```

States:

- **Default**: `products.length > 0` → carousel + grid + pagination.
- **Loading**: full-screen `<Loader />` (the existing component, restyled).
  Future enhancement (out of scope): swap the grid block for 8 skeleton
  cards via a dedicated `ProductCardSkeleton`. Phase 1 keeps the existing
  spinner pattern to limit scope.
- **Empty**: when `!loading && !error && products.length === 0` →
  `<EmptyState heading="No products found" subtitle={ keyword ? "Try a different search" : "Catalogue is empty" } />`. (Today this case shows nothing — a regression we fix.)
- **Error**: existing `<Message variant='danger'>{error}</Message>` (now token-styled).
- **Success**: n/a (read-only screen).

Markup-level diff:

- `<h1>Latest Products</h1>` → `<h2 className='home-section-title'>Latest Products</h2>` (caption-style).
- `<Link to='/' className='btn btn-light'>Go Back</Link>` → `<Link to='/' className='ui-btn ui-btn--secondary'>Go Back</Link>` (manual class application — no need to wire `ui/Button` for a single use, since Button doesn't render a `<Link>`).
- Wrapping `<>` becomes `<div className='home-page'>` for CSS scoping.

`HomeScreen.css`:

```css
.home-page { padding: var(--space-md) 0; }
.home-back  { display: inline-block; margin-bottom: var(--space-md); }
.home-hero  { margin-bottom: var(--space-2xl); }
.home-section-title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 var(--space-md) 0;
}
.home-grid { /* react-bootstrap Row/Col already provides layout */ }
.home-empty { padding: var(--space-2xl) 0; }
```

### 4.2 ProductScreen

Structure (matches `2026-05-10-m4-foundation-design.md` §5.2 wireframe):

```
[Go Back link]
[3-col grid desktop]
  Col 1: image (1:1, var(--radius-lg))
  Col 2: name (H1), Rating, price, description
  Col 3: sticky sidebar
    Card with:
      Price row
      Status badge (In Stock / Out Of Stock)
      Qty select (when in stock)
      Add-to-Cart button (primary)
[Reviews section: heading + list + write-review form]
```

Responsive:

- Desktop (≥ 1024px): 3 columns `1fr 1fr 320px`.
- Tablet (768–1023): 2 columns; image+info top row, sidebar full width below.
- Mobile (< 768): single column, sidebar last (sticky removed).

Markup-level diff:

- Wrap top `<Row>` (image + info + sidebar) in `<div className='product-page'>`.
- Replace `<Card>` (sidebar in current code uses `<Card>`+`<ListGroup>`) with `<Card>` from `ui/`. The `<ListGroup>` rows become flex rows (`.product-page__sidebar-row`).
- Status `<strong>...</strong>` → `<Badge variant={ countInStock > 0 ? 'primary' : 'danger' }>{ countInStock > 0 ? 'In Stock' : 'Out Of Stock' }</Badge>`.
- Add-to-Cart button: keep current handler; replace `<Button>` from react-bootstrap with `ui/Button variant='primary'` and `disabled={countInStock === 0}`.
- Review form: replace `Form.Group` blocks with `ui/FormField`. Submit button → `ui/Button`.
- Submit-review success: existing `<Message variant='success'>` (restyled).

`ProductScreen.css`:

```css
.product-page { display: grid; grid-template-columns: 1fr; gap: var(--space-md); padding: var(--space-md) 0; }
@media (min-width: 768px)  { .product-page { grid-template-columns: 1fr 1fr; } .product-page__sidebar { grid-column: 1 / -1; } }
@media (min-width: 1024px) { .product-page { grid-template-columns: 1fr 1fr 320px; } .product-page__sidebar { grid-column: auto; position: sticky; top: var(--space-lg); align-self: start; } }
.product-page__image { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius-lg); }
.product-page__name  { font-family: 'Manrope', system-ui, sans-serif; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 var(--space-sm) 0; }
.product-page__price { font-family: 'DM Mono', 'SF Mono', Consolas, monospace; font-feature-settings: 'tnum' 1; font-size: 20px; color: var(--primary); }
.product-page__sidebar-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--border); }
.product-page__sidebar-row:last-child { border-bottom: none; }
.product-reviews { margin-top: var(--space-2xl); }
.product-reviews__heading { font-family: 'Manrope', system-ui, sans-serif; font-size: 20px; font-weight: 600; margin: 0 0 var(--space-md) 0; }
.product-reviews__item    { padding: var(--space-md) 0; border-bottom: 1px solid var(--border); }
.product-reviews__form    { margin-top: var(--space-md); }
```

### 4.3 CartScreen

Structure (matches `2026-05-10-m4-foundation-design.md` §5.3 wireframe):

```
[H1 "Shopping Cart"]
[2-col grid desktop]
  Col 1 (1fr): rows of cart items
    Each row: image | name (link) | qty select | price (mono) | remove (ghost-icon button)
  Col 2 (320px sticky): summary card
    Subtotal: items count
    Total: $X.XX (mono, primary)
    [Proceed to Checkout button — primary, disabled when empty]
```

Empty state:

- When `cartItems.length === 0` → render `<EmptyState heading="Your cart is empty" subtitle="Browse the catalogue" cta={<Link to='/' className='ui-btn ui-btn--primary'>Browse</Link>} />`.

Markup-level diff:

- Replace existing `<Row>` + `<Col md={8}>` + `<Col md={4}>` with `<div className='cart-page'><div className='cart-list'>…</div><aside className='cart-summary'>…</aside></div>`.
- Replace `<ListGroup.Item>` for each cart row with `<div className='cart-row' key={item.product}>`.
- Remove button: `<Button type='button' variant='light' onClick={...}>` → `<button type='button' className='ui-btn ui-btn--icon ui-btn--ghost' aria-label={\`Remove ${item.name}\`}>` with FontAwesome trash icon (`<i className='fas fa-trash' />`).
- Summary `<Card>` becomes `<Card>` from `ui/`. Subtotal block uses `.cart-summary__row` for label+value, mono for value.
- Proceed-to-Checkout: `ui/Button variant='primary'`, `onClick={checkoutHandler}`, `disabled={cartItems.length === 0}`.

`CartScreen.css`:

```css
.cart-page    { display: grid; grid-template-columns: 1fr; gap: var(--space-md); padding: var(--space-md) 0; }
@media (min-width: 1024px) { .cart-page { grid-template-columns: 1fr 320px; } }
.cart-page__title { font-family: 'Manrope', system-ui, sans-serif; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 var(--space-md) 0; }

.cart-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px 80px 40px;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border);
}
.cart-row__image { width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-md); }
.cart-row__name a { color: var(--foreground); text-decoration: none; }
.cart-row__name a:hover { color: var(--primary); }
.cart-row__qty   { background: var(--background); color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 6px 10px; }
.cart-row__price { font-family: 'DM Mono', 'SF Mono', Consolas, monospace; font-feature-settings: 'tnum' 1; text-align: right; }

@media (max-width: 640px) {
  .cart-row { grid-template-columns: 64px 1fr 60px; grid-template-areas: 'img name remove' 'img qty price'; }
}

.cart-summary { position: static; }
@media (min-width: 1024px) { .cart-summary { position: sticky; top: var(--space-lg); align-self: start; } }
.cart-summary__row    { display: flex; justify-content: space-between; padding: var(--space-xs) 0; }
.cart-summary__total  { font-family: 'DM Mono', 'SF Mono', Consolas, monospace; color: var(--primary); font-size: 20px; }
.cart-summary__action { width: 100%; margin-top: var(--space-md); }
```

---

## 5. Per-component design

### 5.1 Product.js

Becomes a thin presentational wrapper around `ui/Card`. The Card itself
acts as the link via `as={Link}` polymorphism.

```jsx
import React from 'react'
import { Link } from 'react-router-dom'
import Card from './ui/Card'
import Rating from './Rating'
import './Product.css'

const Product = ({ product }) => (
  <Card as={Link} to={`/product/${product._id}`} clickable className='product-card'>
    <img src={product.image} alt={product.name} className='product-card__image' />
    <h4 className='product-card__name'>{product.name}</h4>
    <Rating value={product.rating} text={`${product.numReviews} reviews`} />
    <div className='product-card__price'>${product.price}</div>
  </Card>
)

export default Product
```

`Product.css`:

```css
.product-card { display: flex; flex-direction: column; gap: var(--space-sm); text-decoration: none; height: 100%; }
.product-card:hover { text-decoration: none; }
.product-card__image {
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
  border-radius: var(--radius-md); background: var(--card-alt);
}
.product-card__name {
  font-family: 'Manrope', system-ui, sans-serif; font-size: 16px; font-weight: 600;
  color: var(--foreground); margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: calc(1.4em * 2); /* reserves 2 lines so cards in a row align */
}
.product-card__price {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  font-size: 20px; font-weight: 500;
  color: var(--primary);
  margin-top: auto;
}
```

### 5.2 ProductCarousel.js

Restyle in place. Markup adds price into caption; structure stays.

```jsx
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Carousel, Image } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Loader from './Loader'
import Message from './Message'
import { listTopProducts } from '../actions/productActions'
import './ProductCarousel.css'

const ProductCarousel = () => {
  const dispatch = useDispatch()
  const productTopRated = useSelector((state) => state.productTopRated)
  const { loading, error, products } = productTopRated

  useEffect(() => { dispatch(listTopProducts()) }, [dispatch])

  if (loading) return <Loader />
  if (error)   return <Message variant='danger'>{error}</Message>
  return (
    <Carousel pause='hover' className='product-carousel'>
      {products.map((product) => (
        <Carousel.Item key={product._id}>
          <Link to={`/product/${product._id}`} className='product-carousel__link'>
            <Image src={product.image} alt={product.name} fluid className='product-carousel__image' />
            <Carousel.Caption className='product-carousel__caption'>
              <h2 className='product-carousel__name'>{product.name}</h2>
              <span className='product-carousel__price'>${product.price}</span>
            </Carousel.Caption>
          </Link>
        </Carousel.Item>
      ))}
    </Carousel>
  )
}

export default ProductCarousel
```

`ProductCarousel.css`:

```css
.product-carousel { background: var(--card); border-radius: var(--radius-lg); overflow: hidden; }
.product-carousel__link  { display: block; text-decoration: none; color: var(--foreground); }
.product-carousel__image {
  width: 100%; max-height: 56vh; object-fit: cover; border-radius: 0;
  padding: 0; margin: 0;
}
.product-carousel__caption {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: var(--card-alt);
  padding: var(--space-md);
  text-align: left;
}
.product-carousel__name  {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px; font-weight: 600; color: var(--foreground); margin: 0 0 var(--space-xs) 0;
}
.product-carousel__price {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1; color: var(--primary);
}
```

This also overrides the legacy carousel rules in `frontend/src/index.css`
(lines 25–55: round images, dark caption). Those rules apply globally to
`.carousel`; our `.product-carousel` rules win because of class
specificity. The legacy rules become dead — Phase 1 includes deleting
them from `index.css` to keep one source of truth.

### 5.3 Paginate.js

Wraps `ui/Pagination` and translates page-change callbacks into route
navigation. Public API unchanged (admin lists keep working).

```jsx
import React from 'react'
import { useHistory } from 'react-router-dom'
import Pagination from './ui/Pagination'

const Paginate = ({ pages, page, isAdmin = false, keyword = '' }) => {
  const history = useHistory()
  if (!pages || pages <= 1) return null

  const buildUrl = (p) => {
    if (isAdmin) return `/admin/productlist/${p}`
    if (keyword) return `/search/${keyword}/page/${p}`
    return `/page/${p}`
  }

  return (
    <Pagination
      currentPage={page}
      totalPages={pages}
      onPageChange={(p) => history.push(buildUrl(p))}
    />
  )
}

export default Paginate
```

### 5.4 Rating.js (restyle only)

Today renders three `<span>` star icons + a text label using a hard-coded
`#f8e825` color. Refactor: keep markup, add a className prop hook for
optional styling, and define `Rating.css` so all stars use `var(--primary)`.

The current file uses inline `style={{ color }}`. Phase 1 removes both
the inline style and the `color` prop in favor of a CSS rule, so the
color participates in theming. Grep confirms no consumer passes `color`
today, so the prop is removed from the signature outright (no shim).

### 5.5 Loader.js (restyle only)

Today renders a `react-bootstrap` `<Spinner animation='border'>` with
inline style block (width/height 100px). Add a className `app-loader` and
move sizing to `Loader.css` so future tweaks are CSS-only. Border color
becomes `var(--primary)`.

### 5.6 Message.js (restyle only)

Today renders a `react-bootstrap` `<Alert variant={variant}>`. Phase 1
keeps the API but adds `Message.css` overrides so the four variants
(`danger`, `success`, `info`, `warning`) read from tokens
(`--destructive`, `--primary`, `--info`, `--muted`). Each variant gets a
`color-mix` background tint and a solid border-color matching its
semantic token.

---

## 6. Acceptance criteria

Phase 1 is done when ALL of these hold (verified manually in browser
unless noted):

1. `/` loads with the new home layout: Bootstrap navbar (already from
   Phase 0), restyled hero carousel, "LATEST PRODUCTS" caption-style
   heading, grid of 8 product cards with image/name/rating/price.
2. `/search/laptop` shows the same grid filtered by keyword, with
   "Go Back" secondary-style link visible above the grid (no carousel).
3. `/page/2` paginates correctly via the redesigned `<Paginate>` (page
   numbers token-styled; current page = primary).
4. `/search/zzzznotreal` (no matches) shows the new `EmptyState` with
   "No products found" / "Try a different search". (Currently shows
   nothing — this is a new behaviour.)
5. `/product/<id>` renders the 3-column desktop layout with sticky
   sidebar; on tablet collapses to 2 columns; on mobile to single
   column. Status `Badge` shows green-tint primary for In Stock and
   red-tint danger for Out Of Stock. Add-to-Cart button is primary,
   disabled when out of stock.
6. Review form on ProductScreen uses the redesigned `FormField` for
   comment/rating; submit button is primary; success message uses the
   restyled `Message variant='success'`.
7. `/cart` with items shows the 2-column layout, sticky summary on
   desktop, list rows with image/name/qty/price/ghost-icon-remove. Total
   is mono primary.
8. `/cart` with no items shows `EmptyState` with "Your cart is empty" +
   "Browse" CTA → `/`.
9. Theme toggle works on all three screens (background/text/border flips
   in both directions; carousel caption follows; product card border
   follows; cart summary follows).
10. `npm test --prefix frontend -- --testPathPattern=FeatureListScreen
    --watchAll=false` still passes (no regression).
11. `npm run build --prefix frontend` exits cleanly (no new ESLint errors;
    pre-existing exhaustive-deps warnings on legacy `ProductScreen` /
    `OrderScreen` are not new).
12. No accidental touch of the 12 unredesigned screens (verify via
    `git diff --stat` after the branch — only the files in §3.1/§3.2
    should have non-zero diff from the Phase 0 baseline).
13. Touch targets ≥ 44×44 px on mobile for: cart row remove button, cart
    qty select, Add-to-Cart, Pagination buttons, carousel prev/next
    arrows. Verified by inspecting computed style.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `Card` atom rendered as `<Link>` (via `as={Link}`) doesn't behave like a Bootstrap Card on hover/focus. | Card atom already supports `as` prop and `clickable` mode (Phase 0 §4.1). Test focus ring on keyboard tab. |
| Existing carousel CSS in `index.css` (lines 25–55) collides with `ProductCarousel.css`. | Spec includes deleting the legacy block in `index.css` as part of Task "remove legacy carousel CSS". The new rules are all `.product-carousel*`-scoped, no global `.carousel` rules left. |
| `ui/Pagination` totalPages can be very large (admin product list has ~50 pages potential). | Out of scope to virtualize. Acceptable for the seeded dataset. Note as future work in Phase 3. |
| `Paginate.js` change affects `ProductListScreen` (admin) — that screen passes `isAdmin={true}`. | API preserved (`pages`, `page`, `isAdmin`, `keyword`). Admin call path is unchanged; `useHistory()` works in admin too. |
| `Message.js` restyle affects every screen that renders a Message — including unredesigned ones. | This is intended (consistent visuals). Risk: if a Message is rendered on a dark-text-on-light-bg legacy screen and our `color-mix` background becomes too transparent, contrast may degrade. We pick conservative tints (15%) and verify on at least Login + ProductList (legacy) before merge. |
| `Rating.js` color was hard-coded at `#f8e825` (yellow). Switching to `var(--primary)` makes stars green/lime. | Intentional brand alignment. If feedback is "stars must be yellow", we add a `--rating: var(--primary)` token and let it diverge later. Document in commit. |
| Removing inline color/style from `Rating` may break consumers passing `color` prop. | Grep confirms no consumer passes `color` today. The prop is dropped from the signature (renamed to ignore-and-deprecate via JSDoc). |

---

## 8. Out of scope (explicit non-goals)

- Skeleton loaders for product grid (kept Loader spinner; would be a
  Phase 4 polish).
- Replacing react-bootstrap `<Carousel>` / `<Spinner>` / `<Alert>` with
  custom React atoms.
- Adding a category filter UI to HomeScreen (the wireframe shows a
  "Filters: Category ▾" placeholder; backend has no category-filter API
  today, so we skip the UI to avoid building dead controls).
- Mobile bottom sheet for cart row actions.
- PayPal / payment changes (Phase 2).
- Sticky add-to-cart on mobile ProductScreen (would require scroll-aware
  positioning; defer).
- Image lazy loading (Phase 4 perf pass).
- Update of #1/#2/#3 checkboxes in `report.md` — done after merge as a
  post-implementation commit (single source of truth for completion is
  the merged code, not the checklist).

---

## 9. Open questions

None. All brainstorm decisions are recorded in §2; implementation choices
inside that scope (e.g., exact CSS values for image aspect ratios,
breakpoint values, sticky offsets) are spec'd in §4 and §5.

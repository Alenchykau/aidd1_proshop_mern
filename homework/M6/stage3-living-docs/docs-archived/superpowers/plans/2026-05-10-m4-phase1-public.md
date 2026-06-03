# M4 Phase 1 — Public Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign HomeScreen, ProductScreen, CartScreen and their five supporting components (Product, ProductCarousel, Paginate, Rating, Loader, Message) to use design tokens and Phase 0 atoms, per the wireframes in the Phase 0 spec §5.

**Architecture:** Hybrid — `Product.js` and `Paginate.js` wrap `ui/Card` and `ui/Pagination` atoms internally so admin-list consumers keep working through the same API; `Rating.js`/`Loader.js`/`Message.js` are restyled in place via sibling `.css` files; the three screens get their own `.css` files for layout (3-col product grid, 2-col cart layout, hero spacing on Home).

**Tech Stack:** React 16.13 + classic Redux + react-bootstrap 1.3 (existing). Pure CSS using design tokens defined in Phase 0. FontAwesome icons via existing CDN link.

**Spec:** `docs/superpowers/specs/2026-05-10-m4-phase1-public-design.md`

**Notes for the engineer:**
- The project pins old versions on purpose. Do not migrate to react-router v6 / Redux Toolkit / React 17+.
- All components are JS, no TypeScript. No tests are required for Phase 1 (project test infra is minimal — only `FeatureListScreen.test.js`).
- Commit format from `CLAUDE.md`: `course: <type>: <summary>`. Do **not** add a `Co-Authored-By:` trailer.
- Keep each task single-purpose: one commit per task. The plan order makes downstream tasks compile cleanly after each commit.

---

## File map

**New files**
- `frontend/src/components/Product.css`
- `frontend/src/components/ProductCarousel.css`
- `frontend/src/components/Rating.css`
- `frontend/src/components/Loader.css`
- `frontend/src/components/Message.css`
- `frontend/src/screens/HomeScreen.css`
- `frontend/src/screens/ProductScreen.css`
- `frontend/src/screens/CartScreen.css`

**Modified files**
- `frontend/src/index.css` — delete legacy `.carousel*` rules (lines ~25–55)
- `frontend/src/components/EmptyState.js` — add optional `cta` prop
- `frontend/src/components/Rating.js` — remove `color` prop, restructure with className hooks
- `frontend/src/components/Loader.js` — className + sizing via CSS
- `frontend/src/components/Message.js` — className hook
- `frontend/src/components/Product.js` — wrap `ui/Card`, restructured markup
- `frontend/src/components/ProductCarousel.js` — caption with price, drop bg-dark, drop round image
- `frontend/src/components/Paginate.js` — wrap `ui/Pagination`, history-driven navigation
- `frontend/src/screens/HomeScreen.js` — wireframe layout, EmptyState, caption-style heading
- `frontend/src/screens/ProductScreen.js` — 3-col grid, sticky sidebar, ui/Badge, ui/Button, ui/FormField
- `frontend/src/screens/CartScreen.js` — 2-col grid, sticky summary, EmptyState

---

## Task 1: Restyle `Rating`

**Files:**
- Modify: `frontend/src/components/Rating.js`
- Create: `frontend/src/components/Rating.css`

Remove the inline `color` style and the `color` prop entirely. Color now comes from a CSS rule reading `var(--primary)` so the stars participate in theming. Keep the rest of the markup.

- [ ] **Step 1: Create `Rating.css`**

```css
.rating {
  display: inline-flex;
  align-items: center;
  gap: var(--space-micro);
  color: var(--primary);
}

.rating > span {
  display: inline-flex;
}

.rating__text {
  margin-left: var(--space-xs);
  color: var(--muted);
  font-size: 13px;
}
```

- [ ] **Step 2: Replace `Rating.js`**

Replace the entire contents of `frontend/src/components/Rating.js` with:

```js
import React from 'react'
import './Rating.css'

const Rating = ({ value, text }) => {
  const star = (threshold) => {
    if (value >= threshold) return 'fas fa-star'
    if (value >= threshold - 0.5) return 'fas fa-star-half-alt'
    return 'far fa-star'
  }

  return (
    <div className='rating'>
      {[1, 2, 3, 4, 5].map((threshold) => (
        <span key={threshold}>
          <i className={star(threshold)} aria-hidden='true' />
        </span>
      ))}
      {text && <span className='rating__text'>{text}</span>}
    </div>
  )
}

export default Rating
```

The hand-unrolled star markup is collapsed to a `[1..5].map`. Behavior is identical: half-star kicks in at `value >= threshold - 0.5`. The `defaultProps` block disappears with the prop.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Rating.js frontend/src/components/Rating.css
git commit -m "course: refactor: token-driven Rating without color prop"
```

---

## Task 2: Restyle `Loader`

**Files:**
- Modify: `frontend/src/components/Loader.js`
- Create: `frontend/src/components/Loader.css`

Move sizing from inline style to CSS. Spinner border color now reads `var(--primary)` (overriding Bootstrap's blue).

- [ ] **Step 1: Create `Loader.css`**

```css
.app-loader {
  width: 64px;
  height: 64px;
  margin: var(--space-2xl) auto;
  display: block;
  border-color: var(--primary);
  border-right-color: transparent;
}
```

- [ ] **Step 2: Replace `Loader.js`**

Replace the entire contents of `frontend/src/components/Loader.js` with:

```js
import React from 'react'
import { Spinner } from 'react-bootstrap'
import './Loader.css'

const Loader = () => (
  <Spinner animation='border' role='status' className='app-loader'>
    <span className='sr-only'>Loading...</span>
  </Spinner>
)

export default Loader
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Loader.js frontend/src/components/Loader.css
git commit -m "course: refactor: token-driven Loader spinner"
```

---

## Task 3: Restyle `Message`

**Files:**
- Modify: `frontend/src/components/Message.js`
- Create: `frontend/src/components/Message.css`

Add a className hook to the underlying `<Alert>` and override `.alert-{variant}` rules to use design tokens. The four variants we need are `danger`, `success`, `info`, `warning` — `info` is the default; `warning` falls back to `--muted` since the palette has no warning hue.

- [ ] **Step 1: Create `Message.css`**

```css
/* Override Bootstrap's .alert-* visuals with token-driven tints. */
.app-message.alert {
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  font-size: 14px;
  margin-bottom: var(--space-md);
}

.app-message.alert-danger {
  background: color-mix(in srgb, var(--destructive) 15%, transparent);
  border: 1px solid var(--destructive);
  color: var(--destructive);
}

.app-message.alert-success {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  border: 1px solid var(--primary);
  color: var(--primary);
}

.app-message.alert-info {
  background: color-mix(in srgb, var(--info) 15%, transparent);
  border: 1px solid var(--info);
  color: var(--info);
}

.app-message.alert-warning {
  background: color-mix(in srgb, var(--muted) 15%, transparent);
  border: 1px solid var(--muted);
  color: var(--foreground);
}

.app-message a {
  color: inherit;
  text-decoration: underline;
}
```

- [ ] **Step 2: Replace `Message.js`**

Replace the entire contents of `frontend/src/components/Message.js` with:

```js
import React from 'react'
import { Alert } from 'react-bootstrap'
import './Message.css'

const Message = ({ variant, children }) => (
  <Alert variant={variant} className='app-message'>{children}</Alert>
)

Message.defaultProps = {
  variant: 'info',
}

export default Message
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Message.js frontend/src/components/Message.css
git commit -m "course: refactor: token-driven Message alert variants"
```

---

## Task 4: Extend `EmptyState` with optional `cta`

**Files:**
- Modify: `frontend/src/components/EmptyState.js`

Add an optional `cta` prop so HomeScreen and CartScreen can render a primary action below the message. Keep the existing API additive (icon/heading/subtitle still work).

- [ ] **Step 1: Read the current file**

Current (`frontend/src/components/EmptyState.js`) renders `<div class="empty-state">` with optional icon, then `<h3>` heading, then `<p>` subtitle.

- [ ] **Step 2: Replace contents**

```js
import React from 'react'
import './EmptyState.css'

const EmptyState = ({ icon, heading, subtitle, cta }) => {
  return (
    <div className='empty-state'>
      {icon ? <div className='empty-state-icon'>{icon}</div> : null}
      <h3>{heading}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
      {cta ? <div className='empty-state-cta'>{cta}</div> : null}
    </div>
  )
}

export default EmptyState
```

- [ ] **Step 3: Append `.empty-state-cta` to `EmptyState.css`**

Open `frontend/src/components/EmptyState.css` and append:

```css
.empty-state-cta {
  margin-top: var(--space-md);
}
```

- [ ] **Step 4: Commit**

```
git add frontend/src/components/EmptyState.js frontend/src/components/EmptyState.css
git commit -m "course: feat: add optional cta slot to EmptyState"
```

---

## Task 5: Refactor `Product` to wrap `ui/Card`

**Files:**
- Modify: `frontend/src/components/Product.js`
- Create: `frontend/src/components/Product.css`

The card itself becomes the link via `as={Link}` polymorphism — no nested anchor.

- [ ] **Step 1: Create `Product.css`**

```css
.product-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  text-decoration: none;
  height: 100%;
}

.product-card:hover { text-decoration: none; }

.product-card__image {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--card-alt);
}

.product-card__name {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: calc(1.4em * 2);
}

.product-card__price {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  font-size: 20px;
  font-weight: 500;
  color: var(--primary);
  margin-top: auto;
}
```

- [ ] **Step 2: Replace `Product.js`**

```js
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

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Product.js frontend/src/components/Product.css
git commit -m "course: refactor: Product card uses ui/Card and tokens"
```

---

## Task 6: Refactor `ProductCarousel` and remove legacy carousel CSS

**Files:**
- Modify: `frontend/src/components/ProductCarousel.js`
- Create: `frontend/src/components/ProductCarousel.css`
- Modify: `frontend/src/index.css` (delete legacy carousel rules)

Caption gains a price line. Image goes from round 300px to a 16:9 hero capped at 56vh per DESIGN.md anti-slop §11 ("hero takes max 60vh").

- [ ] **Step 1: Create `ProductCarousel.css`**

```css
.product-carousel {
  background: var(--card);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.product-carousel__link {
  display: block;
  text-decoration: none;
  color: var(--foreground);
}

.product-carousel__image {
  width: 100%;
  max-height: 56vh;
  object-fit: cover;
  border-radius: 0;
  padding: 0;
  margin: 0;
}

.product-carousel__caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card-alt);
  padding: var(--space-md);
  text-align: left;
}

.product-carousel__name {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 var(--space-xs) 0;
}

.product-carousel__price {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--primary);
}
```

- [ ] **Step 2: Replace `ProductCarousel.js`**

```js
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

  useEffect(() => {
    dispatch(listTopProducts())
  }, [dispatch])

  if (loading) return <Loader />
  if (error) return <Message variant='danger'>{error}</Message>

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

- [ ] **Step 3: Delete legacy carousel rules from `index.css`**

Open `frontend/src/index.css`. Delete the entire block from `/* carousel */` (around line 25) through the closing brace of the `@media (max-width: 900px)` rule at the end of that block (around line 55). The exact rules to remove:

```css
/* carousel */
.carousel-item-next,
.carousel-item-prev,
.carousel-item.active {
  display: flex;
}
.carousel-caption {
  position: absolute;
  top: 0;
}

.carousel-caption h2 {
  color: #fff;
}

.carousel img {
  height: 300px;
  padding: 30px;
  margin: 40px;
  border-radius: 50%;
  margin-left: auto;
  margin-right: auto;
}
.carousel a {
  margin: 0 auto;
}
@media (max-width: 900px) {
  .carousel-caption h2 {
    font-size: 2.5vw;
  }
}
```

After deletion, the `main { min-height: 80vh; }` rule and the design token block should be the only contents of the file (besides the Google Fonts import at the top and the h1/h2/h3/.rating rules).

- [ ] **Step 4: Commit**

```
git add frontend/src/components/ProductCarousel.js frontend/src/components/ProductCarousel.css frontend/src/index.css
git commit -m "course: refactor: token-driven hero carousel and drop legacy CSS"
```

---

## Task 7: Refactor `Paginate` to wrap `ui/Pagination`

**Files:**
- Modify: `frontend/src/components/Paginate.js`

Public API stays the same (`pages`, `page`, `isAdmin`, `keyword`) so admin lists keep working unchanged.

- [ ] **Step 1: Replace `Paginate.js`**

```js
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

- [ ] **Step 2: Commit**

```
git add frontend/src/components/Paginate.js
git commit -m "course: refactor: Paginate wraps ui/Pagination with route-aware nav"
```

---

## Task 8: Refactor `HomeScreen`

**Files:**
- Modify: `frontend/src/screens/HomeScreen.js`
- Create: `frontend/src/screens/HomeScreen.css`

Adds an EmptyState branch for "no products found" (currently the screen renders nothing in that case — a regression we fix). Caption-style heading replaces `<h1>`. Go Back becomes a token-styled secondary link.

- [ ] **Step 1: Create `HomeScreen.css`**

```css
.home-page {
  padding: var(--space-md) 0;
}

.home-back {
  display: inline-block;
  margin-bottom: var(--space-md);
}

.home-hero {
  margin-bottom: var(--space-2xl);
}

.home-section-title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 var(--space-md) 0;
}

.home-empty {
  padding: var(--space-2xl) 0;
}
```

- [ ] **Step 2: Replace `HomeScreen.js`**

```js
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Row, Col } from 'react-bootstrap'
import Product from '../components/Product'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Paginate from '../components/Paginate'
import ProductCarousel from '../components/ProductCarousel'
import EmptyState from '../components/EmptyState'
import Meta from '../components/Meta'
import { listProducts } from '../actions/productActions'
import './HomeScreen.css'

const HomeScreen = ({ match }) => {
  const keyword = match.params.keyword
  const pageNumber = match.params.pageNumber || 1

  const dispatch = useDispatch()

  const productList = useSelector((state) => state.productList)
  const { loading, error, products, page, pages } = productList

  useEffect(() => {
    dispatch(listProducts(keyword, pageNumber))
  }, [dispatch, keyword, pageNumber])

  return (
    <div className='home-page'>
      <Meta />
      {keyword ? (
        <Link to='/' className='home-back ui-btn ui-btn--secondary ui-btn--sm'>
          ‹ Go Back
        </Link>
      ) : (
        <div className='home-hero'>
          <ProductCarousel />
        </div>
      )}
      <h2 className='home-section-title'>Latest Products</h2>
      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : products.length === 0 ? (
        <div className='home-empty'>
          <EmptyState
            heading='No products found'
            subtitle={keyword ? 'Try a different search term' : 'Catalogue is empty'}
          />
        </div>
      ) : (
        <>
          <Row>
            {products.map((product) => (
              <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                <Product product={product} />
              </Col>
            ))}
          </Row>
          <Paginate
            pages={pages}
            page={page}
            keyword={keyword ? keyword : ''}
          />
        </>
      )}
    </div>
  )
}

export default HomeScreen
```

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/HomeScreen.js frontend/src/screens/HomeScreen.css
git commit -m "course: feat: redesign HomeScreen with hero, grid, and EmptyState"
```

---

## Task 9: Refactor `ProductScreen`

**Files:**
- Modify: `frontend/src/screens/ProductScreen.js`
- Create: `frontend/src/screens/ProductScreen.css`

3-column desktop layout via CSS Grid, sticky sidebar, status `Badge` instead of inline text, Add-to-Cart as `ui/Button`, review form using `ui/FormField`.

- [ ] **Step 1: Create `ProductScreen.css`**

```css
.product-page {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
  padding: var(--space-md) 0;
}

@media (min-width: 768px) {
  .product-page { grid-template-columns: 1fr 1fr; }
  .product-page__sidebar { grid-column: 1 / -1; }
}

@media (min-width: 1024px) {
  .product-page { grid-template-columns: 1fr 1fr 320px; }
  .product-page__sidebar {
    grid-column: auto;
    position: sticky;
    top: var(--space-lg);
    align-self: start;
  }
}

.product-page__image {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius-lg);
}

.product-page__name {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-sm) 0;
  color: var(--foreground);
}

.product-page__price {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  font-size: 20px;
  color: var(--primary);
}

.product-page__description {
  color: var(--foreground);
  font-size: 15px;
  line-height: 1.6;
  margin-top: var(--space-sm);
}

.product-page__sidebar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border);
}

.product-page__sidebar-row:last-child {
  border-bottom: none;
  padding-top: var(--space-md);
}

.product-page__qty {
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
}

.product-reviews {
  margin-top: var(--space-2xl);
}

.product-reviews__heading {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 var(--space-md) 0;
  color: var(--foreground);
}

.product-reviews__item {
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--border);
}

.product-reviews__author {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}

.product-reviews__date {
  font-size: 13px;
  color: var(--muted);
  margin: var(--space-micro) 0;
}

.product-reviews__form {
  margin-top: var(--space-md);
  max-width: 480px;
}

.product-page__back  { margin-bottom: var(--space-md); }
.product-page__price--inline { margin-top: var(--space-sm); }
.product-page__add-to-cart   { width: 100%; }

.product-reviews__field { margin-bottom: var(--space-sm); }
.product-reviews__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: var(--space-micro);
}
.product-reviews__select   { width: 100%; }
.product-reviews__textarea { width: 100%; font-family: inherit; }
```

- [ ] **Step 2: Replace `ProductScreen.js`**

Important: the `<FormField>` atom from Phase 0 only renders an `<input>` element — it does NOT support `as='select'` or `as='textarea'`. The review form below renders the rating select and comment textarea as plain HTML elements with the `.product-page__qty` class for token styling, and the labels are hand-rolled `<label>` blocks. Don't import `FormField` here.

```js
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Rating from '../components/Rating'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Meta from '../components/Meta'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  listProductDetails,
  createProductReview,
} from '../actions/productActions'
import { PRODUCT_CREATE_REVIEW_RESET } from '../constants/productConstants'
import './ProductScreen.css'

const ProductScreen = ({ history, match }) => {
  const [qty, setQty] = useState(1)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const dispatch = useDispatch()

  const productDetails = useSelector((state) => state.productDetails)
  const { loading, error, product } = productDetails

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const productReviewCreate = useSelector((state) => state.productReviewCreate)
  const {
    success: successProductReview,
    loading: loadingProductReview,
    error: errorProductReview,
  } = productReviewCreate

  useEffect(() => {
    if (successProductReview) {
      setRating(0)
      setComment('')
    }
    if (!product._id || product._id !== match.params.id) {
      dispatch(listProductDetails(match.params.id))
      dispatch({ type: PRODUCT_CREATE_REVIEW_RESET })
    }
  }, [dispatch, match, successProductReview])

  const addToCartHandler = () => {
    history.push(`/cart/${match.params.id}?qty=${qty}`)
  }

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(createProductReview(match.params.id, { rating, comment }))
  }

  return (
    <>
      <Link to='/' className='ui-btn ui-btn--secondary ui-btn--sm product-page__back'>
        ‹ Go Back
      </Link>
      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <>
          <Meta title={product.name} />
          <div className='product-page'>
            <div>
              <img src={product.image} alt={product.name} className='product-page__image' />
            </div>
            <div>
              <h1 className='product-page__name'>{product.name}</h1>
              <Rating value={product.rating} text={`${product.numReviews} reviews`} />
              <div className='product-page__price product-page__price--inline'>${product.price}</div>
              <p className='product-page__description'>{product.description}</p>
            </div>
            <Card className='product-page__sidebar'>
              <div className='product-page__sidebar-row'>
                <span>Price</span>
                <span className='product-page__price'>${product.price}</span>
              </div>
              <div className='product-page__sidebar-row'>
                <span>Status</span>
                <Badge variant={product.countInStock > 0 ? 'primary' : 'danger'}>
                  {product.countInStock > 0 ? 'In Stock' : 'Out Of Stock'}
                </Badge>
              </div>
              {product.countInStock > 0 && (
                <div className='product-page__sidebar-row'>
                  <label htmlFor='qty-select'>Qty</label>
                  <select
                    id='qty-select'
                    className='product-page__qty'
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  >
                    {[...Array(product.countInStock).keys()].map((x) => (
                      <option key={x + 1} value={x + 1}>{x + 1}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className='product-page__sidebar-row'>
                <Button
                  variant='primary'
                  onClick={addToCartHandler}
                  disabled={product.countInStock === 0}
                  className='product-page__add-to-cart'
                >
                  Add To Cart
                </Button>
              </div>
            </Card>
          </div>

          <div className='product-reviews'>
            <h2 className='product-reviews__heading'>Reviews</h2>
            {product.reviews.length === 0 && <Message>No Reviews</Message>}
            {product.reviews.map((review) => (
              <div className='product-reviews__item' key={review._id}>
                <div className='product-reviews__author'>{review.name}</div>
                <Rating value={review.rating} />
                <p className='product-reviews__date'>{review.createdAt.substring(0, 10)}</p>
                <p>{review.comment}</p>
              </div>
            ))}

            <div className='product-reviews__form'>
              <h2 className='product-reviews__heading'>Write a Customer Review</h2>
              {successProductReview && (
                <Message variant='success'>Review submitted successfully</Message>
              )}
              {loadingProductReview && <Loader />}
              {errorProductReview && (
                <Message variant='danger'>{errorProductReview}</Message>
              )}
              {userInfo ? (
                <form onSubmit={submitHandler}>
                  <div className='product-reviews__field'>
                    <label htmlFor='review-rating' className='product-reviews__label'>Rating</label>
                    <select
                      id='review-rating'
                      className='product-page__qty product-reviews__select'
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                    >
                      <option value=''>Select...</option>
                      <option value='1'>1 - Poor</option>
                      <option value='2'>2 - Fair</option>
                      <option value='3'>3 - Good</option>
                      <option value='4'>4 - Very Good</option>
                      <option value='5'>5 - Excellent</option>
                    </select>
                  </div>
                  <div className='product-reviews__field'>
                    <label htmlFor='review-comment' className='product-reviews__label'>Comment</label>
                    <textarea
                      id='review-comment'
                      className='product-page__qty product-reviews__textarea'
                      rows='3'
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <Button
                    variant='primary'
                    type='submit'
                    loading={loadingProductReview}
                  >
                    Submit Review
                  </Button>
                </form>
              ) : (
                <Message>
                  Please <Link to='/login'>sign in</Link> to write a review
                </Message>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default ProductScreen
```

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/ProductScreen.js frontend/src/screens/ProductScreen.css
git commit -m "course: feat: redesign ProductScreen with 3-col grid and atoms"
```

---

## Task 10: Refactor `CartScreen`

**Files:**
- Modify: `frontend/src/screens/CartScreen.js`
- Create: `frontend/src/screens/CartScreen.css`

2-column desktop layout, sticky summary, EmptyState with browse CTA.

- [ ] **Step 1: Create `CartScreen.css`**

```css
.cart-page {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
  padding: var(--space-md) 0;
}

@media (min-width: 1024px) {
  .cart-page { grid-template-columns: 1fr 320px; }
}

.cart-page__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-md) 0;
  color: var(--foreground);
}

.cart-list {
  display: flex;
  flex-direction: column;
}

.cart-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px 80px 40px;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border);
}

.cart-row__image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

.cart-row__name a { color: var(--foreground); text-decoration: none; }
.cart-row__name a:hover { color: var(--primary); }

.cart-row__qty {
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  width: 100%;
}

.cart-row__price {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  text-align: right;
}

@media (max-width: 640px) {
  .cart-row {
    grid-template-columns: 64px 1fr 60px;
    grid-template-areas:
      'img name remove'
      'img qty  price';
    column-gap: var(--space-xs);
  }
  .cart-row__image  { grid-area: img; width: 64px; height: 64px; }
  .cart-row__name   { grid-area: name; }
  .cart-row__qty    { grid-area: qty; }
  .cart-row__price  { grid-area: price; }
  .cart-row__remove { grid-area: remove; }
}

.cart-summary { position: static; }
@media (min-width: 1024px) {
  .cart-summary { position: sticky; top: var(--space-lg); align-self: start; }
}

.cart-summary__row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
  color: var(--foreground);
}

.cart-summary__total {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--primary);
  font-size: 20px;
}

.cart-summary__action {
  width: 100%;
  margin-top: var(--space-md);
}
```

- [ ] **Step 2: Replace `CartScreen.js`**

```js
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/EmptyState'
import { addToCart, removeFromCart } from '../actions/cartActions'
import './CartScreen.css'

const CartScreen = ({ match, location, history }) => {
  const productId = match.params.id
  const qty = location.search ? Number(location.search.split('=')[1]) : 1

  const dispatch = useDispatch()

  const cart = useSelector((state) => state.cart)
  const { cartItems } = cart

  useEffect(() => {
    if (productId) {
      dispatch(addToCart(productId, qty))
    }
  }, [dispatch, productId, qty])

  const removeFromCartHandler = (id) => {
    dispatch(removeFromCart(id))
  }

  const checkoutHandler = () => {
    history.push('/login?redirect=shipping')
  }

  const itemCount = cartItems.reduce((acc, item) => acc + item.qty, 0)
  const subtotal = cartItems.reduce((acc, item) => acc + item.qty * item.price, 0)

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: 'var(--space-2xl) 0' }}>
        <EmptyState
          heading='Your cart is empty'
          subtitle='Browse the catalogue to add products'
          cta={<Link to='/' className='ui-btn ui-btn--primary'>Browse Catalogue</Link>}
        />
      </div>
    )
  }

  return (
    <div className='cart-page'>
      <div>
        <h1 className='cart-page__title'>Shopping Cart</h1>
        <div className='cart-list'>
          {cartItems.map((item) => (
            <div className='cart-row' key={item.product}>
              <img src={item.image} alt={item.name} className='cart-row__image' />
              <div className='cart-row__name'>
                <Link to={`/product/${item.product}`}>{item.name}</Link>
              </div>
              <select
                className='cart-row__qty'
                value={item.qty}
                onChange={(e) => dispatch(addToCart(item.product, Number(e.target.value)))}
                aria-label={`Quantity for ${item.name}`}
              >
                {[...Array(item.countInStock).keys()].map((x) => (
                  <option key={x + 1} value={x + 1}>{x + 1}</option>
                ))}
              </select>
              <div className='cart-row__price'>${item.price}</div>
              <button
                type='button'
                className='ui-btn ui-btn--icon ui-btn--ghost cart-row__remove'
                onClick={() => removeFromCartHandler(item.product)}
                aria-label={`Remove ${item.name}`}
              >
                <i className='fas fa-trash' aria-hidden='true' />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Card className='cart-summary'>
        <div className='cart-summary__row'>
          <span>Subtotal ({itemCount} items)</span>
        </div>
        <div className='cart-summary__row'>
          <span>Total</span>
          <span className='cart-summary__total'>${subtotal.toFixed(2)}</span>
        </div>
        <Button
          variant='primary'
          onClick={checkoutHandler}
          className='cart-summary__action'
        >
          Proceed To Checkout
        </Button>
      </Card>
    </div>
  )
}

export default CartScreen
```

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/CartScreen.js frontend/src/screens/CartScreen.css
git commit -m "course: feat: redesign CartScreen with 2-col layout and EmptyState"
```

---

## Task 11: Acceptance verification

This task runs the spec §6 acceptance criteria. No new code unless a fix is needed.

- [ ] **Step 1: Existing test still passes**

```
npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false
```

Expected: PASS (4 tests).

- [ ] **Step 2: Build is clean**

```
npm run build --prefix frontend
```

Expected: "Compiled with warnings" or "Compiled successfully". The two pre-existing exhaustive-deps warnings (ProductScreen line 44, OrderScreen line 77) are still allowed; any NEW warning must be fixed first. ProductScreen now has additional setState calls — confirm the existing exhaustive-deps suppression still covers them, and add new entries to the dep array if a new warning appears.

- [ ] **Step 3: Diff scope check**

```
git diff --stat <commit-before-task-1>..HEAD
```

Expected: only the files in §3.1 / §3.2 of the spec are touched. No accidental edits to OrderListScreen, UserListScreen, etc.

- [ ] **Step 4: Manual browser smoke**

Open the dev server. Verify each acceptance criterion from spec §6:

| # | Check | Where |
|---|---|---|
| 1 | `/` — hero carousel + caption-style heading + product grid | `http://localhost:3000/` |
| 2 | `/search/laptop` — grid filtered, Go Back link visible | `http://localhost:3000/search/laptop` |
| 3 | `/page/2` — pagination works, current page = primary | `http://localhost:3000/page/2` |
| 4 | `/search/zzzznotreal` — EmptyState renders | `http://localhost:3000/search/zzzznotreal` |
| 5 | `/product/<id>` — 3-col desktop, In Stock badge | open any product card on Home |
| 6 | Review form (auth required) — login first, then post review | `http://localhost:3000/product/<id>` after login |
| 7 | `/cart` with items — 2-col, sticky summary, mono total | add a product to cart from the carousel |
| 8 | `/cart` empty — EmptyState with Browse CTA | clear cart (delete each row) |
| 9 | Theme toggle works on all three screens | click sun/moon in header |

For each check, mark pass/fail in your head; for anything failing, file a follow-up commit with `course: fix: <what>`.

- [ ] **Step 5: No commit** (verification task — no code change unless fixes needed)

---

## Done definition

- All 11 tasks above are checked off.
- All commits land on `m4-redesign`.
- Spec §6 acceptance criteria verified manually (Task 11).
- No regression in `FeatureListScreen.test.js` (4/4 still pass).
- `npm run build --prefix frontend` succeeds with no NEW warnings.

When done, propose options to the user:
- Open a PR for Phase 1 alone, or
- Continue to Phase 2 (Auth/Checkout) on the same branch.

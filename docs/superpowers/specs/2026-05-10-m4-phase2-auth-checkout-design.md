# M4 Phase 2 — Auth + Checkout (Login / Register / Profile / Shipping / Payment / PlaceOrder / Order)

> Status: design
> Owner: frontend
> Created: 2026-05-10
> Branch: `m4-redesign`
> Predecessors: `2026-05-10-m4-foundation-design.md` (Phase 0), `2026-05-10-m4-phase1-public-design.md` (Phase 1)
> Successors: Phase 3 (admin) — separate spec

---

## 1. Goal

Redesign the seven auth/checkout screens listed in `sitemap.md` (#4–#10) to
use the design system tokens, the Phase 0 atoms, and the AuthFormCard /
CheckoutStep / OrderSummary wireframes from Phase 0 spec §5.4–§5.6. After
Phase 2, an authenticated user sees a fully redesigned site for the
auth/checkout flow; only admin screens (#11–#15) remain in their legacy
look.

In scope:

- `screens/LoginScreen.js`
- `screens/RegisterScreen.js`
- `screens/ProfileScreen.js`
- `screens/ShippingScreen.js`
- `screens/PaymentScreen.js`
- `screens/PlaceOrderScreen.js`
- `screens/OrderScreen.js`
- `components/CheckoutSteps.js` (full visual rewrite — same external API)
- `components/FormContainer.js` (deleted — no remaining consumers after migration)
- `report.md` — tick-off rows #1–#10 in the M4 sitemap table (Phase 1 omitted this; we do it here once for both phases)

Out of scope (Phase 3):

- All admin screens (#11–#15)
- Backend, Redux store, action creators, route configuration
- PayPal SDK integration logic — only the surrounding card is restyled
- Skeleton loaders for the My Orders table (use existing Loader spinner; DataTable supports skeleton, but we keep parity with Phase 1 behaviour)

---

## 2. Decisions (recap from brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| FormContainer | Delete; replace with FormCard at every call site | FormCard has the same role + token-styled; FormContainer has 4 consumers (Login/Register/Shipping/Payment) — all migrate in this phase |
| CheckoutSteps | Full rewrite with horizontal stepper + connectors; same external API (`step1..step4` boolean flags) | Bootstrap Nav-as-stepper is visually weak; the wireframe spec (§5.5) calls for explicit step circles + connecting lines |
| ProfileScreen layout | Single-column: FormCard for profile-update on top, "My Orders" heading + full-width DataTable below | Two-column md=3+9 squeezes the form into ~250px on desktop, awkward on mobile (form stacks above 9-col table that becomes cramped). Single-column gives form proper max-width and table full width |
| OrderSummary CSS | Per-screen duplication (`PlaceOrderScreen.css` + `OrderScreen.css`) instead of shared file | ~80 lines of overlap is cheaper than a third file with unclear ownership; the two screens have small semantic differences (PayPal button only on Order, admin Mark-Delivered only on Order) and can drift independently if needed |
| Payment Stripe option | Keep commented out as today (matches `feature-flags` `stripe_alternative` flag state) | Out of scope to enable; spec preserves the `<!-- Stripe -->` comment block in PaymentScreen for future feature-flag work |

---

## 3. Architecture

### 3.1 File layout (new files)

```
frontend/src/
  screens/
    auth-form.css             # NEW — shared by LoginScreen + RegisterScreen (footer link only)
    ProfileScreen.css         # NEW
    PaymentScreen.css         # NEW
    PlaceOrderScreen.css      # NEW
    OrderScreen.css           # NEW
  components/
    CheckoutSteps.css         # NEW
```

(LoginScreen, RegisterScreen, ShippingScreen do not get their own CSS file — they only need the shared `auth-form.css` (Login/Register) or no CSS at all (Shipping). Token styling comes entirely from FormCard / FormField / Button atoms + CheckoutSteps.css.)

### 3.2 Modified files

```
frontend/src/
  screens/LoginScreen.js          # MODIFIED — FormCard, FormField, Button
  screens/RegisterScreen.js       # MODIFIED — FormCard, FormField, Button
  screens/ProfileScreen.js        # MODIFIED — single-column, FormCard + DataTable
  screens/ShippingScreen.js       # MODIFIED — CheckoutSteps, FormCard, FormField
  screens/PaymentScreen.js        # MODIFIED — CheckoutSteps, FormCard, restyled radio
  screens/PlaceOrderScreen.js     # MODIFIED — CheckoutSteps, OrderSummary template
  screens/OrderScreen.js          # MODIFIED — OrderSummary template, Badge for status
  components/CheckoutSteps.js     # MODIFIED — visual rewrite, same external API
report.md                          # MODIFIED — tick rows #1–#10 in sitemap table
```

### 3.3 Deleted files

```
frontend/src/components/FormContainer.js   # DELETED — no remaining consumers
```

### 3.4 Atom dependencies (Phase 0)

| Consumer | Atom used |
|---|---|
| LoginScreen | `ui/FormCard`, `ui/FormField`, `ui/Button` |
| RegisterScreen | `ui/FormCard`, `ui/FormField`, `ui/Button` |
| ProfileScreen | `ui/FormCard`, `ui/FormField`, `ui/Button`, `ui/DataTable`, `ui/Badge`, `EmptyState` |
| ShippingScreen | `ui/FormCard`, `ui/FormField`, `ui/Button` (+ `CheckoutSteps`) |
| PaymentScreen | `ui/FormCard`, `ui/Button` (+ `CheckoutSteps`) — radio group is plain `<input type='radio'>` styled via `PaymentScreen.css` |
| PlaceOrderScreen | `ui/Card`, `ui/Button` (+ `CheckoutSteps`) |
| OrderScreen | `ui/Card`, `ui/Button`, `ui/Badge` |

### 3.5 Five required states per screen

Implementation checklist (DESIGN.md §7 / SKILL.md appendix):

| Screen | Default | Empty | Loading | Error | Success |
|---|---|---|---|---|---|
| Login | form | n/a | inline `<Button loading>` spinner | `Message variant='danger'` | redirect to `?redirect=` (or `/`) |
| Register | form | n/a | inline `<Button loading>` spinner | `Message variant='danger'` (incl. passwords-mismatch) | redirect |
| Profile | form + orders table | `EmptyState` "No orders yet" when `orders.length === 0` | `Loader` for orders, `<Button loading>` for profile-update | `Message variant='danger'` | `Message variant='success'` "Profile Updated" |
| Shipping | CheckoutSteps + form | n/a | n/a (form is sync) | n/a (form is sync) | redirect to `/payment` |
| Payment | CheckoutSteps + radio | n/a | n/a | n/a | redirect to `/placeorder` |
| PlaceOrder | CheckoutSteps + 3 cards + summary | `Message` "Your cart is empty" if `cartItems.length === 0` | n/a (data already in store) | `Message variant='danger'` (createOrder error) | redirect to `/order/:id` |
| Order | 3 cards + sticky summary + paypal | `Message` "Order is empty" if `orderItems.length === 0` (defensive) | full-screen `Loader` | `Message variant='danger'` | inline `Message variant='success'` for paid/delivered + `Badge` updates |

---

## 4. Per-screen design

### 4.1 LoginScreen

Wireframe: Phase 0 §5.4 AuthFormCard.

Markup-level changes from current:

- Wrap entire return in `<FormCard title='Sign In'>...</FormCard>` (replaces `<FormContainer><h1>Sign In</h1>`).
- Replace each `<Form.Group controlId='X'><Form.Label>L</Form.Label><Form.Control type='Y' value={...} onChange={...} /></Form.Group>` with `<FormField id='X' label='L' type='Y' value={...} onChange={...} />`. Note: `value` and `onChange` are forwarded via `...rest` from FormField to the underlying `<input>`.
- Replace `<Button type='submit' variant='primary'>Sign In</Button>` with `<Button type='submit' variant='primary' loading={loading}>Sign In</Button>`. The Phase 0 Button atom natively supports `loading` (renders inline spinner + sets `aria-busy`).
- Drop the `{loading && <Loader />}` line — Button covers that state.
- Keep `{error && <Message variant='danger'>{error}</Message>}` above the form.
- Replace the bottom `<Row className='py-3'><Col>New Customer? <Link>Register</Link></Col></Row>` with a simpler `<p className='auth-form__footer'>New Customer? <Link to={...}>Register</Link></p>`.
- Import `./auth-form.css` (shared with RegisterScreen).

`frontend/src/screens/auth-form.css` (shared by both auth screens):

```css
.auth-form__footer {
  margin: var(--space-md) 0 0 0;
  font-size: 14px;
  color: var(--muted);
  text-align: center;
}
.auth-form__footer a {
  color: var(--primary);
  text-decoration: none;
}
.auth-form__footer a:hover { text-decoration: underline; }
```

(This is the only cross-screen pattern in Phase 2; sharing one file is cleaner than per-screen duplication for ~12 lines with crystal-clear ownership "auth screens". Unlike the OrderSummary case (~80 lines), per-screen duplication is justified by potential drift; here the footer is identical and unlikely to diverge.)

### 4.2 RegisterScreen

Same pattern as LoginScreen, with 4 fields (name + email + password + confirm) instead of 2.

- `<FormCard title='Sign Up'>` wrapper.
- 4 `<FormField>` blocks.
- Client-side validation: when `password !== confirmPassword`, set local `message` state and show `<Message variant='danger'>{message}</Message>` above the form. Existing logic preserved.
- Submit button: `<Button type='submit' variant='primary' loading={loading}>Register</Button>`.
- Footer: `<p className='auth-form__footer'>Have an Account? <Link>Login</Link></p>`.
- Import `./auth-form.css` (same shared file as Login).

No per-screen CSS file needed.

### 4.3 ProfileScreen

Single-column layout per §2 decision.

Structure:

```
[H1 "User Profile" — page title, full width]
[FormCard title='Account Info' max-width 480px centered]
  Name / Email / Password / Confirm Password fields
  [Update button — primary, loading state]
[H2 "My Orders" — full width below FormCard]
[<DataTable> — full width]
  columns: ID (mono), Date (mono), Total (mono right-aligned),
           Paid (Badge primary if paid + date / Badge danger NO),
           Delivered (Badge primary if delivered + date / Badge danger NO),
           Actions (Details Link → /order/:id, secondary button style)
  rows: orders
  loading: loadingOrders
  emptyState: <EmptyState heading='No orders yet' subtitle='Place your first order' />
```

If `errorOrders`, render `<Message variant='danger'>{errorOrders}</Message>` ABOVE the table (not inside DataTable, which has no error slot).

`ProfileScreen.css`:

```css
.profile-page { padding: var(--space-md) 0; }
.profile-page__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
  margin: 0 0 var(--space-md) 0; color: var(--foreground);
}
.profile-page__orders-heading {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px; font-weight: 600;
  margin: var(--space-2xl) 0 var(--space-md) 0; color: var(--foreground);
}
```

Profile-update form uses the same `loading={loading}` Button pattern as Login. Success state uses `<Message variant='success'>Profile Updated</Message>` (existing, restyled in Phase 1).

### 4.4 ShippingScreen

Wireframe: Phase 0 §5.5 CheckoutStep.

Structure:

```
[<CheckoutSteps step1 step2 />] (Sign In ✓, Shipping ●, Payment, Place Order)
[<FormCard title='Shipping'>]
  Address / City / Postal Code / Country (FormField, all required)
  [Continue button — primary]
[</FormCard>]
```

Markup-level changes:

- Replace `<FormContainer><CheckoutSteps step1 step2 /><h1>Shipping</h1>` with `<><CheckoutSteps step1 step2 /><FormCard title='Shipping'>` and close at the end.
- Each `<Form.Group>` → `<FormField required ...>`.
- Submit button: `<Button type='submit' variant='primary'>Continue</Button>`.

No per-screen CSS file needed (CheckoutSteps has its own; FormCard centers itself).

### 4.5 PaymentScreen

Wireframe: Phase 0 §5.5 CheckoutStep.

Structure:

```
[<CheckoutSteps step1 step2 step3 />]
[<FormCard title='Payment Method'>]
  <fieldset>
    <legend className='payment__legend'>Select Method</legend>
    <label className='payment__option'>
      <input type='radio' name='paymentMethod' value='PayPal' checked={...} onChange={...} />
      <span>PayPal or Credit Card</span>
    </label>
    {/* Stripe option preserved as comment per §2 decision */}
  </fieldset>
  [Continue button — primary]
```

Note: react-bootstrap `<Form.Check>` is replaced with plain `<input type='radio'>` + `<label>` for full control of styling. The `checked` attribute uses `paymentMethod === 'PayPal'` (current code uses `checked` without value, which is a bug — always-checked; we fix this).

`PaymentScreen.css`:

```css
.payment__legend {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 13px; font-weight: 600;
  color: var(--foreground); margin-bottom: var(--space-sm);
}
.payment__option {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-sm); margin-bottom: var(--space-xs);
  background: var(--card-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer; user-select: none;
}
.payment__option input[type='radio'] {
  accent-color: var(--primary);
  width: 16px; height: 16px;
}
.payment__option:hover {
  border-color: var(--primary);
}
```

### 4.6 PlaceOrderScreen

Wireframe: Phase 0 §5.6 OrderSummary.

Structure:

```
[<CheckoutSteps step1 step2 step3 step4 />]
[<div className='order-page'>]
  [<div className='order-page__main'>]   ← left column 1fr
    [<Card className='order-card'>]
      <h2>Shipping</h2>
      <p><strong>Address:</strong> {address}, {city} {postalCode}, {country}</p>
    [</Card>]
    [<Card className='order-card'>]
      <h2>Payment Method</h2>
      <p><strong>Method:</strong> {paymentMethod}</p>
    [</Card>]
    [<Card className='order-card'>]
      <h2>Order Items</h2>
      {cartItems.length === 0 ? <Message>Your cart is empty</Message> : (
        <ul className='order-items'>
          {cartItems.map((item) => (
            <li className='order-items__row' key={...}>
              <img className='order-items__image' />
              <Link to={...} className='order-items__name'>{name}</Link>
              <span className='order-items__calc'>{qty} × ${price} = ${qty*price}</span>
            </li>
          ))}
        </ul>
      )}
    [</Card>]
  [</div>]
  [<aside className='order-page__summary'>]   ← right column 320px sticky
    [<Card>]
      <h2>Order Summary</h2>
      <div className='order-summary__row'><span>Items</span><span>${itemsPrice}</span></div>
      <div className='order-summary__row'><span>Shipping</span><span>${shippingPrice}</span></div>
      <div className='order-summary__row'><span>Tax</span><span>${taxPrice}</span></div>
      <div className='order-summary__row order-summary__row--total'>
        <span>Total</span><span className='order-summary__total'>${totalPrice}</span>
      </div>
      {error && <Message variant='danger'>{error}</Message>}
      <Button variant='primary' className='order-summary__action'
              disabled={cartItems.length === 0} onClick={placeOrderHandler}>
        Place Order
      </Button>
    [</Card>]
  [</aside>]
[</div>]
```

`PlaceOrderScreen.css`:

```css
.order-page {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
  padding: var(--space-md) 0;
}
@media (min-width: 1024px) {
  .order-page { grid-template-columns: 1fr 320px; }
}

.order-page__main { display: flex; flex-direction: column; gap: var(--space-md); }

.order-page__summary { position: static; }
@media (min-width: 1024px) {
  .order-page__summary { position: sticky; top: var(--space-lg); align-self: start; }
}

.order-card h2 {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px; font-weight: 600;
  margin: 0 0 var(--space-sm) 0; color: var(--foreground);
}
.order-card p { color: var(--foreground); margin: 0; }

.order-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
.order-items__row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border);
}
.order-items__row:last-child { border-bottom: none; }
.order-items__image { width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); }
.order-items__name  { color: var(--foreground); text-decoration: none; }
.order-items__name:hover { color: var(--primary); }
.order-items__calc  {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--foreground);
}

.order-summary__row {
  display: flex; justify-content: space-between;
  padding: var(--space-xs) 0;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--foreground);
}
.order-summary__row--total { padding-top: var(--space-sm); border-top: 1px solid var(--border); }
.order-summary__total { color: var(--primary); font-size: 20px; }
.order-summary__action { width: 100%; margin-top: var(--space-md); }
```

### 4.7 OrderScreen

Wireframe: Phase 0 §5.6 OrderSummary. Same layout as PlaceOrderScreen with these additions:

- Top-level `<h1>Order {order._id}</h1>` (mono ID)
- Shipping card has Name + Email + Address (PlaceOrder doesn't show name/email)
- Each card includes a status indicator: Shipping → `<Badge variant={isDelivered ? 'primary' : 'danger'}>{isDelivered ? `Delivered ${deliveredAt}` : 'Not Delivered'}</Badge>`. Same for Payment.
- Order Summary card has 4 lines (Items/Shipping/Tax/Total) but the action area:
  - When `!isPaid`: show `<PayPalButton>` (or `<Loader>` if `!sdkReady`); preserve loadingPay overlay
  - When `userInfo.isAdmin && isPaid && !isDelivered`: show `<Button variant='primary'>Mark As Delivered</Button>` button + loadingDeliver overlay
  - Otherwise: nothing in the action area

`OrderScreen.css` — same rules as PlaceOrderScreen but copied (per §2 decision). The only addition:

```css
.order-page__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
  margin: 0 0 var(--space-md) 0; color: var(--foreground);
}
.order-page__title__id {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 20px; color: var(--muted);
}
.order-card__status { margin-top: var(--space-sm); }
```

---

## 5. CheckoutSteps redesign

External API unchanged: `<CheckoutSteps step1 step2 step3 step4 />`.

Each prop is a boolean. `true` = step is reachable (clickable Link), `false` = step is locked (rendered as `<span>` with `is-pending` state).

Visual: horizontal stepper with numbered circles + connecting lines.

State derivation:
- The HIGHEST-numbered `true` prop is the **active** step (current page).
- All `true` props BEFORE the active are **completed**.
- All `false` props are **pending**.

JSX (`CheckoutSteps.js`):

```js
import React from 'react'
import { Link } from 'react-router-dom'
import './CheckoutSteps.css'

const STEPS = [
  { num: 1, label: 'Sign In',     href: '/login' },
  { num: 2, label: 'Shipping',    href: '/shipping' },
  { num: 3, label: 'Payment',     href: '/payment' },
  { num: 4, label: 'Place Order', href: '/placeorder' },
]

const CheckoutSteps = ({ step1, step2, step3, step4 }) => {
  const enabled = [step1, step2, step3, step4]
  const activeIdx = enabled.lastIndexOf(true) // -1 if all false; safe

  return (
    <ol className='checkout-steps' aria-label='Checkout progress'>
      {STEPS.map((s, i) => {
        const isCompleted = enabled[i] && i < activeIdx
        const isActive    = i === activeIdx
        const isPending   = !enabled[i]
        const state = isCompleted ? 'is-completed' : isActive ? 'is-active' : 'is-pending'

        const numContent = isCompleted ? '✓' : s.num
        const stepInner = (
          <>
            <span className={`checkout-steps__num ${state}`} aria-hidden='true'>
              {numContent}
            </span>
            <span className={`checkout-steps__label ${state}`}>{s.label}</span>
          </>
        )

        return (
          <React.Fragment key={s.num}>
            <li className='checkout-steps__step'>
              {enabled[i] ? (
                <Link to={s.href} className='checkout-steps__link' aria-current={isActive ? 'step' : undefined}>
                  {stepInner}
                </Link>
              ) : (
                <span className='checkout-steps__link is-pending' aria-disabled='true'>
                  {stepInner}
                </span>
              )}
            </li>
            {i < STEPS.length - 1 && (
              <li className={`checkout-steps__connector ${enabled[i + 1] ? 'is-completed' : ''}`} aria-hidden='true' />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

export default CheckoutSteps
```

`CheckoutSteps.css`:

```css
.checkout-steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-2xl) 0;
}

.checkout-steps__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 96px;
}

.checkout-steps__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  text-decoration: none;
  color: inherit;
}
.checkout-steps__link:hover { text-decoration: none; }
.checkout-steps__link.is-pending { cursor: not-allowed; opacity: 0.6; }

.checkout-steps__num {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: var(--muted);
}
.checkout-steps__num.is-active {
  border-color: var(--primary);
  color: var(--primary);
}
.checkout-steps__num.is-completed {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-fg);
}

.checkout-steps__label {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.checkout-steps__label.is-active,
.checkout-steps__label.is-completed { color: var(--foreground); }

.checkout-steps__connector {
  flex: 1 0 24px;
  height: 1px;
  background: var(--border);
  margin: 19px 0 0 0;
  list-style: none;
}
.checkout-steps__connector.is-completed { background: var(--primary); }

@media (max-width: 640px) {
  .checkout-steps__step { min-width: 64px; }
  .checkout-steps__label { font-size: 11px; }
  .checkout-steps__connector { flex-basis: 12px; }
}
```

---

## 6. report.md tick-off

After implementation, update the M4 sitemap table in `report.md`:

```diff
- | 1  | Home / Search results      | ... | HomeScreen.js              | public    | [ ]               |
- | 2  | Product details            | ... | ProductScreen.js           | public    | [ ]               |
- | 3  | Cart                       | ... | CartScreen.js              | public    | [ ]               |
- | 4  | Login                      | ... | LoginScreen.js             | public    | [ ]               |
- | 5  | Register                   | ... | RegisterScreen.js          | public    | [ ]               |
- | 6  | Profile                    | ... | ProfileScreen.js           | auth      | [ ]               |
- | 7  | Shipping                   | ... | ShippingScreen.js          | auth      | [ ]               |
- | 8  | Payment                    | ... | PaymentScreen.js           | auth      | [ ]               |
- | 9  | Place Order                | ... | PlaceOrderScreen.js        | auth      | [ ]               |
- | 10 | Order details              | ... | OrderScreen.js             | auth      | [ ]               |
+ | 1  | Home / Search results      | ... | HomeScreen.js              | public    | [x]               |
+ | 2  | Product details            | ... | ProductScreen.js           | public    | [x]               |
+ | 3  | Cart                       | ... | CartScreen.js              | public    | [x]               |
+ | 4  | Login                      | ... | LoginScreen.js             | public    | [x]               |
+ | 5  | Register                   | ... | RegisterScreen.js          | public    | [x]               |
+ | 6  | Profile                    | ... | ProfileScreen.js           | auth      | [x]               |
+ | 7  | Shipping                   | ... | ShippingScreen.js          | auth      | [x]               |
+ | 8  | Payment                    | ... | PaymentScreen.js           | auth      | [x]               |
+ | 9  | Place Order                | ... | PlaceOrderScreen.js        | auth      | [x]               |
+ | 10 | Order details              | ... | OrderScreen.js             | auth      | [x]               |
```

(Phase 1 omitted this; we do it in one commit at the end of Phase 2.)

---

## 7. Acceptance criteria

Phase 2 is done when ALL of these hold (verified manually unless noted):

1. `/login` renders FormCard centered, two FormField inputs, primary Submit with loading spinner during dispatch, restyled error Message, "Register" link in footer that preserves `?redirect=` query.
2. `/register` renders FormCard with four FormFields, password-mismatch shows danger Message above form, primary Submit, "Login" link footer.
3. `/profile` (auth required) renders single-column: Page H1, FormCard with profile-update form, Update Button with loading state, Success Message after PUT; below: H2 "My Orders", DataTable with mono ID/date/total, Paid/Delivered Badges, Details Button-link per row. Empty: EmptyState. Error: danger Message above DataTable.
4. `/shipping` (auth required, cart non-empty path normally) renders CheckoutSteps with steps 1+2 active/completed, Sign In ✓, Shipping ●, Payment/PlaceOrder pending. Form is FormCard + 4 required FormFields. Continue submits to /payment.
5. `/payment` shows CheckoutSteps with 1+2 completed, 3 active. FormCard + radio group (single PayPal option visible, Stripe in source comment). Continue submits to /placeorder.
6. `/placeorder` shows CheckoutSteps with all 4 reachable, 4 active. 3 stacked Cards (Shipping summary, Payment Method, Order Items list with 48px images). Sticky right-rail Card with mono price rows, total = primary, Place Order button.
7. `/order/:id` (after placing an order) shows OrderSummary layout: title with mono order ID, 3 Cards (Shipping with status Badge, Payment with status Badge, Order Items list), sticky right-rail Card with mono price rows, PayPal button (when not paid) or Mark Delivered (admin only, paid+not delivered).
8. CheckoutSteps stepper: each step is a circle with number; completed steps show ✓ inside primary-filled circle; active step is primary-bordered transparent; pending steps are muted-bordered transparent. Connectors are 1px lines, primary between completed-or-active steps, border-color between pending. Active step has `aria-current='step'`. Pending steps are not clickable.
9. Theme toggle works on all 7 screens — every surface (FormCard, OrderSummary cards, stepper, DataTable rows, Badge tints) flips correctly.
10. `npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false` still passes.
11. `npm run build --prefix frontend` exits cleanly. The two pre-existing exhaustive-deps warnings in OrderScreen line 77 and (now possibly modified) ProductScreen line 44 are still allowed; any NEW warning in another screen must be fixed.
12. `git diff --stat <phase2-base>..HEAD` touches only the files in §3.1/§3.2/§3.3 + report.md. No accidental changes to admin screens or backend.
13. `frontend/src/components/FormContainer.js` no longer exists; `git grep "FormContainer"` returns no hits in JS.
14. `report.md` rows #1–#10 are marked `[x]` after the final commit.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `<FormField>` only renders `<input>` — Profile uses 4 password/email/text inputs (fine), but if any future field needs a textarea, FormField won't suffice. | All Phase 2 form fields are simple `<input>` types (email, text, password). Confirmed by spec §4.1–4.5. ProductScreen review form already established the pattern (hand-rolled select/textarea with `.product-page__qty` class) for any future textarea needs. |
| Removing FormContainer breaks unrelated screens. | grep'd: only Login/Register/Shipping/Payment import it. After all four migrate, file is unused. Confirmed in §3.3. |
| CheckoutSteps API change accidentally breaks something. | API is unchanged (`step1..step4` boolean flags). Only the rendered DOM changes. Verified by reading all 3 callers (Shipping/Payment/PlaceOrder). |
| Plain `<input type='radio'>` styling on PaymentScreen relies on `accent-color`, which has wide but not 100% support. | `accent-color` is supported in Chrome 93+, Firefox 92+, Safari 15.4+ — all within the project's "last 1 version" dev browserslist. Production browserslist is wider; any browser that doesn't support `accent-color` will render the OS-default radio (still functional, just not green-themed). Acceptable degradation. |
| The PaymentScreen `checked` bug fix (current code passes `checked` without value) might surprise users who relied on always-checked behaviour. | Today the radio is always checked because `checked` is a constant. Our fix uses `checked={paymentMethod === 'PayPal'}` — same outcome since there's only one radio option. No behaviour change. |
| `DataTable` does not have an error slot; ProfileScreen renders Message above the table. | Documented in §4.3. The pattern is consistent with HomeScreen which uses Message above the grid. |
| Per-screen duplication of OrderSummary CSS could drift over time. | Acceptable: the two screens have small semantic differences. If drift becomes problematic later, extract to shared `frontend/src/styles/order-summary.css` then. Not now. |
| `aria-current='step'` on CheckoutSteps requires the LinkContainer pattern to be replaced by a plain `<Link>`. | We do replace LinkContainer → `<Link>` in the rewrite (CheckoutSteps no longer needs react-router-bootstrap). |

---

## 9. Out of scope (explicit non-goals)

- Bottom-sheet / sticky checkout actions on mobile
- Inline address validation (postal code format etc.)
- Stripe payment option (commented placeholder preserved for feature-flag work)
- Skeleton loader for "My Orders" table (use existing Loader spinner; matches Phase 1 behaviour for HomeScreen)
- Mobile-specific stepper variants (vertical / numeric-only)
- Order details "reorder" action
- Admin order detail features beyond the existing Mark Delivered button
- Replacing `react-bootstrap` `<Form.Check>` library-wide — Payment uses raw input, but other screens that may render checkboxes elsewhere keep Form.Check
- Updating `report.md` until the final implementation commit (single tick-off commit at the end of the phase, not per-screen)

---

## 10. Open questions

None. All brainstorm decisions are recorded in §2; implementation choices inside that scope are spec'd in §4 and §5.

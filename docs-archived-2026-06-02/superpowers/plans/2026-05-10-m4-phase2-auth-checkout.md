# M4 Phase 2 — Auth + Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign 7 auth/checkout screens (Login, Register, Profile, Shipping, Payment, PlaceOrder, Order) to use design tokens, Phase 0 atoms (FormCard, FormField, Button, Card, Badge, DataTable), and the AuthFormCard / CheckoutStep / OrderSummary wireframes from Phase 0 spec §5.4–§5.6.

**Architecture:** CheckoutSteps gets a full visual rewrite (custom stepper with circles + connectors) but keeps its `step1..step4` boolean API. FormContainer is deleted; all four call sites migrate to FormCard. ProfileScreen restructures into single-column (FormCard on top + DataTable below). PlaceOrder/Order use the OrderSummary template with a 2-column grid + sticky right-rail summary.

**Tech Stack:** React 16.13 + classic Redux + react-bootstrap 1.3 (Carousel, Spinner, Alert, raw Form/Button stays); Phase 0 atoms + tokens. FontAwesome icons via existing CDN. Pure CSS — no SCSS.

**Spec:** `docs/superpowers/specs/2026-05-10-m4-phase2-auth-checkout-design.md`

**Notes for the engineer:**
- The project pins old versions on purpose. Do not migrate to react-router v6 / Redux Toolkit / React 17+.
- All components are JS, no TypeScript. No tests are required for Phase 2.
- Commit format from `CLAUDE.md`: `course: <type>: <summary>`. Do NOT add `Co-Authored-By:` trailer.
- Order matters: CheckoutSteps (Task 1) must land before Shipping/Payment/PlaceOrder, since those import it; auth-form.css (Task 2) must land before Login/Register; FormContainer.js deletion (Task 10) only after all 4 consumers migrate.

---

## File map

**New files**
- `frontend/src/components/CheckoutSteps.css`
- `frontend/src/screens/auth-form.css`
- `frontend/src/screens/ProfileScreen.css`
- `frontend/src/screens/PaymentScreen.css`
- `frontend/src/screens/PlaceOrderScreen.css`
- `frontend/src/screens/OrderScreen.css`

**Modified files**
- `frontend/src/components/CheckoutSteps.js` — visual rewrite, same API
- `frontend/src/screens/LoginScreen.js`
- `frontend/src/screens/RegisterScreen.js`
- `frontend/src/screens/ProfileScreen.js`
- `frontend/src/screens/ShippingScreen.js`
- `frontend/src/screens/PaymentScreen.js`
- `frontend/src/screens/PlaceOrderScreen.js`
- `frontend/src/screens/OrderScreen.js`
- `report.md` — tick rows #1–#10 in M4 sitemap table

**Deleted files**
- `frontend/src/components/FormContainer.js` — no remaining consumers after migration

---

## Task 1: Rewrite `CheckoutSteps`

**Files:**
- Modify: `frontend/src/components/CheckoutSteps.js`
- Create: `frontend/src/components/CheckoutSteps.css`

External API unchanged: `<CheckoutSteps step1 step2 step3 step4 />`. Each prop is a boolean: `true` = reachable (active or completed), `false` = pending. The highest-numbered `true` is "active"; earlier `true`s are "completed"; `false`s are "pending".

- [ ] **Step 1: Create `CheckoutSteps.css`** (verbatim)

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

- [ ] **Step 2: Replace `CheckoutSteps.js`** (verbatim)

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
  const activeIdx = enabled.lastIndexOf(true)

  return (
    <ol className='checkout-steps' aria-label='Checkout progress'>
      {STEPS.map((s, i) => {
        const isCompleted = enabled[i] && i < activeIdx
        const isActive    = i === activeIdx
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
                <Link
                  to={s.href}
                  className='checkout-steps__link'
                  aria-current={isActive ? 'step' : undefined}
                >
                  {stepInner}
                </Link>
              ) : (
                <span className='checkout-steps__link is-pending' aria-disabled='true'>
                  {stepInner}
                </span>
              )}
            </li>
            {i < STEPS.length - 1 && (
              <li
                className={`checkout-steps__connector ${enabled[i + 1] ? 'is-completed' : ''}`}
                aria-hidden='true'
              />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

export default CheckoutSteps
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/CheckoutSteps.js frontend/src/components/CheckoutSteps.css
git commit -m "course: refactor: redesign CheckoutSteps as token-driven stepper"
```

---

## Task 2: Create shared `auth-form.css`

**Files:**
- Create: `frontend/src/screens/auth-form.css`

- [ ] **Step 1: Create the file** (verbatim)

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

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/auth-form.css
git commit -m "course: feat: add shared auth-form footer link styles"
```

---

## Task 3: Refactor `LoginScreen`

**Files:**
- Modify: `frontend/src/screens/LoginScreen.js`

- [ ] **Step 1: Replace `LoginScreen.js`** (verbatim)

```js
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import { login } from '../actions/userActions'
import './auth-form.css'

const LoginScreen = ({ location, history }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const dispatch = useDispatch()

  const userLogin = useSelector((state) => state.userLogin)
  const { loading, error, userInfo } = userLogin

  const redirect = location.search ? location.search.split('=')[1] : '/'

  useEffect(() => {
    if (userInfo) {
      history.push(redirect)
    }
  }, [history, userInfo, redirect])

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(login(email, password))
  }

  return (
    <FormCard title='Sign In'>
      {error && <Message variant='danger'>{error}</Message>}
      <form onSubmit={submitHandler}>
        <FormField
          id='email'
          label='Email Address'
          type='email'
          placeholder='Enter email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          id='password'
          label='Password'
          type='password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type='submit' variant='primary' loading={loading}>
          Sign In
        </Button>
      </form>

      <p className='auth-form__footer'>
        New Customer?{' '}
        <Link to={redirect ? `/register?redirect=${redirect}` : '/register'}>
          Register
        </Link>
      </p>
    </FormCard>
  )
}

export default LoginScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/LoginScreen.js
git commit -m "course: feat: redesign LoginScreen with FormCard atoms"
```

---

## Task 4: Refactor `RegisterScreen`

**Files:**
- Modify: `frontend/src/screens/RegisterScreen.js`

- [ ] **Step 1: Replace `RegisterScreen.js`** (verbatim)

```js
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import { register } from '../actions/userActions'
import './auth-form.css'

const RegisterScreen = ({ location, history }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)

  const dispatch = useDispatch()

  const userRegister = useSelector((state) => state.userRegister)
  const { loading, error, userInfo } = userRegister

  const redirect = location.search ? location.search.split('=')[1] : '/'

  useEffect(() => {
    if (userInfo) {
      history.push(redirect)
    }
  }, [history, userInfo, redirect])

  const submitHandler = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
    } else {
      setMessage(null)
      dispatch(register(name, email, password))
    }
  }

  return (
    <FormCard title='Sign Up'>
      {message && <Message variant='danger'>{message}</Message>}
      {error && <Message variant='danger'>{error}</Message>}
      <form onSubmit={submitHandler}>
        <FormField
          id='name'
          label='Name'
          type='text'
          placeholder='Enter name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormField
          id='email'
          label='Email Address'
          type='email'
          placeholder='Enter email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          id='password'
          label='Password'
          type='password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormField
          id='confirmPassword'
          label='Confirm Password'
          type='password'
          placeholder='Confirm password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type='submit' variant='primary' loading={loading}>
          Register
        </Button>
      </form>

      <p className='auth-form__footer'>
        Have an Account?{' '}
        <Link to={redirect ? `/login?redirect=${redirect}` : '/login'}>
          Login
        </Link>
      </p>
    </FormCard>
  )
}

export default RegisterScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/RegisterScreen.js
git commit -m "course: feat: redesign RegisterScreen with FormCard atoms"
```

---

## Task 5: Refactor `ShippingScreen`

**Files:**
- Modify: `frontend/src/screens/ShippingScreen.js`

- [ ] **Step 1: Replace `ShippingScreen.js`** (verbatim)

```js
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import CheckoutSteps from '../components/CheckoutSteps'
import { saveShippingAddress } from '../actions/cartActions'

const ShippingScreen = ({ history }) => {
  const cart = useSelector((state) => state.cart)
  const { shippingAddress } = cart

  const [address, setAddress] = useState(shippingAddress.address || '')
  const [city, setCity] = useState(shippingAddress.city || '')
  const [postalCode, setPostalCode] = useState(shippingAddress.postalCode || '')
  const [country, setCountry] = useState(shippingAddress.country || '')

  const dispatch = useDispatch()

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(saveShippingAddress({ address, city, postalCode, country }))
    history.push('/payment')
  }

  return (
    <>
      <CheckoutSteps step1 step2 />
      <FormCard title='Shipping'>
        <form onSubmit={submitHandler}>
          <FormField
            id='address'
            label='Address'
            type='text'
            placeholder='Enter address'
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <FormField
            id='city'
            label='City'
            type='text'
            placeholder='Enter city'
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <FormField
            id='postalCode'
            label='Postal Code'
            type='text'
            placeholder='Enter postal code'
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            required
          />
          <FormField
            id='country'
            label='Country'
            type='text'
            placeholder='Enter country'
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          />
          <Button type='submit' variant='primary'>
            Continue
          </Button>
        </form>
      </FormCard>
    </>
  )
}

export default ShippingScreen
```

Note: Original used `shippingAddress.address` directly which throws if `shippingAddress` is undefined on first visit. We add `|| ''` defaults so the form initializes cleanly.

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/ShippingScreen.js
git commit -m "course: feat: redesign ShippingScreen with CheckoutSteps and FormCard"
```

---

## Task 6: Refactor `PaymentScreen`

**Files:**
- Modify: `frontend/src/screens/PaymentScreen.js`
- Create: `frontend/src/screens/PaymentScreen.css`

- [ ] **Step 1: Create `PaymentScreen.css`** (verbatim)

```css
.payment__legend {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: var(--space-sm);
  padding: 0;
  border: none;
}

.payment__fieldset {
  border: none;
  padding: 0;
  margin: 0 0 var(--space-md) 0;
}

.payment__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-xs);
  background: var(--card-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  user-select: none;
  color: var(--foreground);
}

.payment__option input[type='radio'] {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
  margin: 0;
}

.payment__option:hover {
  border-color: var(--primary);
}
```

- [ ] **Step 2: Replace `PaymentScreen.js`** (verbatim)

```js
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import FormCard from '../components/ui/FormCard'
import Button from '../components/ui/Button'
import CheckoutSteps from '../components/CheckoutSteps'
import { savePaymentMethod } from '../actions/cartActions'
import './PaymentScreen.css'

const PaymentScreen = ({ history }) => {
  const cart = useSelector((state) => state.cart)
  const { shippingAddress } = cart

  if (!shippingAddress.address) {
    history.push('/shipping')
  }

  const [paymentMethod, setPaymentMethod] = useState('PayPal')

  const dispatch = useDispatch()

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(savePaymentMethod(paymentMethod))
    history.push('/placeorder')
  }

  return (
    <>
      <CheckoutSteps step1 step2 step3 />
      <FormCard title='Payment Method'>
        <form onSubmit={submitHandler}>
          <fieldset className='payment__fieldset'>
            <legend className='payment__legend'>Select Method</legend>
            <label className='payment__option'>
              <input
                type='radio'
                id='PayPal'
                name='paymentMethod'
                value='PayPal'
                checked={paymentMethod === 'PayPal'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>PayPal or Credit Card</span>
            </label>
            {/* <label className='payment__option'>
              <input
                type='radio'
                id='Stripe'
                name='paymentMethod'
                value='Stripe'
                checked={paymentMethod === 'Stripe'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>Stripe</span>
            </label> */}
          </fieldset>
          <Button type='submit' variant='primary'>
            Continue
          </Button>
        </form>
      </FormCard>
    </>
  )
}

export default PaymentScreen
```

Note: The `checked={paymentMethod === 'PayPal'}` fix replaces the original `checked` (always-true bug). With one radio option this has no behaviour change today, but is correct for when Stripe is uncommented.

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/PaymentScreen.js frontend/src/screens/PaymentScreen.css
git commit -m "course: feat: redesign PaymentScreen with FormCard and styled radio"
```

---

## Task 7: Refactor `PlaceOrderScreen`

**Files:**
- Modify: `frontend/src/screens/PlaceOrderScreen.js`
- Create: `frontend/src/screens/PlaceOrderScreen.css`

- [ ] **Step 1: Create `PlaceOrderScreen.css`** (verbatim)

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

.order-page__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.order-page__summary { position: static; }

@media (min-width: 1024px) {
  .order-page__summary { position: sticky; top: var(--space-lg); align-self: start; }
}

.order-card h2 {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  color: var(--foreground);
}

.order-card p { color: var(--foreground); margin: 0; }

.order-items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.order-items__row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border);
}

.order-items__row:last-child { border-bottom: none; }

.order-items__image {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.order-items__name { color: var(--foreground); text-decoration: none; }
.order-items__name:hover { color: var(--primary); }

.order-items__calc {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--foreground);
}

.order-summary__row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--foreground);
}

.order-summary__row--total {
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.order-summary__total { color: var(--primary); font-size: 20px; }

.order-summary__action { width: 100%; margin-top: var(--space-md); }

.order-summary__heading {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  color: var(--foreground);
}
```

- [ ] **Step 2: Replace `PlaceOrderScreen.js`** (verbatim)

```js
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import CheckoutSteps from '../components/CheckoutSteps'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { createOrder } from '../actions/orderActions'
import { ORDER_CREATE_RESET } from '../constants/orderConstants'
import { USER_DETAILS_RESET } from '../constants/userConstants'
import './PlaceOrderScreen.css'

const PlaceOrderScreen = ({ history }) => {
  const dispatch = useDispatch()

  const cart = useSelector((state) => state.cart)

  if (!cart.shippingAddress.address) {
    history.push('/shipping')
  } else if (!cart.paymentMethod) {
    history.push('/payment')
  }

  const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2)

  cart.itemsPrice = addDecimals(
    cart.cartItems.reduce((acc, item) => acc + item.price * item.qty, 0)
  )
  cart.shippingPrice = addDecimals(cart.itemsPrice > 100 ? 0 : 100)
  cart.taxPrice = addDecimals(Number((0.15 * cart.itemsPrice).toFixed(2)))
  cart.totalPrice = (
    Number(cart.itemsPrice) +
    Number(cart.shippingPrice) +
    Number(cart.taxPrice)
  ).toFixed(2)

  const orderCreate = useSelector((state) => state.orderCreate)
  const { order, success, error } = orderCreate

  useEffect(() => {
    if (success) {
      history.push(`/order/${order._id}`)
      dispatch({ type: USER_DETAILS_RESET })
      dispatch({ type: ORDER_CREATE_RESET })
    }
    // eslint-disable-next-line
  }, [history, success])

  const placeOrderHandler = () => {
    dispatch(
      createOrder({
        orderItems: cart.cartItems,
        shippingAddress: cart.shippingAddress,
        paymentMethod: cart.paymentMethod,
        itemsPrice: cart.itemsPrice,
        shippingPrice: cart.shippingPrice,
        taxPrice: cart.taxPrice,
        totalPrice: cart.totalPrice,
      })
    )
  }

  return (
    <>
      <CheckoutSteps step1 step2 step3 step4 />
      <div className='order-page'>
        <div className='order-page__main'>
          <Card className='order-card'>
            <h2>Shipping</h2>
            <p>
              <strong>Address: </strong>
              {cart.shippingAddress.address}, {cart.shippingAddress.city}{' '}
              {cart.shippingAddress.postalCode}, {cart.shippingAddress.country}
            </p>
          </Card>

          <Card className='order-card'>
            <h2>Payment Method</h2>
            <p>
              <strong>Method: </strong>
              {cart.paymentMethod}
            </p>
          </Card>

          <Card className='order-card'>
            <h2>Order Items</h2>
            {cart.cartItems.length === 0 ? (
              <Message>Your cart is empty</Message>
            ) : (
              <ul className='order-items'>
                {cart.cartItems.map((item, index) => (
                  <li className='order-items__row' key={index}>
                    <img
                      src={item.image}
                      alt={item.name}
                      className='order-items__image'
                    />
                    <Link to={`/product/${item.product}`} className='order-items__name'>
                      {item.name}
                    </Link>
                    <span className='order-items__calc'>
                      {item.qty} × ${item.price} = ${(item.qty * item.price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card as='aside' className='order-page__summary'>
          <h2 className='order-summary__heading'>Order Summary</h2>
          <div className='order-summary__row'>
            <span>Items</span><span>${cart.itemsPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Shipping</span><span>${cart.shippingPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Tax</span><span>${cart.taxPrice}</span>
          </div>
          <div className='order-summary__row order-summary__row--total'>
            <span>Total</span>
            <span className='order-summary__total'>${cart.totalPrice}</span>
          </div>
          {error && <Message variant='danger'>{error}</Message>}
          <Button
            variant='primary'
            disabled={cart.cartItems.length === 0}
            onClick={placeOrderHandler}
            className='order-summary__action'
          >
            Place Order
          </Button>
        </Card>
      </div>
    </>
  )
}

export default PlaceOrderScreen
```

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/PlaceOrderScreen.js frontend/src/screens/PlaceOrderScreen.css
git commit -m "course: feat: redesign PlaceOrderScreen with OrderSummary template"
```

---

## Task 8: Refactor `OrderScreen`

**Files:**
- Modify: `frontend/src/screens/OrderScreen.js`
- Create: `frontend/src/screens/OrderScreen.css`

- [ ] **Step 1: Create `OrderScreen.css`** (verbatim — duplicates PlaceOrderScreen.css with title additions)

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

.order-page__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-md) 0;
  color: var(--foreground);
}

.order-page__title__id {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 20px;
  color: var(--muted);
  margin-left: var(--space-xs);
}

.order-page__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.order-page__summary { position: static; }

@media (min-width: 1024px) {
  .order-page__summary { position: sticky; top: var(--space-lg); align-self: start; }
}

.order-card h2 {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  color: var(--foreground);
}

.order-card p { color: var(--foreground); margin: 0 0 var(--space-xs) 0; }

.order-card__status { margin-top: var(--space-sm); }

.order-items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.order-items__row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border);
}

.order-items__row:last-child { border-bottom: none; }

.order-items__image {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.order-items__name { color: var(--foreground); text-decoration: none; }
.order-items__name:hover { color: var(--primary); }

.order-items__calc {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--foreground);
}

.order-summary__row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
  color: var(--foreground);
}

.order-summary__row--total {
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.order-summary__total { color: var(--primary); font-size: 20px; }

.order-summary__action { width: 100%; margin-top: var(--space-md); }

.order-summary__heading {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  color: var(--foreground);
}
```

- [ ] **Step 2: Replace `OrderScreen.js`** (verbatim)

```js
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { PayPalButton } from 'react-paypal-button-v2'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  getOrderDetails,
  payOrder,
  deliverOrder,
} from '../actions/orderActions'
import {
  ORDER_PAY_RESET,
  ORDER_DELIVER_RESET,
} from '../constants/orderConstants'
import './OrderScreen.css'

const OrderScreen = ({ match, history }) => {
  const orderId = match.params.id

  const [sdkReady, setSdkReady] = useState(false)

  const dispatch = useDispatch()

  const orderDetails = useSelector((state) => state.orderDetails)
  const { order, loading, error } = orderDetails

  const orderPay = useSelector((state) => state.orderPay)
  const { loading: loadingPay, success: successPay } = orderPay

  const orderDeliver = useSelector((state) => state.orderDeliver)
  const { loading: loadingDeliver, success: successDeliver } = orderDeliver

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  if (!loading) {
    const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2)
    order.itemsPrice = addDecimals(
      order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0)
    )
  }

  useEffect(() => {
    if (!userInfo) {
      history.push('/login')
    }

    const addPayPalScript = async () => {
      const { data: clientId } = await axios.get('/api/config/paypal')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`
      script.async = true
      script.onload = () => {
        setSdkReady(true)
      }
      document.body.appendChild(script)
    }

    if (!order || successPay || successDeliver || order._id !== orderId) {
      dispatch({ type: ORDER_PAY_RESET })
      dispatch({ type: ORDER_DELIVER_RESET })
      dispatch(getOrderDetails(orderId))
    } else if (!order.isPaid) {
      if (!window.paypal) {
        addPayPalScript()
      } else {
        setSdkReady(true)
      }
    }
  }, [dispatch, orderId, successPay, successDeliver, order])

  const successPaymentHandler = (paymentResult) => {
    dispatch(payOrder(orderId, paymentResult))
  }

  const deliverHandler = () => {
    dispatch(deliverOrder(order))
  }

  if (loading) return <Loader />
  if (error) return <Message variant='danger'>{error}</Message>

  return (
    <>
      <h1 className='order-page__title'>
        Order
        <span className='order-page__title__id'>{order._id}</span>
      </h1>

      <div className='order-page'>
        <div className='order-page__main'>
          <Card className='order-card'>
            <h2>Shipping</h2>
            <p><strong>Name: </strong> {order.user.name}</p>
            <p>
              <strong>Email: </strong>
              <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
            </p>
            <p>
              <strong>Address: </strong>
              {order.shippingAddress.address}, {order.shippingAddress.city}{' '}
              {order.shippingAddress.postalCode}, {order.shippingAddress.country}
            </p>
            <div className='order-card__status'>
              {order.isDelivered ? (
                <Badge variant='primary'>Delivered {order.deliveredAt.substring(0, 10)}</Badge>
              ) : (
                <Badge variant='danger'>Not Delivered</Badge>
              )}
            </div>
          </Card>

          <Card className='order-card'>
            <h2>Payment Method</h2>
            <p><strong>Method: </strong>{order.paymentMethod}</p>
            <div className='order-card__status'>
              {order.isPaid ? (
                <Badge variant='primary'>Paid {order.paidAt.substring(0, 10)}</Badge>
              ) : (
                <Badge variant='danger'>Not Paid</Badge>
              )}
            </div>
          </Card>

          <Card className='order-card'>
            <h2>Order Items</h2>
            {order.orderItems.length === 0 ? (
              <Message>Order is empty</Message>
            ) : (
              <ul className='order-items'>
                {order.orderItems.map((item, index) => (
                  <li className='order-items__row' key={index}>
                    <img
                      src={item.image}
                      alt={item.name}
                      className='order-items__image'
                    />
                    <Link to={`/product/${item.product}`} className='order-items__name'>
                      {item.name}
                    </Link>
                    <span className='order-items__calc'>
                      {item.qty} × ${item.price} = ${(item.qty * item.price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card as='aside' className='order-page__summary'>
          <h2 className='order-summary__heading'>Order Summary</h2>
          <div className='order-summary__row'>
            <span>Items</span><span>${order.itemsPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Shipping</span><span>${order.shippingPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Tax</span><span>${order.taxPrice}</span>
          </div>
          <div className='order-summary__row order-summary__row--total'>
            <span>Total</span>
            <span className='order-summary__total'>${order.totalPrice}</span>
          </div>

          {!order.isPaid && (
            <div className='order-summary__action'>
              {loadingPay && <Loader />}
              {!sdkReady ? (
                <Loader />
              ) : (
                <PayPalButton
                  amount={order.totalPrice}
                  onSuccess={successPaymentHandler}
                />
              )}
            </div>
          )}

          {loadingDeliver && <Loader />}
          {userInfo &&
            userInfo.isAdmin &&
            order.isPaid &&
            !order.isDelivered && (
              <Button
                variant='primary'
                onClick={deliverHandler}
                className='order-summary__action'
              >
                Mark As Delivered
              </Button>
            )}
        </Card>
      </div>
    </>
  )
}

export default OrderScreen
```

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/OrderScreen.js frontend/src/screens/OrderScreen.css
git commit -m "course: feat: redesign OrderScreen with OrderSummary template and Badges"
```

---

## Task 9: Refactor `ProfileScreen`

**Files:**
- Modify: `frontend/src/screens/ProfileScreen.js`
- Create: `frontend/src/screens/ProfileScreen.css`

- [ ] **Step 1: Create `ProfileScreen.css`** (verbatim)

```css
.profile-page { padding: var(--space-md) 0; }

.profile-page__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-md) 0;
  color: var(--foreground);
}

.profile-page__orders-heading {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: var(--space-2xl) 0 var(--space-md) 0;
  color: var(--foreground);
}
```

- [ ] **Step 2: Replace `ProfileScreen.js`** (verbatim)

```js
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import { getUserDetails, updateUserProfile } from '../actions/userActions'
import { listMyOrders } from '../actions/orderActions'
import { USER_UPDATE_PROFILE_RESET } from '../constants/userConstants'
import './ProfileScreen.css'

const ProfileScreen = ({ history }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)

  const dispatch = useDispatch()

  const userDetails = useSelector((state) => state.userDetails)
  const { loading, error, user } = userDetails

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const userUpdateProfile = useSelector((state) => state.userUpdateProfile)
  const { success } = userUpdateProfile

  const orderListMy = useSelector((state) => state.orderListMy)
  const { loading: loadingOrders, error: errorOrders, orders } = orderListMy

  useEffect(() => {
    if (!userInfo) {
      history.push('/login')
    } else {
      if (!user || !user.name || success) {
        dispatch({ type: USER_UPDATE_PROFILE_RESET })
        dispatch(getUserDetails('profile'))
        dispatch(listMyOrders())
      } else {
        setName(user.name)
        setEmail(user.email)
      }
    }
  }, [dispatch, history, userInfo, user, success])

  const submitHandler = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
    } else {
      setMessage(null)
      dispatch(updateUserProfile({ id: user._id, name, email, password }))
    }
  }

  const orderColumns = [
    { key: 'id',         header: 'ID',        mono: true,
      render: (o) => o._id },
    { key: 'createdAt',  header: 'Date',      mono: true,
      render: (o) => o.createdAt.substring(0, 10) },
    { key: 'totalPrice', header: 'Total',     mono: true, align: 'right',
      render: (o) => `$${o.totalPrice}` },
    { key: 'isPaid',     header: 'Paid',      align: 'center',
      render: (o) => o.isPaid
        ? <Badge variant='primary'>{o.paidAt.substring(0, 10)}</Badge>
        : <Badge variant='danger'>NO</Badge> },
    { key: 'isDelivered', header: 'Delivered', align: 'center',
      render: (o) => o.isDelivered
        ? <Badge variant='primary'>{o.deliveredAt.substring(0, 10)}</Badge>
        : <Badge variant='danger'>NO</Badge> },
    { key: 'actions',    header: '',          align: 'right',
      render: (o) => (
        <Link to={`/order/${o._id}`} className='ui-btn ui-btn--secondary ui-btn--sm'>
          Details
        </Link>
      ) },
  ]

  return (
    <div className='profile-page'>
      <h1 className='profile-page__title'>User Profile</h1>

      {message && <Message variant='danger'>{message}</Message>}
      {success && <Message variant='success'>Profile Updated</Message>}

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <FormCard title='Account Info'>
          <form onSubmit={submitHandler}>
            <FormField
              id='name'
              label='Name'
              type='text'
              placeholder='Enter name'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormField
              id='email'
              label='Email Address'
              type='email'
              placeholder='Enter email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormField
              id='password'
              label='Password'
              type='password'
              placeholder='Enter password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormField
              id='confirmPassword'
              label='Confirm Password'
              type='password'
              placeholder='Confirm password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type='submit' variant='primary'>
              Update
            </Button>
          </form>
        </FormCard>
      )}

      <h2 className='profile-page__orders-heading'>My Orders</h2>
      {errorOrders && <Message variant='danger'>{errorOrders}</Message>}
      <DataTable
        columns={orderColumns}
        rows={orders || []}
        rowKey='_id'
        loading={loadingOrders}
        emptyState={
          <EmptyState
            heading='No orders yet'
            subtitle='Place your first order'
          />
        }
      />
    </div>
  )
}

export default ProfileScreen
```

- [ ] **Step 3: Commit**

```
git add frontend/src/screens/ProfileScreen.js frontend/src/screens/ProfileScreen.css
git commit -m "course: feat: redesign ProfileScreen single-column with FormCard and DataTable"
```

---

## Task 10: Delete `FormContainer.js`

**Files:**
- Delete: `frontend/src/components/FormContainer.js`

By this point, all four consumers (Login, Register, Shipping, Payment) no longer import FormContainer.

- [ ] **Step 1: Verify no remaining consumers**

```
grep -r "FormContainer" frontend/src
```

Expected: empty output. If there's a hit, fix that consumer first before proceeding.

- [ ] **Step 2: Delete the file**

```
git rm frontend/src/components/FormContainer.js
```

- [ ] **Step 3: Commit**

```
git commit -m "course: chore: drop unused FormContainer component"
```

---

## Task 11: Tick off rows #1–#10 in `report.md`

**Files:**
- Modify: `report.md`

- [ ] **Step 1: Update the M4 sitemap table**

In `report.md`, find the M4 sitemap table. For each of rows 1 through 10, change the rightmost cell from `[ ]` to `[x]`. Row 16 already shows `[x] обязательно` and rows 11–15 stay `[ ]` (Phase 3 work).

Use Edit tool to make 10 individual edits (one per row), or one careful Edit if the rows are contiguous.

The exact target rows (by `#` column):
- Row 1 (Home / Search results) → `[x]`
- Row 2 (Product details) → `[x]`
- Row 3 (Cart) → `[x]`
- Row 4 (Login) → `[x]`
- Row 5 (Register) → `[x]`
- Row 6 (Profile) → `[x]`
- Row 7 (Shipping) → `[x]`
- Row 8 (Payment) → `[x]`
- Row 9 (Place Order) → `[x]`
- Row 10 (Order details) → `[x]`

- [ ] **Step 2: Commit**

```
git add report.md
git commit -m "course: docs: tick off public and auth screens in M4 sitemap"
```

---

## Task 12: Acceptance verification

This task runs spec §7 acceptance criteria. No new code unless a fix is needed.

- [ ] **Step 1: Existing test still passes**

```
npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false
```

Expected: PASS (4 tests).

- [ ] **Step 2: Build is clean**

```
npm run build --prefix frontend
```

Expected: "Compiled with warnings". The two pre-existing exhaustive-deps warnings (ProductScreen line 44 area, OrderScreen line 77 area — note the OrderScreen useEffect is now in the same place because we kept the eslint-disable inline) are still allowed; any NEW warning must be fixed.

- [ ] **Step 3: Diff scope check**

```
git diff --stat 0a7a92c..HEAD
```

Expected: only the files in plan §3 (file map) are touched. No accidental edits to admin screens (UserListScreen, UserEditScreen, ProductListScreen, ProductEditScreen, OrderListScreen, FeatureListScreen). The `FormContainer.js` deletion shows as a removal in the stat output.

- [ ] **Step 4: `git grep "FormContainer"` returns no JS hits**

```
git grep "FormContainer" -- '*.js'
```

Expected: empty. If `FormContainer` appears in spec/plan markdown files, that's fine (those are docs).

- [ ] **Step 5: Manual browser smoke**

Open the dev server. Walk through each screen, then verify spec §7 acceptance criteria 1–9. Specifically check:

| Check | Where | What to verify |
|---|---|---|
| #1 Login | `/login` | FormCard + 2 FormField + primary submit (with spinner during dispatch) + Register link footer with `?redirect=` preserved |
| #2 Register | `/register` | FormCard + 4 FormField + danger Message on password mismatch + primary submit + Login link footer |
| #3 Profile | `/profile` (logged-in) | Single-column: H1, FormCard, primary Update; below: H2 "My Orders", DataTable with mono ID/date/total + paid/delivered Badges + Details Link. Empty: EmptyState. Error: danger Message |
| #4 Shipping | `/shipping` (logged-in) | CheckoutSteps shows Sign In ✓, Shipping ●, Payment+PlaceOrder pending. FormCard + 4 required FormFields. Continue → /payment |
| #5 Payment | `/payment` | CheckoutSteps shows 1+2 ✓, 3 ●. FormCard + radio with PayPal selected. Continue → /placeorder |
| #6 PlaceOrder | `/placeorder` | CheckoutSteps shows 1+2+3 ✓, 4 ●. 3 stacked Cards (Shipping/Payment/Items with 48px images). Sticky right Card with mono price rows, total = primary, Place Order primary |
| #7 Order | `/order/:id` after placing | Title with mono order ID; 3 Cards (Shipping with status Badge, Payment with status Badge, Items list); sticky right Card with prices + PayPal button (when not paid) or Mark Delivered (admin only, paid+not delivered) |
| #8 CheckoutSteps stepper | any of #4–#7 | Circles with numbers; completed = ✓ in primary-filled circle; active = primary-bordered transparent; pending = muted-bordered transparent. Connectors are 1px lines, primary or border-color depending on next step state. Active step has `aria-current='step'` (verify via inspector). Pending steps not clickable |
| #9 Theme toggle | each of #1–#7 | Toggle in Header; FormCard, OrderSummary cards, stepper, DataTable rows, Badge tints all flip correctly |
| #13 FormContainer.js gone | repo root | `git ls-files frontend/src/components/FormContainer.js` returns nothing |
| #14 report.md ticks | `report.md` | rows 1–10 show `[x]`, rows 11–15 show `[ ]`, row 16 shows `[x] обязательно` |

For any failing check, file a follow-up commit (`course: fix: <what>`).

- [ ] **Step 6: No commit** unless fixes were needed.

---

## Done definition

- All 12 tasks above are checked off.
- All commits land on `m4-redesign`.
- Spec §7 acceptance criteria verified (Task 12).
- No regression in `FeatureListScreen.test.js` (4/4 still pass).
- `npm run build --prefix frontend` succeeds with no NEW warnings.

When done, propose options to the user:
- Open a PR for Phase 0+1+2 alone, or
- Continue to Phase 3 (Admin) on the same branch.

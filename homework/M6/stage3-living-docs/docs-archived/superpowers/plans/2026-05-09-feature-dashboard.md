# Feature Flag Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only `/admin/featuredashboard` page that lists feature flags from `docs/project-data/features.json` with status badges, a UI-only enable/disable toggle, a UI-only traffic-percentage slider, search, and status filter.

**Architecture:** A new read-only `GET /api/features` Express route reads `features.json` on every request (admin-protected). The frontend has a new Redux slice (`feature` domain) where async load actions and synchronous local mutations both live in one reducer. The screen owns search/filter as local `useState`. No persistence — toggle/slider only mutate the in-memory Redux state.

**Tech Stack:** Express 4 (ESM, `express-async-handler`), Mongoose 5 (unchanged), React 16.13, Redux 4 + redux-thunk, react-bootstrap 1.3, react-router-dom v5, axios 0.20, CRA 3.4 with Jest + @testing-library/react 9.

**Reference spec:** `docs/superpowers/specs/2026-05-09-feature-dashboard-design.md`

---

## Task 1: Backend — feature controller

**Files:**
- Create: `backend/controllers/featureController.js`

- [ ] **Step 1: Create the controller**

```js
// backend/controllers/featureController.js
import path from 'path'
import { promises as fs } from 'fs'
import asyncHandler from 'express-async-handler'

// @desc    Fetch all feature flags
// @route   GET /api/features
// @access  Private/Admin
const getFeatures = asyncHandler(async (req, res) => {
  const filePath = path.resolve(
    process.cwd(),
    'docs',
    'project-data',
    'features.json'
  )
  const raw = await fs.readFile(filePath, 'utf-8')
  const obj = JSON.parse(raw)
  const features = Object.entries(obj).map(([key, value]) => ({
    key,
    ...value,
  }))
  res.json(features)
})

export { getFeatures }
```

- [ ] **Step 2: Commit**

```bash
git add backend/controllers/featureController.js
git commit -m "course: feat: add feature flag controller"
```

---

## Task 2: Backend — feature route + mount

**Files:**
- Create: `backend/routes/featureRoutes.js`
- Modify: `backend/server.js` (add import + `app.use` before SPA fallback)

- [ ] **Step 1: Create the route file**

```js
// backend/routes/featureRoutes.js
import express from 'express'
const router = express.Router()
import { getFeatures } from '../controllers/featureController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/').get(protect, admin, getFeatures)

export default router
```

- [ ] **Step 2: Mount in `server.js`**

In `backend/server.js`, add the import alongside the others:

```js
import featureRoutes from './routes/featureRoutes.js'
```

Then add the `app.use` registration **before** the `if (process.env.NODE_ENV === 'production')` block (so it sits among the other `/api/*` registrations):

```js
app.use('/api/products', productRoutes)
app.use('/api/users', userRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/features', featureRoutes)
```

- [ ] **Step 3: Manual verification**

In one terminal:

```bash
npm run server
```

In another terminal — log in as the admin user via the API to obtain a token, then:

```bash
TOKEN=<paste admin token>
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/features | head
```

Expected: a JSON array starting with `[{"key":"search_v2","name":"New Search Algorithm",...`

Also verify auth is enforced:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/features
```

Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/featureRoutes.js backend/server.js
git commit -m "course: feat: expose admin-only GET /api/features"
```

---

## Task 3: Frontend — feature Redux constants

**Files:**
- Create: `frontend/src/constants/featureConstants.js`

- [ ] **Step 1: Create the constants module**

```js
// frontend/src/constants/featureConstants.js
export const FEATURE_LIST_REQUEST = 'FEATURE_LIST_REQUEST'
export const FEATURE_LIST_SUCCESS = 'FEATURE_LIST_SUCCESS'
export const FEATURE_LIST_FAIL = 'FEATURE_LIST_FAIL'

export const FEATURE_TOGGLE = 'FEATURE_TOGGLE'
export const FEATURE_TRAFFIC_UPDATE = 'FEATURE_TRAFFIC_UPDATE'
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/constants/featureConstants.js
git commit -m "course: feat: add feature flag redux constants"
```

---

## Task 4: Frontend — feature reducer with TDD

**Files:**
- Create: `frontend/src/reducers/featureReducers.test.js`
- Create: `frontend/src/reducers/featureReducers.js`

- [ ] **Step 1: Write the failing tests**

```js
// frontend/src/reducers/featureReducers.test.js
import { featureListReducer } from './featureReducers'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_TOGGLE,
  FEATURE_TRAFFIC_UPDATE,
} from '../constants/featureConstants'

const sampleFeatures = [
  {
    key: 'search_v2',
    name: 'New Search Algorithm',
    status: 'Testing',
    traffic_percentage: 25,
    last_modified: '2026-05-03',
  },
  {
    key: 'cart_redesign',
    name: 'Redesigned Cart UI',
    status: 'Disabled',
    traffic_percentage: 0,
    last_modified: '2026-04-01',
  },
  {
    key: 'paypal_express_buttons',
    name: 'PayPal Express Checkout Buttons',
    status: 'Enabled',
    traffic_percentage: 100,
    last_modified: '2026-01-08',
  },
]

describe('featureListReducer', () => {
  it('returns initial state for unknown action', () => {
    const state = featureListReducer(undefined, { type: 'OTHER' })
    expect(state).toEqual({ features: [] })
  })

  it('handles FEATURE_LIST_REQUEST', () => {
    const state = featureListReducer(undefined, { type: FEATURE_LIST_REQUEST })
    expect(state).toEqual({ loading: true, features: [] })
  })

  it('handles FEATURE_LIST_SUCCESS', () => {
    const state = featureListReducer(
      { loading: true, features: [] },
      { type: FEATURE_LIST_SUCCESS, payload: sampleFeatures }
    )
    expect(state).toEqual({ loading: false, features: sampleFeatures })
  })

  it('handles FEATURE_LIST_FAIL', () => {
    const state = featureListReducer(
      { loading: true, features: [] },
      { type: FEATURE_LIST_FAIL, payload: 'boom' }
    )
    expect(state).toEqual({ loading: false, features: [], error: 'boom' })
  })

  describe('FEATURE_TOGGLE', () => {
    const today = new Date().toISOString().slice(0, 10)

    it('flips Disabled to Enabled', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'cart_redesign' } }
      )
      const target = state.features.find((f) => f.key === 'cart_redesign')
      expect(target.status).toBe('Enabled')
      expect(target.last_modified).toBe(today)
    })

    it('flips Enabled to Disabled', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'paypal_express_buttons' } }
      )
      const target = state.features.find(
        (f) => f.key === 'paypal_express_buttons'
      )
      expect(target.status).toBe('Disabled')
      expect(target.last_modified).toBe(today)
    })

    it('flips Testing to Disabled', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'search_v2' } }
      )
      const target = state.features.find((f) => f.key === 'search_v2')
      expect(target.status).toBe('Disabled')
      expect(target.last_modified).toBe(today)
    })

    it('does not touch other features', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        { type: FEATURE_TOGGLE, payload: { key: 'search_v2' } }
      )
      const other = state.features.find((f) => f.key === 'cart_redesign')
      expect(other).toEqual(sampleFeatures[1])
    })
  })

  describe('FEATURE_TRAFFIC_UPDATE', () => {
    const today = new Date().toISOString().slice(0, 10)

    it('updates traffic_percentage and last_modified for the targeted feature', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        {
          type: FEATURE_TRAFFIC_UPDATE,
          payload: { key: 'search_v2', traffic_percentage: 75 },
        }
      )
      const target = state.features.find((f) => f.key === 'search_v2')
      expect(target.traffic_percentage).toBe(75)
      expect(target.last_modified).toBe(today)
    })

    it('does not touch other features', () => {
      const state = featureListReducer(
        { loading: false, features: sampleFeatures },
        {
          type: FEATURE_TRAFFIC_UPDATE,
          payload: { key: 'search_v2', traffic_percentage: 75 },
        }
      )
      const other = state.features.find((f) => f.key === 'cart_redesign')
      expect(other).toEqual(sampleFeatures[1])
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test --prefix frontend -- --testPathPattern=featureReducers --watchAll=false
```

Expected: FAIL — `Cannot find module './featureReducers'`.

- [ ] **Step 3: Implement the reducer**

```js
// frontend/src/reducers/featureReducers.js
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_TOGGLE,
  FEATURE_TRAFFIC_UPDATE,
} from '../constants/featureConstants'

const today = () => new Date().toISOString().slice(0, 10)

export const featureListReducer = (state = { features: [] }, action) => {
  switch (action.type) {
    case FEATURE_LIST_REQUEST:
      return { loading: true, features: [] }
    case FEATURE_LIST_SUCCESS:
      return { loading: false, features: action.payload }
    case FEATURE_LIST_FAIL:
      return { loading: false, features: [], error: action.payload }
    case FEATURE_TOGGLE:
      return {
        ...state,
        features: state.features.map((f) =>
          f.key === action.payload.key
            ? {
                ...f,
                status: f.status === 'Disabled' ? 'Enabled' : 'Disabled',
                last_modified: today(),
              }
            : f
        ),
      }
    case FEATURE_TRAFFIC_UPDATE:
      return {
        ...state,
        features: state.features.map((f) =>
          f.key === action.payload.key
            ? {
                ...f,
                traffic_percentage: action.payload.traffic_percentage,
                last_modified: today(),
              }
            : f
        ),
      }
    default:
      return state
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test --prefix frontend -- --testPathPattern=featureReducers --watchAll=false
```

Expected: PASS — all `featureListReducer` tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/reducers/featureReducers.js frontend/src/reducers/featureReducers.test.js
git commit -m "course: feat: add feature flag redux reducer"
```

---

## Task 5: Frontend — feature actions

**Files:**
- Create: `frontend/src/actions/featureActions.js`

- [ ] **Step 1: Create the actions module**

```js
// frontend/src/actions/featureActions.js
import axios from 'axios'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_TOGGLE,
  FEATURE_TRAFFIC_UPDATE,
} from '../constants/featureConstants'

export const listFeatures = () => async (dispatch, getState) => {
  try {
    dispatch({ type: FEATURE_LIST_REQUEST })

    const {
      userLogin: { userInfo },
    } = getState()

    const config = {
      headers: {
        Authorization: `Bearer ${userInfo.token}`,
      },
    }

    const { data } = await axios.get('/api/features', config)

    dispatch({ type: FEATURE_LIST_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: FEATURE_LIST_FAIL,
      payload:
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message,
    })
  }
}

export const toggleFeature = (key) => ({
  type: FEATURE_TOGGLE,
  payload: { key },
})

export const updateFeatureTraffic = (key, traffic_percentage) => ({
  type: FEATURE_TRAFFIC_UPDATE,
  payload: { key, traffic_percentage },
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/actions/featureActions.js
git commit -m "course: feat: add feature flag redux actions"
```

---

## Task 6: Frontend — wire reducer into store

**Files:**
- Modify: `frontend/src/store.js` (add import + entry in `combineReducers`)

- [ ] **Step 1: Add import**

In `frontend/src/store.js`, add this import next to the other reducer imports:

```js
import { featureListReducer } from './reducers/featureReducers'
```

- [ ] **Step 2: Register in `combineReducers`**

Add `featureList: featureListReducer,` as the last entry in the `combineReducers({ ... })` call. The block should now end:

```js
  orderListMy: orderListMyReducer,
  orderList: orderListReducer,
  featureList: featureListReducer,
})
```

- [ ] **Step 3: Smoke check the build**

Run:
```bash
npm test --prefix frontend -- --watchAll=false
```

Expected: existing tests (if any) still pass; reducer tests still pass.

Then run:
```bash
npm run client
```

Expected: dev server compiles with no errors. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store.js
git commit -m "course: feat: register featureList reducer in store"
```

---

## Task 7: Frontend — FeatureListScreen with smoke test (TDD)

**Files:**
- Create: `frontend/src/screens/FeatureListScreen.test.js`
- Create: `frontend/src/screens/FeatureListScreen.js`

- [ ] **Step 1: Write the failing smoke test**

```js
// frontend/src/screens/FeatureListScreen.test.js
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore, combineReducers } from 'redux'
import { MemoryRouter } from 'react-router-dom'
import FeatureListScreen from './FeatureListScreen'
import { featureListReducer } from '../reducers/featureReducers'

const sampleFeatures = [
  {
    key: 'search_v2',
    name: 'New Search Algorithm',
    status: 'Testing',
    traffic_percentage: 25,
    last_modified: '2026-05-03',
  },
  {
    key: 'cart_redesign',
    name: 'Redesigned Cart UI',
    status: 'Disabled',
    traffic_percentage: 0,
    last_modified: '2026-04-01',
  },
  {
    key: 'paypal_express_buttons',
    name: 'PayPal Express Checkout Buttons',
    status: 'Enabled',
    traffic_percentage: 100,
    last_modified: '2026-01-08',
  },
]

const buildStore = (features) =>
  createStore(
    combineReducers({
      featureList: featureListReducer,
      userLogin: () => ({ userInfo: { isAdmin: true, token: 't' } }),
    }),
    {
      featureList: { loading: false, features },
      userLogin: { userInfo: { isAdmin: true, token: 't' } },
    }
  )

const renderScreen = (features = sampleFeatures) => {
  const store = buildStore(features)
  const history = { push: jest.fn() }
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <FeatureListScreen history={history} />
      </MemoryRouter>
    </Provider>
  )
}

describe('FeatureListScreen', () => {
  it('renders one row per feature', () => {
    const { getByText } = renderScreen()
    expect(getByText('New Search Algorithm')).toBeInTheDocument()
    expect(getByText('Redesigned Cart UI')).toBeInTheDocument()
    expect(getByText('PayPal Express Checkout Buttons')).toBeInTheDocument()
  })

  it('filters by name via the search input', () => {
    const { getByLabelText, queryByText } = renderScreen()
    fireEvent.change(getByLabelText('Search features by name'), {
      target: { value: 'cart' },
    })
    expect(queryByText('Redesigned Cart UI')).toBeInTheDocument()
    expect(queryByText('New Search Algorithm')).not.toBeInTheDocument()
    expect(queryByText('PayPal Express Checkout Buttons')).not.toBeInTheDocument()
  })

  it('filters by status', () => {
    const { getByLabelText, queryByText } = renderScreen()
    fireEvent.change(getByLabelText('Filter by status'), {
      target: { value: 'Testing' },
    })
    expect(queryByText('New Search Algorithm')).toBeInTheDocument()
    expect(queryByText('Redesigned Cart UI')).not.toBeInTheDocument()
    expect(queryByText('PayPal Express Checkout Buttons')).not.toBeInTheDocument()
  })

  it('shows the empty-filter message when nothing matches', () => {
    const { getByLabelText, getByText } = renderScreen()
    fireEvent.change(getByLabelText('Search features by name'), {
      target: { value: 'zzznotreal' },
    })
    expect(getByText(/No features match your filters/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Add jest-dom matchers (if not already wired)**

Check whether `frontend/src/setupTests.js` exists:

```bash
ls frontend/src/setupTests.js 2>/dev/null || echo MISSING
```

If `MISSING`, create it:

```js
// frontend/src/setupTests.js
import '@testing-library/jest-dom/extend-expect'
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false
```

Expected: FAIL — `Cannot find module './FeatureListScreen'`.

- [ ] **Step 4: Implement the screen**

```js
// frontend/src/screens/FeatureListScreen.js
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Table, Form, Badge, Row, Col } from 'react-bootstrap'
import Message from '../components/Message'
import {
  listFeatures,
  toggleFeature,
  updateFeatureTraffic,
} from '../actions/featureActions'

const STATUS_VARIANT = {
  Enabled: 'success',
  Testing: 'primary',
  Disabled: 'secondary',
}

const SkeletonRow = () => (
  <tr>
    {[0, 1, 2, 3, 4].map((i) => (
      <td key={i}>
        <span
          style={{
            display: 'inline-block',
            width: '80%',
            height: '1rem',
            backgroundColor: '#e9ecef',
            borderRadius: '0.25rem',
          }}
        />
      </td>
    ))}
  </tr>
)

const FeatureRow = ({ feature }) => {
  const dispatch = useDispatch()
  const [localTraffic, setLocalTraffic] = useState(feature.traffic_percentage)
  const debounceRef = useRef(null)

  useEffect(() => {
    setLocalTraffic(feature.traffic_percentage)
  }, [feature.traffic_percentage])

  const handleSlider = (e) => {
    const value = Number(e.target.value)
    setLocalTraffic(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      dispatch(updateFeatureTraffic(feature.key, value))
    }, 150)
  }

  const handleToggle = () => {
    dispatch(toggleFeature(feature.key))
  }

  return (
    <tr>
      <td>{feature.name}</td>
      <td>
        <Badge variant={STATUS_VARIANT[feature.status]}>{feature.status}</Badge>
      </td>
      <td>
        <Form.Control
          type='range'
          min={0}
          max={100}
          value={localTraffic}
          onChange={handleSlider}
          aria-label={`Traffic percentage for ${feature.name}`}
        />
        <span aria-live='polite'>{localTraffic}%</span>
      </td>
      <td>{feature.last_modified}</td>
      <td>
        <Form.Check
          type='switch'
          id={`toggle-${feature.key}`}
          label={`Enable ${feature.name}`}
          checked={feature.status === 'Enabled'}
          onChange={handleToggle}
        />
      </td>
    </tr>
  )
}

const FeatureListScreen = ({ history }) => {
  const dispatch = useDispatch()
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const featureList = useSelector((state) => state.featureList)
  const { loading, error, features } = featureList

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listFeatures())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

  const filtered = useMemo(() => {
    return (features || [])
      .filter(
        (f) =>
          keyword === '' ||
          f.name.toLowerCase().includes(keyword.toLowerCase())
      )
      .filter((f) => statusFilter === 'All' || f.status === statusFilter)
  }, [features, keyword, statusFilter])

  const renderBody = () => {
    if (loading) {
      return [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
    }
    if (filtered.length === 0) {
      return null
    }
    return filtered.map((f) => <FeatureRow key={f.key} feature={f} />)
  }

  return (
    <>
      <h1>Feature Dashboard</h1>
      <Row className='mb-3'>
        <Col md={8}>
          <Form.Control
            type='text'
            placeholder='Search by name...'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label='Search features by name'
          />
        </Col>
        <Col md={4}>
          <Form.Control
            as='select'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label='Filter by status'
          >
            <option value='All'>All</option>
            <option value='Enabled'>Enabled</option>
            <option value='Testing'>Testing</option>
            <option value='Disabled'>Disabled</option>
          </Form.Control>
        </Col>
      </Row>

      {error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <>
          <Table striped bordered hover responsive className='table-sm'>
            <thead>
              <tr>
                <th>NAME</th>
                <th>STATUS</th>
                <th>TRAFFIC %</th>
                <th>LAST MODIFIED</th>
                <th>TOGGLE</th>
              </tr>
            </thead>
            <tbody>{renderBody()}</tbody>
          </Table>
          {!loading && filtered.length === 0 && (features || []).length > 0 && (
            <Message variant='info'>No features match your filters.</Message>
          )}
          {!loading && (features || []).length === 0 && !error && (
            <Message variant='info'>No feature flags found.</Message>
          )}
        </>
      )}
    </>
  )
}

export default FeatureListScreen
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false
```

Expected: PASS — all 4 screen tests green. Reducer tests still green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/FeatureListScreen.js frontend/src/screens/FeatureListScreen.test.js
# also add setupTests.js if it was newly created in Step 2:
git add frontend/src/setupTests.js 2>/dev/null || true
git commit -m "course: feat: add FeatureListScreen with search and filter"
```

---

## Task 8: Frontend — wire route and admin-dropdown link

**Files:**
- Modify: `frontend/src/App.js` (import + new `<Route>`)
- Modify: `frontend/src/components/Header.js` (new `NavDropdown.Item`)

- [ ] **Step 1: Add the import in `App.js`**

Next to the other screen imports in `frontend/src/App.js`:

```js
import FeatureListScreen from './screens/FeatureListScreen'
```

- [ ] **Step 2: Register the route in `App.js`**

Add this `<Route>` immediately after `<Route path='/admin/orderlist' component={OrderListScreen} />`:

```js
<Route
  path='/admin/featuredashboard'
  component={FeatureListScreen}
/>
```

- [ ] **Step 3: Add admin dropdown link in `Header.js`**

Inside the existing admin `<NavDropdown title='Admin' id='adminmenu'>` block in `frontend/src/components/Header.js`, add a fourth `LinkContainer` after the Orders entry:

```jsx
<LinkContainer to='/admin/featuredashboard'>
  <NavDropdown.Item>Feature Flags</NavDropdown.Item>
</LinkContainer>
```

The full admin dropdown should now contain four items: Users, Products, Orders, Feature Flags.

- [ ] **Step 4: Smoke check the build**

Run:
```bash
npm test --prefix frontend -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.js frontend/src/components/Header.js
git commit -m "course: feat: route and admin-dropdown link for feature dashboard"
```

---

## Task 9: End-to-end manual verification

No code changes. Run the full app and verify the page in a browser.

- [ ] **Step 1: Start the app**

Run:
```bash
npm run dev
```

Wait until both backend (port 5000) and CRA dev server (port 3000) are up.

- [ ] **Step 2: Log in as admin**

Open http://localhost:3000/, sign in with the admin credentials seeded by `npm run data:import` (`admin@example.com` / `123456`).

- [ ] **Step 3: Navigate via the admin dropdown**

Click the user-name dropdown is **NOT** the right one — click the **Admin** dropdown in the navbar. Confirm the four entries: Users, Products, Orders, **Feature Flags**. Click **Feature Flags**.

Expected: URL becomes `/admin/featuredashboard`. Page header reads "Feature Dashboard". Table renders with 25 rows (one per feature in `features.json`).

- [ ] **Step 4: Verify each requirement**

Tick off each item against the page:

- Status badges in three colors (Enabled = green, Testing = blue, Disabled = grey).
- Toggle switch flips the badge color and updates the LAST MODIFIED column to today.
- Slider 0–100 updates the percentage shown next to it; on release, LAST MODIFIED also updates to today.
- Typing in the search box filters rows by name (case-insensitive).
- Status filter dropdown narrows rows to the chosen status.
- Combined search + filter that matches nothing shows "No features match your filters."
- Tab navigation reaches every interactive control; Space toggles the switch and Enter activates dropdown options.
- Reload the page during fetch (devtools → throttle to "Slow 3G") to see skeleton rows.
- Stop the backend (`Ctrl+C` in the server terminal), reload — should show an error `Message`.

- [ ] **Step 5: Verify non-admin is redirected**

Log out, sign in as a non-admin user (`john@example.com` / `123456`), and try to visit http://localhost:3000/admin/featuredashboard directly.

Expected: redirected to `/login`.

- [ ] **Step 6: No commit**

This task makes no code changes. If any defect was found in steps 4–5, return to the relevant earlier task, fix it on a new commit (not via amend), and re-run this task.

---

## Self-Review Notes

- **Spec coverage:**
  - Admin route + isAdmin check + admin-dropdown link → Task 8
  - Features list rendered → Task 7
  - Three-color badges → Task 7 (`STATUS_VARIANT` map)
  - Toggle flips badge → Task 4 reducer + Task 7 handler
  - Slider 0–100 → Task 7 (`<Form.Control type='range'>`)
  - Search by name → Task 7
  - Filter by status → Task 7
  - Loading skeleton → Task 7 (`SkeletonRow`)
  - Empty state → Task 7 (two distinct messages)
  - Error state → Task 7 (`<Message variant='danger'>`)
  - ARIA labels on interactive elements → Task 7
  - Keyboard navigation → satisfied by using native `<input>`/`<select>`/`<Form.Check>` controls (no custom keyboard handlers needed)
- **Backend auth:** spec calls for `protect, admin` → Task 2.
- **No persistence:** there is intentionally no `PUT/POST` endpoint and no `localStorage` rehydration in `store.js`.

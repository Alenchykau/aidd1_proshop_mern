# Feature Flag Dashboard — Design

**Date:** 2026-05-09
**Scope:** Admin-only page that lists feature flags from `docs/project-data/features.json` with search, status filter, status badges, a UI-only toggle, and a UI-only traffic-percentage slider.

## Goals

- Surface every flag in `features.json` to admins via the existing `Header` admin dropdown.
- Display `name`, `status`, `traffic_percentage`, `last_modified` for each flag.
- Allow admins to interactively explore state via toggle/slider/search/filter — **without persisting** changes (the MCP server remains the only writer of `features.json`).
- Cover loading, empty, and error states; meet basic ARIA/keyboard requirements.

## Non-goals

- Persisting changes back to `features.json` (forbidden by `CLAUDE.md`; MCP is the source of truth).
- Validating feature dependencies on toggle (e.g., requiring `search_v2` before `semantic_search`).
- Rendering `description`, `targeted_segments`, `rollout_strategy`, `dependencies` — out of scope per the requirements doc.

## Architecture

Two new layers wired into the existing project conventions.

### Backend

- **Route:** `GET /api/features`
  - File: `backend/routes/featureRoutes.js`
  - Handler: `getFeatures` in `backend/controllers/featureController.js`
  - Middleware chain: `protect, admin, getFeatures` — same pattern as other admin-only endpoints; matches the dropdown's visibility rule and prevents the file from being world-readable.
- **Behavior:** read `docs/project-data/features.json` from `process.cwd()` via `fs/promises.readFile` on every request (so MCP-driven edits are reflected without a restart), `JSON.parse`, transform `Object.entries` into an array `[{ key, ...feature }, ...]`, return JSON.
- **Errors:** wrapped in `asyncHandler`. File-not-found / parse failure throws → handled by existing `errorMiddleware`. No bespoke error message — default 500 is fine for a misconfigured deploy.
- **Mounting:** registered in `backend/server.js` **before** the `app.get('*', ...)` SPA fallback (per the gotcha in `CLAUDE.md`).

### Frontend

- **Route:** `/admin/featuredashboard` in `frontend/src/App.js`, using the existing `<Route path component={...}>` v5 pattern.
- **Header link:** new `NavDropdown.Item` "Feature Flags" inside the existing admin `NavDropdown` in `frontend/src/components/Header.js`. Visible only when `userInfo?.isAdmin`.
- **Screen:** `frontend/src/screens/FeatureListScreen.js`.
- **Redux domain:** `feature` (one new slice), wired into `frontend/src/store.js`.
- **Components:** `FeatureRow` (private, in the same file as the screen — small enough that splitting it adds no value).
- **Reused:** `Loader` (only as fallback if needed), `Message`, `react-bootstrap` `Table`, `Form`, `Badge`, `Container`.

## Component Layout

```
FeatureListScreen
├── <h1>Feature Dashboard</h1>
├── Controls row
│   ├── <Form.Control type="text" placeholder="Search by name..." />   (keyword)
│   └── <Form.Control as="select"> All / Enabled / Testing / Disabled  (statusFilter)
├── Body (one of):
│   ├── Loading  → 5× <FeatureSkeletonRow />   (table with grey placeholders)
│   ├── Error    → <Message variant="danger">{error}</Message>
│   ├── Empty    → "No features match your filters." | "No feature flags found."
│   └── Loaded   → <Table striped bordered hover responsive className="table-sm">
│                    thead: NAME | STATUS | TRAFFIC % | LAST MODIFIED | TOGGLE
│                    tbody: filtered.map(f => <FeatureRow feature={f} />)
```

### `FeatureRow` columns

| Column         | Element |
|----------------|---------|
| NAME           | `feature.name` (text) |
| STATUS         | `<Badge variant={...}>{feature.status}</Badge>` — `success` for Enabled, `primary` for Testing, `secondary` for Disabled |
| TRAFFIC %      | `<Form.Control type="range" min={0} max={100}>` + `<span aria-live="polite">{value}%</span>` |
| LAST MODIFIED  | `feature.last_modified` (ISO date string, displayed as-is) |
| TOGGLE         | `<Form.Check type="switch" checked={status === 'Enabled'}>` |

## Redux Slice (`feature` domain)

### Constants — `frontend/src/constants/featureConstants.js`

```
FEATURE_LIST_REQUEST
FEATURE_LIST_SUCCESS
FEATURE_LIST_FAIL
FEATURE_TOGGLE              // payload: { key }
FEATURE_TRAFFIC_UPDATE      // payload: { key, traffic_percentage }
```

### Reducer — `frontend/src/reducers/featureReducers.js`

`featureListReducer` is the sole reducer for the slice; it owns the `features` array and therefore handles both async load actions and synchronous local mutations:

- `REQUEST` → `{ loading: true, features: [] }`
- `SUCCESS` → `{ loading: false, features: action.payload }`
- `FAIL` → `{ loading: false, error: action.payload }`
- `TOGGLE` → maps `features`; for the matching `key` flips `status`:
  - `'Disabled'` → `'Enabled'`
  - `'Enabled' | 'Testing'` → `'Disabled'`
  - Also sets `last_modified` to today's ISO date (UX feedback that the change registered).
- `TRAFFIC_UPDATE` → maps `features`; sets `traffic_percentage` for the matching `key` and updates `last_modified` to today.

### Action creators — `frontend/src/actions/featureActions.js`

- `listFeatures()` — thunk:
  ```js
  const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
  const { data } = await axios.get('/api/features', config)
  ```
  Standard request/success/fail dispatch triplet, error message extraction matches the project pattern (`error.response?.data?.message ?? error.message`).
- `toggleFeature(key)` — synchronous, returns the action object directly.
- `updateFeatureTraffic(key, percentage)` — synchronous.

### Store wiring — `frontend/src/store.js`

Add `featureList: featureListReducer` to `combineReducers`. **No `localStorage` rehydration** for this slice — `CLAUDE.md` restricts persistence to `cart.cartItems`, `cart.shippingAddress`, `userLogin.userInfo`.

## Data Flow

### Load (on mount)

```
FeatureListScreen useEffect
  ├─ !userInfo || !userInfo.isAdmin → history.push('/login')
  └─ dispatch(listFeatures())
        FEATURE_LIST_REQUEST
        axios.get('/api/features', { headers: { Authorization: ... } })
        ✓ FEATURE_LIST_SUCCESS  payload: [{ key, name, status, traffic_percentage, last_modified, ... }]
        ✗ FEATURE_LIST_FAIL     payload: <message>
```

### UI-only mutations

```
Toggle clicked on row "search_v2"
  → dispatch(toggleFeature('search_v2'))
  → reducer flips status + updates last_modified
  → re-render: badge variant changes, last_modified shows today

Slider drag on row "cart_redesign"
  → onChange (debounced ~150ms via a useRef-held setTimeout)
  → dispatch(updateFeatureTraffic('cart_redesign', 35))
  → reducer updates traffic_percentage + last_modified
```

### Search / status filter (local state)

```js
const [keyword, setKeyword] = useState('')
const [statusFilter, setStatusFilter] = useState('All')

const filtered = useMemo(() =>
  features
    .filter(f => keyword === '' || f.name.toLowerCase().includes(keyword.toLowerCase()))
    .filter(f => statusFilter === 'All' || f.status === statusFilter),
  [features, keyword, statusFilter]
)
```

## States & Edge Cases

| Case | Handling |
|------|----------|
| Not logged in | `useEffect` → `history.push('/login')` |
| Logged in, non-admin | Same as above |
| Loading | 5× skeleton rows in the table body |
| Backend 401 (expired token) | `FEATURE_LIST_FAIL` → `<Message variant="danger">` |
| Backend 500 (bad/missing file) | Same |
| `features` empty after successful load | "No feature flags found." |
| Filter yields 0 results | "No features match your filters." (controls remain visible) |
| Rapid slider drag | Debounce ~150ms, single dispatch after pause |
| Toggle during loading | Not reachable — table not rendered while `loading=true` |
| Dependencies between flags | Ignored (out of scope) |

## Accessibility

- Search input: `aria-label="Search features by name"`.
- Status select: `aria-label="Filter by status"`.
- Toggle: `<Form.Check type="switch">` carries a visible `label` per row; `react-bootstrap` wires the label-input association.
- Slider: `<Form.Control type="range" aria-label="Traffic percentage for {feature.name}">`. Adjacent `<span aria-live="polite">{value}%</span>` so screen readers announce the new value.
- Tab / Enter / Space — handled natively by the standard `<input>`, `<select>`, `<Form.Check>` elements; no custom `div role="button"` controls are introduced.

## Testing

Backend has no test runner (per `CLAUDE.md`); the new route is verified manually:

```
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/features
```

plus end-to-end verification by logging in as the admin user and exercising the page in a browser.

Frontend (CRA Jest, already configured):

1. **`featureReducers.test.js`** — pure-function unit tests:
   - `FEATURE_LIST_REQUEST` sets `loading: true`.
   - `FEATURE_LIST_SUCCESS` stores the payload and clears `loading`.
   - `FEATURE_LIST_FAIL` stores the error and clears `loading`.
   - `FEATURE_TOGGLE`: `Disabled → Enabled`, `Enabled → Disabled`, `Testing → Disabled`; `last_modified` is updated to today; other features untouched.
   - `FEATURE_TRAFFIC_UPDATE` updates only the targeted feature.
2. **`FeatureListScreen.test.js`** — one smoke test with `@testing-library/react` and a mock store:
   - All rows render.
   - Typing into the search input filters the rendered rows by name substring.
   - Selecting status `Testing` leaves only Testing-status rows.
   - Empty-state message renders when filters match zero rows.

Out of scope: thunk integration tests, snapshot tests, automated a11y assertions (`jest-axe` is not in the project).

## File Inventory

**New:**

```
backend/routes/featureRoutes.js
backend/controllers/featureController.js
frontend/src/screens/FeatureListScreen.js
frontend/src/constants/featureConstants.js
frontend/src/actions/featureActions.js
frontend/src/reducers/featureReducers.js
frontend/src/reducers/featureReducers.test.js
frontend/src/screens/FeatureListScreen.test.js
```

**Modified:**

```
backend/server.js                           // mount /api/features before SPA fallback
frontend/src/App.js                         // <Route path="/admin/featuredashboard" component={FeatureListScreen} />
frontend/src/components/Header.js           // admin-dropdown link "Feature Flags"
frontend/src/store.js                       // combineReducers + initial state
```

## Open Risks

- `process.cwd()` differs between `npm run dev` (repo root) and a Heroku dyno launch; the path `docs/project-data/features.json` resolves correctly only when the server is launched from the repo root. This matches every other relative path in the project (e.g., `uploads/`, `backend/data/*`), so no new risk — but worth noting if someone changes the launch dir.
- The `protect, admin` chain depends on a valid JWT in `localStorage`. If the user's token expired since their last login, the page will show an error message; recovery requires a manual re-login. Acceptable for course scope.

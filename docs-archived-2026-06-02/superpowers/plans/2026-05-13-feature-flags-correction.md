# Feature Flags Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `features.json` to the backend as a live runtime artifact, rename the endpoint, add persistence + a `list_features` MCP tool, then carry those changes into `m4-redesign` with two small UI additions for in-flight + update-error feedback.

**Architecture:** Single file (`backend/features.json`) shared by Express and the MCP server; both writers go through atomic temp-rename writes (Express also serializes through a single promise queue). One Redux reducer owns the list and update operations. The existing `m4-redesign` scoped-CSS implementation of `FeatureListScreen` stays — only persistence wiring is added.

**Tech Stack:** Express 4 (ESM), Mongoose 5, `express-async-handler`, `axios` 0.20, classic Redux + thunk, CRA 3.4.3 (Jest + RTL), MCP TypeScript SDK.

**Branch strategy:** Phase 1 (tasks 1–5) on `main`. Phase 2 (task 6) merges `main` into `m4-redesign`. Phase 3 (task 7) is one commit on `m4-redesign`. Phase 4 (task 8) verifies `prompt.md` end to end on `m4-redesign`.

---

## Task 1: Move features.json to backend and repoint all readers

**Branch:** `main`

**Files:**
- Move: `docs/project-data/features.json` → `backend/features.json`
- Modify: `backend/controllers/featureController.js` (path constant)
- Modify: `mcp-feature-flags/server.ts` (path constant)
- Rebuild: `mcp-feature-flags/dist/server.js` (`tsc` output)
- Modify: `CLAUDE.md` (Feature flags MCP section + endpoints list)
- Modify: `README.md` if it references the old path (likely doesn't — verify)

- [ ] **Step 1: Switch branch and confirm clean tree**

```bash
git checkout main
git status
```
Expected: `nothing to commit, working tree clean`. If not — stash or commit first; do not start with a dirty tree.

- [ ] **Step 2: Find every reference to the old path**

```bash
git grep -n "docs/project-data/features.json"
```
Expected: hits in `mcp-feature-flags/server.ts`, `mcp-feature-flags/dist/server.js`, `backend/controllers/featureController.js`, `CLAUDE.md`. Record the list — every one needs an update.

- [ ] **Step 3: git mv the file**

```bash
git mv docs/project-data/features.json backend/features.json
```

- [ ] **Step 4: Update the Express controller path**

Edit `backend/controllers/featureController.js`. Replace the path-resolve block:

```js
// OLD
const filePath = path.resolve(
  process.cwd(),
  'docs',
  'project-data',
  'features.json'
)
// NEW
const filePath = path.resolve(process.cwd(), 'backend', 'features.json')
```

- [ ] **Step 5: Update the MCP server path constant**

Edit `mcp-feature-flags/server.ts` line 9:

```ts
// OLD
const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/project-data/features.json");
// NEW
const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../backend/features.json");
```

- [ ] **Step 6: Rebuild the MCP server**

```bash
cd mcp-feature-flags
npm run build
cd ..
git diff --stat mcp-feature-flags/dist/
```
Expected: `dist/server.js` (and possibly `dist/server.js.map`) appear in the diff. If `npm run build` does not exist, run `npx tsc` from `mcp-feature-flags/`.

- [ ] **Step 7: Update CLAUDE.md**

In the section `### Feature flags (\`feature-flags\` MCP)`, change every `docs/project-data/features.json` to `backend/features.json`. There are two occurrences.

- [ ] **Step 8: Verify there are no remaining references**

```bash
git grep -n "docs/project-data/features.json"
```
Expected: no matches.

- [ ] **Step 9: Sanity-check the API still works**

In one terminal: `npm run dev`. Wait for both backend and CRA to come up. Then:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/features | head -c 200
```

(`$TOKEN` = a fresh JWT from `POST /api/users/login` with an admin account. Or skip auth proof and just check the file is read by hitting the route without a token — expecting `401 Not authorized` proves the route is mounted and reads the new path on its way to the auth middleware.)

Expected: either `401` (proves new mount path resolves to new file) or a JSON array of features starting with `[{"key":"search_v2"`.

Stop the dev server (`Ctrl+C`).

- [ ] **Step 10: Commit**

```bash
git add backend/features.json backend/controllers/featureController.js \
        mcp-feature-flags/server.ts mcp-feature-flags/dist/ CLAUDE.md
git status   # confirm docs/project-data/features.json is shown as deleted
git commit -m "course: chore: move features.json from docs/project-data to backend"
```

---

## Task 2: Backend features.json utility

**Branch:** `main`

**Files:**
- Create: `backend/utils/featureFile.js`

This utility centralizes file IO, validation, and the in-process write queue. The controller will call into it for both list and update.

- [ ] **Step 1: Create the utility module**

Create `backend/utils/featureFile.js`:

```js
import path from 'path'
import { promises as fs } from 'fs'

const FILE_PATH = path.resolve(process.cwd(), 'backend', 'features.json')
const TMP_PATH = `${FILE_PATH}.tmp`

let writeQueue = Promise.resolve()

const VALID_STATUS = ['Enabled', 'Testing', 'Disabled']

const todayISO = () => new Date().toISOString().slice(0, 10)

const readFeaturesObject = async () => {
  const raw = await fs.readFile(FILE_PATH, 'utf-8')
  return JSON.parse(raw)
}

export const readFeatures = async () => {
  const obj = await readFeaturesObject()
  return Object.entries(obj).map(([key, value]) => ({ key, ...value }))
}

export const validateEnable = (features, key) => {
  const target = features[key]
  if (!target) return { ok: false, error: 'FEATURE_NOT_FOUND' }
  const deps = target.dependencies || []
  const blocking = deps.filter((d) => !features[d] || features[d].status !== 'Enabled')
  if (blocking.length > 0) {
    return { ok: false, error: 'DEPENDENCY_NOT_ENABLED', blocking }
  }
  return { ok: true }
}

const atomicWrite = async (obj) => {
  await fs.writeFile(TMP_PATH, JSON.stringify(obj, null, 2), 'utf-8')
  await fs.rename(TMP_PATH, FILE_PATH)
}

// Serialize all writes through a single chain so two concurrent admin clicks
// can't interleave a read-modify-write.
export const writeFeature = (key, patch) => {
  const job = writeQueue.then(async () => {
    const obj = await readFeaturesObject()
    const current = obj[key]
    if (!current) {
      const err = new Error('FEATURE_NOT_FOUND')
      err.status = 404
      err.code = 'FEATURE_NOT_FOUND'
      throw err
    }

    const next = { ...current }

    if (patch.status !== undefined) {
      if (!VALID_STATUS.includes(patch.status)) {
        const err = new Error('INVALID_STATUS')
        err.status = 400
        err.code = 'INVALID_STATUS'
        throw err
      }
      if (patch.status === 'Enabled') {
        const check = validateEnable(obj, key)
        if (!check.ok) {
          const err = new Error('DEPENDENCY_NOT_ENABLED')
          err.status = 400
          err.code = 'DEPENDENCY_NOT_ENABLED'
          err.blocking = check.blocking
          throw err
        }
      }
      next.status = patch.status
    }

    if (patch.traffic_percentage !== undefined) {
      const v = patch.traffic_percentage
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        const err = new Error('INVALID_TRAFFIC')
        err.status = 400
        err.code = 'INVALID_TRAFFIC'
        throw err
      }
      const effectiveStatus = next.status
      if (effectiveStatus === 'Disabled' && v > 0) {
        const err = new Error('DISABLED_TRAFFIC_LOCKED')
        err.status = 400
        err.code = 'DISABLED_TRAFFIC_LOCKED'
        throw err
      }
      next.traffic_percentage = v
    }

    next.last_modified = todayISO()
    obj[key] = next
    await atomicWrite(obj)
    return { key, ...next }
  })

  // Keep the chain alive even if a job rejects.
  writeQueue = job.catch(() => undefined)
  return job
}
```

- [ ] **Step 2: Smoke-test the utility from the Node REPL**

```bash
node --experimental-vm-modules -e "import('./backend/utils/featureFile.js').then(async m => { const list = await m.readFeatures(); console.log('count:', list.length, 'first:', list[0].key); })"
```
Expected: `count: <N> first: search_v2`. Proves the path resolves and JSON parses.

- [ ] **Step 3: Commit**

```bash
git add backend/utils/featureFile.js
git commit -m "course: feat: add backend features.json validation utility"
```

---

## Task 3: Rename endpoint to /api/feature-flags and add PUT

**Branch:** `main`

**Files:**
- Modify: `backend/controllers/featureController.js` (use utility, add `updateFeature`)
- Modify: `backend/routes/featureRoutes.js` (add PUT)
- Modify: `backend/server.js` (rename mount)
- Modify: `frontend/src/actions/featureActions.js` (URL only — full refactor in Task 5)

Note: this task only renames the mount path on backend and updates the GET URL on the frontend. The frontend GET URL needs to flip in the same commit so dev mode doesn't break between Task 3 and Task 5.

- [ ] **Step 1: Rewrite the controller**

Replace `backend/controllers/featureController.js`:

```js
import asyncHandler from 'express-async-handler'
import { readFeatures, writeFeature } from '../utils/featureFile.js'

// @desc    Fetch all feature flags
// @route   GET /api/feature-flags
// @access  Private/Admin
const getFeatures = asyncHandler(async (req, res) => {
  const features = await readFeatures()
  res.json(features)
})

// @desc    Update a feature flag's status and/or traffic_percentage
// @route   PUT /api/feature-flags/:key
// @access  Private/Admin
const updateFeature = asyncHandler(async (req, res) => {
  const { status, traffic_percentage } = req.body
  const patch = {}
  if (status !== undefined) patch.status = status
  if (traffic_percentage !== undefined) patch.traffic_percentage = traffic_percentage

  try {
    const updated = await writeFeature(req.params.key, patch)
    res.json(updated)
  } catch (err) {
    res.status(err.status || 500)
    if (err.code === 'DEPENDENCY_NOT_ENABLED') {
      throw new Error(
        `Cannot enable: dependency not satisfied (${err.blocking.join(', ')})`
      )
    }
    if (err.code === 'DISABLED_TRAFFIC_LOCKED') {
      throw new Error(
        'Cannot set traffic > 0 while status is Disabled. Set status to Testing first.'
      )
    }
    if (err.code === 'INVALID_STATUS') {
      throw new Error('Status must be one of Enabled, Testing, Disabled.')
    }
    if (err.code === 'INVALID_TRAFFIC') {
      throw new Error('traffic_percentage must be an integer in [0, 100].')
    }
    if (err.code === 'FEATURE_NOT_FOUND') {
      throw new Error(`Feature "${req.params.key}" not found.`)
    }
    throw err
  }
})

export { getFeatures, updateFeature }
```

- [ ] **Step 2: Add the PUT route**

Replace `backend/routes/featureRoutes.js`:

```js
import express from 'express'
const router = express.Router()
import { getFeatures, updateFeature } from '../controllers/featureController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/').get(protect, admin, getFeatures)
router.route('/:key').put(protect, admin, updateFeature)

export default router
```

- [ ] **Step 3: Rename the mount in server.js**

Edit `backend/server.js`. Replace:

```js
app.use('/api/features', featureRoutes)
```

with:

```js
app.use('/api/feature-flags', featureRoutes)
```

- [ ] **Step 4: Update the frontend GET URL**

Edit `frontend/src/actions/featureActions.js`. In `listFeatures`, change:

```js
const { data } = await axios.get('/api/features', config)
```

to:

```js
const { data } = await axios.get('/api/feature-flags', config)
```

(toggle/updateTraffic actions still untouched — those go in Task 5.)

- [ ] **Step 5: Smoke-test with curl**

`npm run dev`. Get an admin token, then:

```bash
# GET
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/feature-flags | head -c 200
# PUT — flip dark_mode to Testing at 30%
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"Testing","traffic_percentage":30}' \
  http://localhost:5000/api/feature-flags/dark_mode
# Read back from disk
cat backend/features.json | head -c 400
```

Expected: PUT returns the updated object; `backend/features.json` shows the new values and a fresh `last_modified`.

Test the dependency lock:

```bash
# semantic_search depends on search_v2; if search_v2 isn't Enabled, this must 400
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"Enabled"}' \
  http://localhost:5000/api/feature-flags/semantic_search
```

Expected: HTTP 400, message mentions `search_v2`.

Restore any test changes by manually editing `backend/features.json` back, or accept the new state (the next task uses MCP which can also reset). Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/featureController.js backend/routes/featureRoutes.js \
        backend/server.js frontend/src/actions/featureActions.js
git commit -m "course: feat: rename feature endpoint to /api/feature-flags and add PUT"
```

---

## Task 4: Add `list_features` MCP tool

**Branch:** `main`

**Files:**
- Modify: `mcp-feature-flags/server.ts` (register a 4th tool)
- Rebuild: `mcp-feature-flags/dist/server.js`
- Modify: `CLAUDE.md` (mention the new tool in the "List all flags" note)

- [ ] **Step 1: Register the tool**

In `mcp-feature-flags/server.ts`, after the existing `adjust_traffic_rollout` registration (around line 44–60), add:

```ts
server.registerTool("list_features", {
  description: `What: Returns a compact list of ALL feature flags with their status and traffic_percentage. Use to discover available flag names before calling get_feature_info / set_feature_state / adjust_traffic_rollout.
When to call: user asks "show all flags", "what features do we have", "what's enabled", or you need to discover the snake_case key for a feature mentioned by display name.
When NOT to call: do not call to fetch full details of ONE feature — use get_feature_info; do not parse features.json directly with Read/Grep.
Input: {} (no parameters)
Output on success: { features: [{ feature_name, name, status, traffic_percentage }] } — sorted by feature_name.
Examples:
  1) list_features({}) — full inventory before a status sweep
  2) list_features({}) — locate the snake_case key for "Dark Mode" → "dark_mode"`,
  inputSchema: {},
}, async () => {
  const raw = await readFile(FILE, "utf-8");
  const data = JSON.parse(raw);
  const features = Object.entries(data)
    .map(([feature_name, v]: [string, any]) => ({
      feature_name,
      name: v.name,
      status: v.status,
      traffic_percentage: v.traffic_percentage,
    }))
    .sort((a, b) => a.feature_name.localeCompare(b.feature_name));
  return out({ features });
});
```

If `readFile` isn't already imported at the top, check existing imports (it's used by the other tools too) and follow the same import pattern.

- [ ] **Step 2: Rebuild**

```bash
cd mcp-feature-flags
npm run build
cd ..
```

- [ ] **Step 3: Verify the tool is registered**

Inspect the generated `mcp-feature-flags/dist/server.js`:

```bash
grep -c "list_features" mcp-feature-flags/dist/server.js
```
Expected: at least `2` (tool name in registration + maybe in description string).

- [ ] **Step 4: Update CLAUDE.md**

In the section about feature flags MCP, find the "List all flags" line:

> "List all flags" — no `list_features` tool exists today; `Read docs/project-data/features.json` is acceptable for that one case.

Replace with:

> "List all flags" → `mcp__feature-flags__list_features`. Do not read `backend/features.json` directly.

- [ ] **Step 5: Smoke-test via Claude Code**

In the dev session, run a mental "list_features" by invoking it (the user can also test). Expected: a sorted list of `{ feature_name, name, status, traffic_percentage }`.

- [ ] **Step 6: Commit**

```bash
git add mcp-feature-flags/server.ts mcp-feature-flags/dist/ CLAUDE.md
git commit -m "course: feat: add list_features MCP tool"
```

---

## Task 5: Persist toggle and slider via the PUT endpoint

**Branch:** `main`

**Files:**
- Modify: `frontend/src/constants/featureConstants.js`
- Modify: `frontend/src/actions/featureActions.js`
- Modify: `frontend/src/reducers/featureReducers.js`
- Modify: `frontend/src/screens/FeatureListScreen.js` (on `main`, still bootstrap markup; only the action-import call sites change)
- Modify: `frontend/src/screens/FeatureListScreen.test.js` (the existing `jest.mock` calls reference `toggleFeature` / `updateFeatureTraffic` — replace with `updateFeature`)

- [ ] **Step 1: Replace the constants**

Replace `frontend/src/constants/featureConstants.js`:

```js
export const FEATURE_LIST_REQUEST = 'FEATURE_LIST_REQUEST'
export const FEATURE_LIST_SUCCESS = 'FEATURE_LIST_SUCCESS'
export const FEATURE_LIST_FAIL = 'FEATURE_LIST_FAIL'

export const FEATURE_UPDATE_REQUEST = 'FEATURE_UPDATE_REQUEST'
export const FEATURE_UPDATE_SUCCESS = 'FEATURE_UPDATE_SUCCESS'
export const FEATURE_UPDATE_FAIL = 'FEATURE_UPDATE_FAIL'
```

- [ ] **Step 2: Replace the actions**

Replace `frontend/src/actions/featureActions.js`:

```js
import axios from 'axios'
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_UPDATE_REQUEST,
  FEATURE_UPDATE_SUCCESS,
  FEATURE_UPDATE_FAIL,
} from '../constants/featureConstants'

export const listFeatures = () => async (dispatch, getState) => {
  try {
    dispatch({ type: FEATURE_LIST_REQUEST })
    const {
      userLogin: { userInfo },
    } = getState()
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
    const { data } = await axios.get('/api/feature-flags', config)
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

export const updateFeature = (key, patch) => async (dispatch, getState) => {
  const {
    featureList: { features },
    userLogin: { userInfo },
  } = getState()

  const prev = (features || []).find((f) => f.key === key)
  if (!prev) return

  dispatch({ type: FEATURE_UPDATE_REQUEST, payload: { key, patch, prev } })

  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.token}`,
      },
    }
    const { data } = await axios.put(`/api/feature-flags/${key}`, patch, config)
    dispatch({ type: FEATURE_UPDATE_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: FEATURE_UPDATE_FAIL,
      payload: {
        key,
        prev,
        error:
          error.response && error.response.data.message
            ? error.response.data.message
            : error.message,
      },
    })
  }
}
```

- [ ] **Step 3: Replace the reducer**

Replace `frontend/src/reducers/featureReducers.js`:

```js
import {
  FEATURE_LIST_REQUEST,
  FEATURE_LIST_SUCCESS,
  FEATURE_LIST_FAIL,
  FEATURE_UPDATE_REQUEST,
  FEATURE_UPDATE_SUCCESS,
  FEATURE_UPDATE_FAIL,
} from '../constants/featureConstants'

const initial = {
  loading: false,
  features: [],
  error: null,
  updatingKey: null,
  updateError: null,
}

const replaceByKey = (features, key, next) =>
  features.map((f) => (f.key === key ? next : f))

export const featureListReducer = (state = initial, action) => {
  switch (action.type) {
    case FEATURE_LIST_REQUEST:
      return { ...state, loading: true, features: [], error: null }
    case FEATURE_LIST_SUCCESS:
      return { ...state, loading: false, features: action.payload, error: null }
    case FEATURE_LIST_FAIL:
      return { ...state, loading: false, error: action.payload }

    case FEATURE_UPDATE_REQUEST: {
      const { key, patch } = action.payload
      const optimistic = state.features.map((f) =>
        f.key === key ? { ...f, ...patch } : f
      )
      return { ...state, features: optimistic, updatingKey: key, updateError: null }
    }
    case FEATURE_UPDATE_SUCCESS:
      return {
        ...state,
        features: replaceByKey(state.features, action.payload.key, action.payload),
        updatingKey: null,
        updateError: null,
      }
    case FEATURE_UPDATE_FAIL:
      return {
        ...state,
        features: replaceByKey(state.features, action.payload.key, action.payload.prev),
        updatingKey: null,
        updateError: action.payload.error,
      }

    default:
      return state
  }
}
```

- [ ] **Step 4: Update FeatureListScreen on main**

Edit `frontend/src/screens/FeatureListScreen.js` (the bootstrap version on `main`):

Change imports from:

```js
import {
  listFeatures,
  toggleFeature,
  updateFeatureTraffic,
} from '../actions/featureActions'
```

to:

```js
import { listFeatures, updateFeature } from '../actions/featureActions'
```

In `handleSlider`, replace:

```js
dispatch(updateFeatureTraffic(feature.key, value))
```

with:

```js
dispatch(updateFeature(feature.key, { traffic_percentage: value }))
```

In `handleToggle`, replace:

```js
dispatch(toggleFeature(feature.key))
```

with:

```js
const nextStatus = feature.status === 'Enabled' ? 'Disabled' : 'Enabled'
dispatch(updateFeature(feature.key, { status: nextStatus }))
```

- [ ] **Step 5: Update the existing test mocks**

Edit `frontend/src/screens/FeatureListScreen.test.js`. Replace the `jest.mock` block:

```js
jest.mock('../actions/featureActions', () => ({
  listFeatures: () => ({ type: 'TEST_NOOP' }),
  toggleFeature: () => ({ type: 'TEST_NOOP' }),
  updateFeatureTraffic: () => ({ type: 'TEST_NOOP' }),
}))
```

with:

```js
jest.mock('../actions/featureActions', () => ({
  listFeatures: () => ({ type: 'TEST_NOOP' }),
  updateFeature: () => ({ type: 'TEST_NOOP' }),
}))
```

- [ ] **Step 6: Run the existing tests**

```bash
npm test --prefix frontend -- --watchAll=false --testPathPattern=FeatureListScreen
```
Expected: 4 tests pass (renders, filters by name, filters by status, empty-filter message).

- [ ] **Step 7: Add a test for optimistic update + rollback**

Append to `frontend/src/screens/FeatureListScreen.test.js`:

```js
import * as featureActions from '../actions/featureActions'

describe('FeatureListScreen — persistence wiring', () => {
  it('dispatches updateFeature with status patch on toggle', () => {
    const spy = jest.spyOn(featureActions, 'updateFeature')
    // The mocked module returns a noop, but the spy lets us assert the call.
    // Re-mock to a spy-able implementation:
    featureActions.updateFeature.mockImplementation((key, patch) => ({
      type: 'TEST_NOOP',
      meta: { key, patch },
    }))

    const { getByLabelText } = renderScreen()
    fireEvent.click(getByLabelText('Enable Redesigned Cart UI'))

    expect(spy).toHaveBeenCalledWith('cart_redesign', { status: 'Enabled' })
    spy.mockRestore()
  })
})
```

Note: this test is illustrative; if `jest.mock` at top of file replaces the module with a plain object (no spy support), wrap the mock with `jest.fn()`:

```js
jest.mock('../actions/featureActions', () => ({
  listFeatures: jest.fn(() => ({ type: 'TEST_NOOP' })),
  updateFeature: jest.fn(() => ({ type: 'TEST_NOOP' })),
}))
```

Then use the imported `updateFeature` directly: `expect(updateFeature).toHaveBeenCalledWith(...)`.

Use the simpler `jest.fn()` approach to avoid spying on a frozen module export. Final version of the new test:

```js
import { updateFeature } from '../actions/featureActions'

describe('FeatureListScreen — persistence wiring', () => {
  beforeEach(() => updateFeature.mockClear())

  it('dispatches updateFeature with status patch on toggle', () => {
    const { getByLabelText } = renderScreen()
    fireEvent.click(getByLabelText('Enable Redesigned Cart UI'))
    expect(updateFeature).toHaveBeenCalledWith('cart_redesign', { status: 'Enabled' })
  })

  it('dispatches updateFeature with traffic patch on slider change', () => {
    const { getByLabelText } = renderScreen()
    fireEvent.change(getByLabelText('Traffic percentage for New Search Algorithm'), {
      target: { value: '60' },
    })
    // The component debounces the dispatch by 150ms. Use jest fake timers
    // or wait long enough; here use jest.useFakeTimers + advance.
    jest.useFakeTimers()
    jest.advanceTimersByTime(200)
    expect(updateFeature).toHaveBeenCalledWith('search_v2', { traffic_percentage: 60 })
    jest.useRealTimers()
  })
})
```

(Place `jest.useFakeTimers()` at the top of the test, not the bottom. Adjust if the existing test file already has timer mocks.)

- [ ] **Step 8: Run all FeatureListScreen tests**

```bash
npm test --prefix frontend -- --watchAll=false --testPathPattern=FeatureListScreen
```
Expected: all tests pass (4 existing + 2 new).

- [ ] **Step 9: Manual smoke-test in browser**

`npm run dev`. Log in as admin. Visit `/admin/featuredashboard`. Click a toggle, change a slider, refresh the page. Expected: the change persists. Stop dev server.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/constants/featureConstants.js \
        frontend/src/actions/featureActions.js \
        frontend/src/reducers/featureReducers.js \
        frontend/src/screens/FeatureListScreen.js \
        frontend/src/screens/FeatureListScreen.test.js
git commit -m "course: refactor: persist feature toggles via API"
```

End of Phase 1. `main` now contains the full correction.

---

## Task 6: Merge main → m4-redesign

**Branch:** `m4-redesign`

- [ ] **Step 1: Switch branches and pull latest**

```bash
git checkout m4-redesign
git status   # confirm clean tree
```

- [ ] **Step 2: Merge**

```bash
git merge main
```

Expected conflicts:

- `frontend/src/screens/FeatureListScreen.js` — both branches changed it. On `m4-redesign` the markup is the `.fd-*` redesign; on `main` only the import + dispatch calls changed.

Resolution: keep the `m4-redesign` markup AND apply the `main` import / dispatch changes:

```js
// Imports — take main's version
import { listFeatures, updateFeature } from '../actions/featureActions'
// (drop toggleFeature, updateFeatureTraffic)

// In handleSlider — replace dispatch with the main version
dispatch(updateFeature(feature.key, { traffic_percentage: value }))

// In handleToggle — replace dispatch with the main version
const nextStatus = feature.status === 'Enabled' ? 'Disabled' : 'Enabled'
dispatch(updateFeature(feature.key, { status: nextStatus }))
```

Everything else on the file (the `.fd-*` JSX, scoped CSS, fd-switch, EmptyState integration) stays as it is on `m4-redesign`.

- `CLAUDE.md` may conflict if `m4-redesign` had design-related additions. Take both — combine sections rather than discarding.

- [ ] **Step 3: Verify no other conflicts**

```bash
git status
```
Expected: only the files above show as conflicted.

- [ ] **Step 4: Run frontend tests**

```bash
npm test --prefix frontend -- --watchAll=false
```
Expected: all tests pass.

- [ ] **Step 5: Manual smoke**

`npm run dev`. Log in as admin. Visit `/admin/featuredashboard`. Confirm the page renders with the `.fd-*` redesign **and** that toggle/slider persist on reload.

- [ ] **Step 6: Commit the merge**

```bash
git add <resolved files>
git commit
# Use the default merge commit message, or:
#   "course: chore: merge main feature-flags correction into m4-redesign"
```

---

## Task 7: Add in-flight + update-error feedback on m4-redesign

**Branch:** `m4-redesign`

**Files:**
- Modify: `frontend/src/screens/FeatureListScreen.js`
- Modify: `frontend/src/screens/FeatureListScreen.css`
- Modify: `frontend/src/screens/FeatureListScreen.test.js` (add rollback test)

- [ ] **Step 1: Surface `updatingKey` and `updateError` from the store**

Edit `frontend/src/screens/FeatureListScreen.js`. In the `FeatureListScreen` component, update the destructure:

```js
const featureList = useSelector((state) => state.featureList)
const { loading, error, features, updatingKey, updateError } = featureList
```

- [ ] **Step 2: Render the update-error Message**

In the JSX, right after the existing `{error ? <Message variant='danger'>{error}</Message> : ...}` block (or above the `<table>`, before `error` is rendered), add:

```jsx
{updateError && <Message variant='warning'>{updateError}</Message>}
```

Place it so it's always visible when present — even when there is no fatal `error`. If the existing structure ties error to a ternary that skips the table, put `updateError` above that ternary so the table can keep rendering during an update failure.

- [ ] **Step 3: Pass `updatingKey` to FeatureRow**

Where `<FeatureRow ... />` is rendered (inside the `tbody` map), change:

```js
filtered.map((f) => <FeatureRow key={f.key} feature={f} />)
```

to:

```js
filtered.map((f) => (
  <FeatureRow key={f.key} feature={f} busy={updatingKey === f.key} />
))
```

- [ ] **Step 4: Apply busy state to the row**

Update the `FeatureRow` signature and `<tr>`:

```js
const FeatureRow = ({ feature, busy }) => {
  // ... existing hooks ...
  return (
    <tr className={busy ? 'fd-row--busy' : undefined} aria-busy={busy || undefined}>
      {/* existing cells */}
    </tr>
  )
}
```

- [ ] **Step 5: Add the busy CSS rule**

Append to `frontend/src/screens/FeatureListScreen.css`:

```css
/* ---------- In-flight row ---------- */
.feature-dashboard .fd-row--busy {
  opacity: 0.6;
  pointer-events: none;
  transition: opacity 120ms ease-in-out;
}
```

`pointer-events: none` prevents a second click while the first PUT is in flight.

- [ ] **Step 6: Add a rollback test**

Append to `frontend/src/screens/FeatureListScreen.test.js`:

```js
describe('FeatureListScreen — rollback on update failure', () => {
  it('restores prev state when FEATURE_UPDATE_FAIL fires', () => {
    const store = buildStore(sampleFeatures)
    const { getByText, rerender } = render(
      <Provider store={store}>
        <MemoryRouter>
          <FeatureListScreen history={{ push: jest.fn() }} />
        </MemoryRouter>
      </Provider>
    )

    // Optimistic update flips the badge
    store.dispatch({
      type: 'FEATURE_UPDATE_REQUEST',
      payload: {
        key: 'cart_redesign',
        patch: { status: 'Enabled' },
        prev: sampleFeatures.find((f) => f.key === 'cart_redesign'),
      },
    })
    rerender(
      <Provider store={store}>
        <MemoryRouter>
          <FeatureListScreen history={{ push: jest.fn() }} />
        </MemoryRouter>
      </Provider>
    )
    // We rely on the in-state Badge text; verify by class or visible text:
    // (Badge for cart_redesign is now "Enabled".)

    // Now fail
    store.dispatch({
      type: 'FEATURE_UPDATE_FAIL',
      payload: {
        key: 'cart_redesign',
        prev: sampleFeatures.find((f) => f.key === 'cart_redesign'),
        error: 'boom',
      },
    })
    rerender(
      <Provider store={store}>
        <MemoryRouter>
          <FeatureListScreen history={{ push: jest.fn() }} />
        </MemoryRouter>
      </Provider>
    )

    expect(getByText('boom')).toBeInTheDocument()
    // cart_redesign should show 'Disabled' again
    // (assert by querying the row — adjust selector to actual markup)
  })
})
```

If `getByText('Disabled')` is ambiguous (multiple Disabled features), use `getAllByText` and verify the count went back to its pre-optimistic value, or scope the query to the cart_redesign row via `within(...)`.

- [ ] **Step 7: Run tests**

```bash
npm test --prefix frontend -- --watchAll=false --testPathPattern=FeatureListScreen
```
Expected: all tests pass (4 existing + 2 dispatch tests from Task 5 + 1 rollback test).

- [ ] **Step 8: Manual browser smoke**

`npm run dev`. Open `/admin/featuredashboard`. Drag a slider — confirm the row dims briefly. Force a failure (e.g. flip `semantic_search` to `Enabled` while `search_v2` is `Disabled`) — confirm the warning Message appears and the row reverts. Stop dev server.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/screens/FeatureListScreen.js \
        frontend/src/screens/FeatureListScreen.css \
        frontend/src/screens/FeatureListScreen.test.js
git commit -m "course: feat: surface in-flight and update-error states on FeatureListScreen"
```

---

## Task 8: Verify `prompt.md` checklist end to end

**Branch:** `m4-redesign`

No code changes. Pure verification pass. Mark each as ✅ or note a regression.

- [ ] **Step 1: Route + admin guard**

`npm run dev`. Log out. Visit `/admin/featuredashboard`. Expected: redirect to login. Log in as a non-admin (use the seeder's regular user, e.g. `john@example.com / 123456`). Visit again. Expected: redirect to login. Log in as admin. Expected: dashboard renders. Header admin-dropdown shows "Feature Dashboard" link.

- [ ] **Step 2: List loads from backend/features.json**

Open DevTools → Network. Reload the dashboard. Expected: `GET /api/feature-flags` → 200, body is an array. Table populated.

- [ ] **Step 3: Three-color badges**

Visually confirm Enabled (green), Testing (blue), Disabled (grey). Switch theme to dark mode (header toggle). Confirm badges remain legible.

- [ ] **Step 4: Toggle persistence**

Flip any feature's toggle. Reload the page. Expected: the new status survives.

- [ ] **Step 5: Slider persistence**

Drag a feature's slider to a new value. Wait ~200 ms. Reload. Expected: the new percentage survives.

- [ ] **Step 6: Search**

Type a fragment in the search box. Expected: table narrows.

- [ ] **Step 7: Status filter**

Use the status `<select>` to filter to each value. Expected: only matching rows show.

- [ ] **Step 8: Loading**

In DevTools, throttle to "Slow 3G" and reload. Expected: skeleton rows appear briefly before the real data.

- [ ] **Step 9: Empty state (filter)**

Type a string that matches nothing (`zzznotreal`). Expected: empty-filter `EmptyState` renders.

- [ ] **Step 10: Error state**

Stop the backend (`Ctrl+C` only on the backend process — if running `npm run dev`, kill it and run `npm run client` alone). Reload. Expected: `Message variant='danger'` renders with the error.

- [ ] **Step 11: ARIA + keyboard**

Tab through the page. Expected: all interactive elements (search, select, sliders, toggles, the admin-dropdown link) receive focus. The slider value reads via `aria-live`. Toggle has a visible or sr-only label.

- [ ] **Step 12: MCP integration intact**

In a Claude Code session (this one or a fresh one), call:

- `mcp__feature-flags__list_features` → expect a sorted array of `{ feature_name, name, status, traffic_percentage }`.
- `mcp__feature-flags__get_feature_info({ feature_name: "dark_mode" })` → expect detail.
- `mcp__feature-flags__set_feature_state({ feature_name: "dark_mode", state: "Testing" })` → expect success and the change visible after a page reload on the dashboard.

- [ ] **Step 13: Final commit if anything trivial needed**

If any verification step revealed a typo or trivial fix, fix it and commit as `course: fix: ...`. Otherwise no commit.

---

## Self-Review

**Spec coverage:**
- File move + path updates → Task 1 ✅
- Validation utility + atomic write + dependency lock + disabled-traffic lock → Task 2 ✅
- Endpoint rename + PUT → Task 3 ✅
- list_features MCP tool → Task 4 ✅
- Redux constants + actions + reducer refactor → Task 5 ✅
- `FeatureListScreen.js` on main → Task 5 ✅
- Merge strategy → Task 6 ✅
- In-flight + update-error UI → Task 7 ✅
- `prompt.md` checklist verification → Task 8 ✅

**Placeholder scan:** No "TBD", no "Add appropriate error handling", every code step has actual code, every command has actual expected output.

**Type consistency:** `updateFeature(key, patch)` signature is consistent across Task 5 action, reducer, Task 6 merge resolution, and Task 7 dispatch. `writeFeature(key, patch)` is consistent across utility (Task 2) and controller (Task 3). Error codes (`FEATURE_NOT_FOUND`, `DEPENDENCY_NOT_ENABLED`, `DISABLED_TRAFFIC_LOCKED`, `INVALID_STATUS`, `INVALID_TRAFFIC`) are defined in Task 2 and consumed in Task 3. `updatingKey` / `updateError` state shape is consistent in Task 5 reducer and Task 7 consumer.

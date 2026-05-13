# Feature Flags Correction — Design Spec

**Date:** 2026-05-13
**Branches affected:** `main`, then `m4-redesign`
**Trigger:** `correction.md` (resubmission feedback) + re-validation against `prompt.md` checklist.

## Problem

The first submission shipped a feature dashboard, but the resubmission feedback flagged three remaining gaps:

1. `features.json` lives in `docs/project-data/` — it is not a backend runtime artifact, just an MCP-side file. The dashboard reads it through an Express endpoint that resolves into the docs tree.
2. The MCP `feature-flags` server exposes 3 tools (`get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`); a 4th tool `list_features` is missing, so agents fall back to grepping the JSON file directly.
3. Toggle and slider on the admin page mutate Redux state only — there is no PUT endpoint, so changes do not survive a page reload, and the file does not behave like a "live runtime".

`prompt.md` reiterates the dashboard behavior (search, filter, three-color badges, slider, toggle, loading / empty / error states, ARIA). Most of those are already implemented; persistence is the gap.

The work also needs to land on `m4-redesign`. On that branch `FeatureListScreen` has already been migrated to design tokens through a screen-scoped CSS approach (`.feature-dashboard .fd-*` rules using `var(--foreground)`, `var(--primary)`, etc., custom `.fd-switch`, `.fd-slider`, `.fd-badge`, `EmptyState` integration, loading skeleton, error message, ARIA labels, separate name + monospace key). The visual side of the `prompt.md` checklist is therefore already satisfied on `m4-redesign`. The remaining gap on that branch is the same one we fix on `main` — toggle/slider don't persist.

Note: the rest of the admin surface on `m4-redesign` uses M4 atoms (`DataTable`, `Badge` atom, `admin-page` shared styles), while `FeatureListScreen` goes its own route with scoped CSS. Both are valid design-token expressions; rewriting the existing scoped CSS into `DataTable` would be a refactor outside this task's scope.

## Goals

- `features.json` is a backend runtime file, read on every request.
- Toggle and slider persist to that file through an admin-only PUT endpoint.
- MCP server reads and writes the same file; gains a `list_features` tool.
- The `prompt.md` checklist passes end to end on `m4-redesign`, with persistence now backed by the real PUT endpoint.

## Non-goals

- No production-grade write coordination between MCP and Express (single-process atomic write + in-process queue is enough for a coursework deliverable; cross-process flock is over-engineering).
- No new MCP tool beyond `list_features`.
- No move of feature-flag logic into a Mongoose model — the file is the contract with MCP and the course brief.
- No refactor of admin screens outside `FeatureListScreen`.
- No visual redesign of `FeatureListScreen` on `m4-redesign`. The existing scoped-CSS implementation already passes the visual checklist; rewriting it to use `DataTable` / `Badge` atoms would be out-of-scope churn.

## Architecture

```
                  ┌──────────────────────────────┐
                  │     backend/features.json    │
                  └──────────────┬───────────────┘
              read/write         │         read/write
        ┌────────────────────────┴─────────────────────────┐
        │                                                  │
┌───────────────┐                                ┌──────────────────────┐
│ Express API   │                                │ MCP feature-flags    │
│ /api/feature- │                                │ server.ts            │
│  flags        │                                │ (get/set/adjust/list)│
└───────┬───────┘                                └──────────────────────┘
        │ GET (list)
        │ PUT  /:key  (admin only)
        │
┌───────▼───────────────────────────┐
│ Frontend / Redux                  │
│ FeatureListScreen → DataTable     │
│ • listFeatures   (GET)            │
│ • updateFeature  (PUT optimistic) │
└───────────────────────────────────┘
```

Two writers share one file. Atomic POSIX write (`fs.writeFile` to temp + `fs.rename`) plus an in-process promise queue on the Express side keep concurrent admin clicks safe. Cross-process races against MCP are documented as a known limitation.

## Backend

### File location

- `backend/features.json` (new).
- `docs/project-data/features.json` is deleted.

### Endpoint

- `GET /api/feature-flags` — admin-only. Reads file fresh on every request. Returns `[{ key, name, description, status, traffic_percentage, last_modified, dependencies?, targeted_segments?, rollout_strategy? }, ...]`.
- `PUT /api/feature-flags/:key` — admin-only. Body `{ status?, traffic_percentage? }`. Returns the updated feature.

Validation (shared with MCP through one utility):

- `status` ∈ `{ "Enabled", "Testing", "Disabled" }` if present.
- `traffic_percentage` ∈ `[0, 100]`, integer, if present.
- **Dependency lock:** cannot set `status: "Enabled"` while any dependency is not `Enabled`. Server returns `400` with `{ error: "DEPENDENCY_NOT_ENABLED", blocking_dependencies: [...] }`.
- **Disabled-traffic lock:** cannot set `traffic_percentage > 0` while current `status === "Disabled"`. Server returns `400` with `{ error: "DISABLED_TRAFFIC_LOCKED" }`.
- On success: server stamps `last_modified` with today's date (UTC), persists file atomically.

### Utility

`backend/utils/featureFile.js`:

- `readFeatures()` — reads file, returns parsed object.
- `writeFeature(key, patch)` — applies patch, validates, atomically writes, returns the new feature. Internally serializes through a single shared promise queue.
- `validateEnable(features, key)` — pure function returning `{ ok: true } | { ok: false, blocking: [...] }`. Reused by Express controller and (post-rebuild) by MCP server.

### Server mount

In `backend/server.js`, `/api/features` is replaced by `/api/feature-flags`. The route module is renamed to match (`featureFlagRoutes.js` is not used — keeping `featureRoutes.js` because it's already established and only the mount path changes).

## MCP server (`mcp-feature-flags/server.ts`)

- File path constant updated from `../../docs/project-data/features.json` to `../../backend/features.json`. The `dist/` build is regenerated and committed (`.mcp.json` points to `dist/server.js`).
- New tool `list_features` (no parameters): returns `{ features: [{ feature_name, name, status, traffic_percentage }, ...] }`, sorted alphabetically by `feature_name`. Tool description follows the established style (What / When to call / When NOT / Input / Output / Examples).
- No change to `get_feature_info`, `set_feature_state`, `adjust_traffic_rollout` beyond the file-path constant.

## Frontend (correction commits, before m4 redesign)

### Constants (`featureConstants.js`)

Replace:

- `FEATURE_TOGGLE`, `FEATURE_TRAFFIC_UPDATE` (local-only) →
- `FEATURE_UPDATE_REQUEST`, `FEATURE_UPDATE_SUCCESS`, `FEATURE_UPDATE_FAIL`.

`FEATURE_LIST_*` are unchanged.

### Actions (`featureActions.js`)

- `listFeatures()` — same shape, URL changes to `/api/feature-flags`.
- `updateFeature(key, patch)` — single thunk used by both toggle and slider. Dispatches `UPDATE_REQUEST` with the previous feature snapshot (for rollback), calls `axios.put('/api/feature-flags/:key', patch, authConfig)`, dispatches `UPDATE_SUCCESS` with the server response (canonical `last_modified`). On failure dispatches `UPDATE_FAIL` with `{ key, prev, error }`.

### Reducer (`featureListReducer`)

Single reducer that owns the features array:

- `LIST_REQUEST` → `{ loading: true, features: [] }`
- `LIST_SUCCESS` → `{ loading: false, features: payload }`
- `LIST_FAIL` → `{ loading: false, error }`
- `UPDATE_REQUEST` → optimistic patch on the matching key, set `updatingKey`, clear `updateError`.
- `UPDATE_SUCCESS` → replace the matching feature with the server response, clear `updatingKey`.
- `UPDATE_FAIL` → restore `prev`, clear `updatingKey`, set `updateError`.

This intentionally consolidates the list and the update into one reducer instead of following the project's "one reducer per async operation" convention. Both operate on the same array; splitting them would create two sources of truth for `features`. The decision is local to this slice; project convention still holds elsewhere.

### `localStorage` persistence

None. Features are server state, not user state.

## UI changes on `m4-redesign`

The existing layout, columns, scoped CSS, EmptyState wiring, and ARIA stay as they are. The merge from `main` brings in the new `updateFeature(key, patch)` thunk and the consolidated reducer; `FeatureListScreen.js` is wired to those, plus two small additions:

- **In-flight feedback.** When the row's `key === updatingKey`, the `<tr>` renders with `aria-busy='true'` and a class (e.g. `fd-row--busy`) that the existing scoped CSS dims by ~60% opacity. Visual cue for the slider/toggle that wait on a server round-trip.
- **Update error surface.** Above the table, after the existing `error` message, add `{updateError && <Message variant='warning'>{updateError}</Message>}`. Same `Message` component already imported.

That is the entire UI delta on `m4-redesign`. No DataTable migration, no Badge-atom swap, no markup restructuring. Toggle and slider continue to call `dispatch(...)`; only the action thunk underneath changes.

## Migration plan

### Phase 1 — `main` (single PR)

Commit series, each one independently green:

1. **chore: move features.json from docs/project-data to backend** — `git mv`, update `mcp-feature-flags/server.ts` path constant + rebuilt `dist/`, update `featureController.js`, update `CLAUDE.md` (Feature flags MCP section + endpoint list).
2. **feat: add backend features.json validation utility** — `backend/utils/featureFile.js` with `readFeatures`, `writeFeature` (atomic temp + rename, in-process queue), `validateEnable`, `validateTraffic`.
3. **feat: rename feature endpoint to /api/feature-flags and add PUT** — routes, controller, `server.js` mount. Dependency / disabled-traffic locks shared with MCP via the utility.
4. **feat: add list_features MCP tool** — `mcp-feature-flags/server.ts` + rebuilt `dist/` + `CLAUDE.md` mention.
5. **refactor: persist feature toggles via API** — frontend constants, actions, reducer, plus `FeatureListScreen.js` wired to `updateFeature` (still on bootstrap markup on `main`). Update `FeatureListScreen.test.js` if the existing tests cover local-only toggle behavior.

### Phase 2 — merge `main` → `m4-redesign`

```
git checkout m4-redesign
git merge main
```

Expected conflicts: `CLAUDE.md` (minor, resolve by combining sections), possibly `server.js` mount block. All feature-flag related files on `m4-redesign` are identical to `main` so they merge cleanly.

### Phase 3 — `m4-redesign` (single commit)

6. **feat: surface in-flight + update-error states on FeatureListScreen** — wire `updatingKey` to row class + `aria-busy`, surface `updateError` via the existing `Message` component, add scoped CSS rule for `.fd-row--busy`. Extend `FeatureListScreen.test.js` with optimistic-update + rollback assertions (existing tests for search/filter/empty are kept).

### Phase 4 — verify against `prompt.md`

| Checklist item | Where it is satisfied | How to verify |
|---|---|---|
| `/admin/featuredashboard` route + isAdmin guard + admin-dropdown link | Inherited, untouched | Visit logged out → redirect to `/login`; logged in as non-admin → redirect; admin sees dropdown link |
| List from `features.json` | GET `/api/feature-flags` + `listFeatures` thunk | DevTools network panel; table populated |
| Three-color badges | Badge atom variants | Visually in light + dark theme |
| Toggle changes badge color | `UPDATE_SUCCESS` updates `status`; Badge re-renders | Click → badge flips → reload → value persists |
| Slider updates traffic | Optimistic update + PUT | Drag → percent in UI → reload → value persists |
| Search | Local filter on `keyword` | Type substring → table narrows |
| Status filter | Local filter on `statusFilter` | Change `<select>` |
| Loading / Empty / Error | `DataTable loading` + `EmptyState` + `Message` | Throttle network; stop backend; filter to no matches |
| ARIA + keyboard | Layout above | Tab through controls, screen reader sanity check |

## Risks and known limitations

- **MCP ↔ backend write race.** Both processes write the same file. Atomic rename inside each process is fine; cross-process coordination is not implemented. Two writes interleaved at the same millisecond would mean one of the changes is lost. Acceptable for coursework; documented here.
- **`docs/project-data/features.json` references elsewhere.** Before merging Phase 1, grep the repo for any leftover string `docs/project-data/features.json` (CLAUDE.md, seeder scripts, READMEs, ADRs). Anything that still points there breaks silently. Tracked as a checklist item in the implementation plan.
- **`mcp-feature-flags/dist/` committed.** The MCP server is loaded from compiled JS. Phase 1 commits 1 and 4 both touch `dist/`; the build must be regenerated locally (`npm run build` inside `mcp-feature-flags/`) and the diff inspected before committing.
- **Bootswatch theme overrides primary/secondary.** `Disabled` badge uses an inline override on `main` because no built-in variant renders as light grey under this theme. On `m4-redesign` the `Badge` atom owns its own variants — this issue does not apply.
- **`FeatureListScreen.test.js` on `main`.** Existing tests likely assert local toggle behavior; they will fail after Phase 1 commit 5 and must be updated in the same commit.

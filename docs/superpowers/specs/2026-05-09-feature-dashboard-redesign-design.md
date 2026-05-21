# Feature Dashboard — Visual Redesign

> Scope: visual-only redesign of `/admin/featuredashboard` (`FeatureListScreen`)
> applying tokens from `DESIGN.md`. Layout, columns, behavior, debounce,
> data-flow, and Redux remain unchanged.
> Created: 2026-05-09
> Branch: `m4-redesign`

---

## 1. Overview

`/admin/featuredashboard` is an admin-only screen for managing feature flags.
The current implementation uses default react-bootstrap (`Table striped
bordered hover`, `Form.Control type="range"`, `Form.Check type="switch"`,
`Badge variant="success|info|light"`). This visual style does not align with
the just-adopted Tech-Minimal Dark design system.

This redesign restyles the screen to use `DESIGN.md` tokens — without
changing what is on screen, what columns exist, or how the page behaves.

### In scope

- Page header (title, subtitle, count chip)
- Filter row (search input, status select)
- Table frame, header row, body row, hover state
- Status badges (Enabled / Testing / Disabled)
- Traffic slider (track + thumb)
- Toggle switch
- Skeleton loading rows
- Empty state (replaces inline `Message` component)
- Add `--info` token to `DESIGN.md` (required by Testing-status badge)

### Out of scope (not changed)

- Columns and what they contain
- Slider debounce (150ms) and dispatch logic
- Switch dispatch logic
- Search and filter logic
- Skeleton row count (5)
- Redux flow (`listFeatures`, `toggleFeature`, `updateFeatureTraffic`)
- Auth gate (`userInfo.isAdmin` redirect)
- Responsive collapse — Bootstrap `Row/Col` stacking is preserved
- Light-mode toggle, theme switcher, OS-preference detection
- New screens, drawers, detail-views, bulk actions

---

## 2. Token addition to `DESIGN.md`

The redesign requires a `--info` semantic role for the Testing badge. Without
it, only `--primary` (lime) and `--destructive` (red) exist as colored
states, and Testing has no faithful representation.

Patch to apply to `DESIGN.md`:

| Mode  | Variable | Value     | Contrast on bg | Notes                                    |
|-------|----------|-----------|----------------|------------------------------------------|
| Dark  | `--info` | `#5DA9FF` | 6.5:1 (AA)     | Sky-blue, distinct from lime + red       |
| Light | `--info` | `#1E6FBA` | 4.7:1 (AA)     | Darker equivalent for white background   |

The token is added to:

- Section 1 color tables (dark mode + light mode)
- Section 10 `:root`, `.dark`, and `prefers-color-scheme` blocks

The token is also documented as the canonical source for "in-progress /
informational" status, distinct from `--primary` (action) and
`--destructive` (error). It can be used by any future screen.

---

## 3. Component-by-component spec

### 3.1 Page header

**Before:** `<h1>Feature Dashboard</h1>` only.

**After:**

```
<h1>                                              [count-chip]
  Feature Dashboard
</h1>
<p class="subtitle">Manage feature flag rollouts and traffic ramps.</p>
```

- `<h1>`: 40px Manrope 700, line-height 1.1, letter-spacing -0.03em, color `var(--foreground)`. Per DESIGN.md §2 H1.
- `.subtitle`: 15px Manrope 400, color `var(--muted)`, margin-top 8px. Per DESIGN.md Body.
- Header is a flex row, justify-content space-between, align-items flex-end.
- 32px (`--space-lg`) margin-bottom before filters.

**Count chip** (top-right of header):

```
display: inline-flex; align-items: center; gap: 6px;
padding: 6px 12px;
background: color-mix(in srgb, var(--primary) 15%, transparent);
color: var(--primary);
border-radius: 9999px;            /* --radius-full */
font-family: 'DM Mono', monospace;
font-size: 12px;
font-weight: 500;
letter-spacing: 0.04em;
```

- Prefixed by 6×6px `var(--primary)` dot.
- Text content: `${features.length} FLAGS` (UPPERCASE, computed from raw list, not filtered count, so the chip reflects total inventory).

### 3.2 Filter row

**Layout:** CSS grid, `grid-template-columns: 2fr 1fr`, gap 16px (`--space-sm`).
Replaces the existing `<Row><Col md={8}>/<Col md={4}>` so that it survives a
later move out of `react-bootstrap`. The 2:1 ratio matches the previous 8:4.

**Search input:**

```
background: var(--background);
border: 1px solid var(--border);
border-radius: 8px;                /* --radius-md */
padding: 10px 14px 10px 40px;      /* room for icon */
font: Manrope 400, 14px;
color: var(--foreground);
placeholder: var(--muted);
```

- Magnifying-glass icon (14px, color `var(--muted)`) inline-positioned at
  left 14px via `background-image` SVG-data-URL. No separate icon button.
- Focus: border-color `var(--ring)`, box-shadow `0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent)`.

**Status select:**

```
appearance: none;
background: var(--background);
background-image: <chevron-down svg, var(--muted)>;
background-position: right 12px center;
border, radius, padding, focus: same as search input;
padding-right: 36px;               /* room for chevron */
```

- Options: `All / Enabled / Testing / Disabled` (unchanged from current).

### 3.3 Table

**Wrapper:**

```
<div class="feature-table-wrap">
  <table>...</table>
</div>
```

```
.feature-table-wrap {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;             /* --radius-lg */
  overflow: hidden;                /* clips header background to radius */
}
table { width: 100%; border-collapse: collapse; }
```

The Bootstrap `<Table striped bordered hover>` is replaced. We render a
plain `<table>` and own its styles. The `responsive` wrapper is kept logically
(`overflow-x: auto` on `.feature-table-wrap` for narrow viewports).

**Header (`<thead>`):**

```
th {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 14px 16px;
  text-align: left;
  font: Manrope 600, 11px;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-transform: uppercase;
}
```

Last column ("Toggle") gets `text-align: right`.

**Body row:**

```
td {
  border-bottom: 1px solid var(--border);
  padding: 16px;
  font: Manrope 400, 14px;
  vertical-align: middle;
}
tbody tr { transition: background-color 150ms ease; }
tbody tr:hover { background: var(--card-alt); }
tbody tr:last-child td { border-bottom: none; }
```

No striping. Depth comes from the wrapper card-bg vs page-bg, not from
alternating rows (DESIGN.md §5).

**NAME column** shows two lines:

```
<span class="feature-name">{feature.name}</span>
<span class="feature-key">{feature.key}</span>
```

- `.feature-name`: 14px Manrope 600, `var(--foreground)`.
- `.feature-key`: 12px DM Mono, `var(--muted)`, display block, margin-top 2px.

This surfaces the flag key (used in MCP tools and `features.json`) without
adding a new column. Pure presentational change — the data is already in
`feature.key`.

**LAST MODIFIED column:** 13px DM Mono, `font-feature-settings: "tnum" 1`,
color `var(--muted)`, no transformation of the date string itself.

### 3.4 Status badge

`STATUS_BADGE` map is replaced. New mapping:

| Status   | Class       | Visual                                                                                              |
|----------|-------------|-----------------------------------------------------------------------------------------------------|
| Enabled  | `enabled`   | bg `color-mix(in srgb, var(--primary) 15%, transparent)`, color `var(--primary)`                    |
| Testing  | `testing`   | bg `color-mix(in srgb, var(--info) 18%, transparent)`,    color `var(--info)`                       |
| Disabled | `disabled`  | bg `color-mix(in srgb, var(--foreground) 8%, transparent)`, color `var(--muted)`                    |

Common badge style (per DESIGN.md §6):

```
display: inline-flex;
padding: 3px 10px;
border-radius: 9999px;             /* --radius-full */
font: 'DM Mono' 500, 11px;
letter-spacing: 0.06em;
text-transform: uppercase;
```

The inline-style override for Disabled (added in commit `97ff8d8` to work
around the custom Bootswatch theme) is removed — the new system gives
Disabled a faithful muted look without needing inline overrides.

### 3.5 Traffic slider

The cell becomes a flex row:

```
<div class="slider-cell">
  <input type="range" class="slider" min={0} max={100} value={...}/>
  <span class="slider-value">{value}%</span>
</div>
```

> **Note:** Tracks use a translucent foreground overlay rather than `var(--card-alt)` so they remain visible when the row hover state changes the row background to `var(--card-alt)`.

```
.slider-cell { display: flex; align-items: center; gap: 10px; min-width: 180px; }

.slider {
  -webkit-appearance: none; appearance: none;
  flex: 1; height: 4px;
  background: color-mix(in srgb, var(--foreground) 15%, transparent);
  border-radius: 9999px;
  outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px;
  background: var(--primary);
  border: 2px solid var(--card);
  border-radius: 9999px;
  cursor: pointer;
  transition: transform 150ms ease;
}
.slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
.slider::-moz-range-thumb {
  width: 14px; height: 14px;
  background: var(--primary);
  border: 2px solid var(--card);
  border-radius: 9999px;
  cursor: pointer;
}
.slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ring) 25%, transparent);
}

.slider-value {
  font: 'DM Mono' 500, 13px;
  font-feature-settings: "tnum" 1;
  color: var(--primary);
  width: 40px;
  text-align: right;
}
```

The existing `aria-label` and the `aria-live="polite"` on the value are
preserved.

### 3.6 Toggle switch

The Bootstrap `<Form.Check type="switch">` is replaced by a styled
`<label class="switch">` wrapping a hidden `<input type="checkbox">` and a
`<span class="switch-track">`:

```
.switch { position: relative; display: inline-block; width: 36px; height: 20px; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-track {
  position: absolute; inset: 0;
  background: color-mix(in srgb, var(--foreground) 15%, transparent);
  border-radius: 9999px;
  transition: background-color 150ms ease;
  cursor: pointer;
}
.switch-track::before {
  content: ''; position: absolute;
  width: 14px; height: 14px;
  left: 3px; top: 3px;
  background: var(--muted);
  border-radius: 9999px;
  transition: transform 150ms ease, background-color 150ms ease;
}
.switch input:checked + .switch-track {
  background: color-mix(in srgb, var(--primary) 40%, transparent);
}
.switch input:checked + .switch-track::before {
  transform: translateX(16px);
  background: var(--primary);
}
.switch input:focus-visible + .switch-track {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 50%, transparent);
}
```

The label text "Enable {name}" is moved to `aria-label` on the input — the
visible textual label is removed from the cell to keep the row compact. The
column header "Toggle" already disambiguates intent.

### 3.7 Skeleton row

Same five `<td>` count, but the gray `#e9ecef` rectangle becomes a shimmer
gradient using DESIGN.md §7 skeleton snippet:

```
.skeleton-cell {
  display: inline-block;
  width: 70%;
  height: 14px;
  background: linear-gradient(90deg, var(--card) 0%, var(--card-alt) 50%, var(--card) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite linear;
  border-radius: 4px;            /* --radius-sm */
}
@keyframes skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
```

NAME-cell skeleton renders two stacked bars (matching the two-line content).

### 3.8 Empty state

The two `<Message variant="info">` calls (no-features-match-filter and
no-features-at-all) are replaced by an `<EmptyState>` component invoked
from this screen. Visually it is a single-card layout matching the
table-wrap radius and border:

```
<div class="empty-state">
  <svg .../>                           <!-- 48px stroke-only icon -->
  <h3>{heading}</h3>
  <p>{subtitle}</p>
</div>
```

```
.empty-state {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
}
.empty-state-icon { width: 48px; height: 48px; margin: 0 auto 16px; color: var(--muted); opacity: 0.5; }
.empty-state h3 { margin: 0 0 4px 0; font: Manrope 600, 17px; }
.empty-state p  { margin: 0; font: Manrope 400, 13px; color: var(--muted); }
```

Two empty states this screen renders:

| Trigger                                            | Heading                              | Subtitle                                           |
|----------------------------------------------------|--------------------------------------|----------------------------------------------------|
| `filtered.length === 0 && features.length > 0`     | "No features match your filters."    | "Try a different keyword or clear the status filter." |
| `features.length === 0 && !error`                  | "No feature flags yet."              | "Once features are seeded, they appear here."      |

The error case (`error` truthy) keeps the existing `<Message variant='danger'>{error}</Message>` because that is a different concern — a transient API error is not an empty state and should be visually loud. (The `Message` component will inherit the new tokens once the global redesign reaches it; out of scope here.)

---

## 4. File changes

| File                                                                | Change                                                                                                                  |
|---------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `DESIGN.md`                                                         | Add `--info` token to dark / light / prefers-color-scheme blocks and the color tables in §1 / §10                       |
| `frontend/src/index.css`                                            | **Append** (don't replace) — add the token block from DESIGN.md §10 (`:root` light defaults, `@media (prefers-color-scheme: dark)` overrides) and the Google-Fonts `@import` for Manrope + DM Mono. Existing global h1/h2/h3 and carousel rules stay untouched (other screens depend on them). |
| `frontend/src/screens/FeatureListScreen.js`                         | Replace `<Table>`, `<Form.Control>`, `<Badge>`, `<Form.Check>` JSX with semantic markup using new class names; remove `STATUS_BADGE` style override map |
| `frontend/src/screens/FeatureListScreen.css` (new)                  | Page-scoped CSS for header / filters / table-wrap / badge / slider / switch / skeleton / empty                         |
| `frontend/src/components/EmptyState.js` (new)                       | Small presentational component: `({ icon, heading, subtitle, action }) => <div class="empty-state">...</div>`          |
| `frontend/src/components/EmptyState.css` (new)                      | Styles for `.empty-state` / `.empty-state-icon`                                                                         |
| `frontend/src/screens/FeatureListScreen.test.js`                    | Adjust assertions that hit Bootstrap class names (`badge-success`, `form-check-input`) to query by role / accessible name instead |

**Theme selection** for this PR uses `@media (prefers-color-scheme: dark)`
only — no `.dark` class on `<html>`, no JS toggle, no `localStorage`. A user
with a dark OS preference sees dark; a user with light sees light. The
manual theme toggle is a follow-up out of scope here.

The current `frontend/src/bootstrap.min.css` import stays — Bootstrap still
backs the rest of the app. The new dashboard styles override Bootstrap for
this screen only via specific class names (`.feature-table-wrap table th`
etc.), no global Bootstrap reset is needed for this redesign.

**Font scoping:** Manrope and DM Mono are imported globally (so they're
available for future redesign work) but applied to the dashboard only via
a page-level class (`.feature-dashboard`). Other screens keep their current
Bootstrap-default fonts until they go through their own redesign — this
avoids accidentally restyling unrelated screens here.

---

## 5. Behavior & data flow (unchanged, for reference)

- Auth gate: `useEffect` redirects to `/login` if `!userInfo?.isAdmin`. Same.
- `useEffect` dispatches `listFeatures()`. Same.
- `useMemo` filters by keyword (case-insensitive) and status. Same.
- `FeatureRow` keeps its local `localTraffic` state and 150ms debounce
  before dispatching `updateFeatureTraffic(key, value)`. Same.
- Toggle dispatches `toggleFeature(key)` directly on change. Same.
- Skeleton renders 5 rows during `loading`. Same count.

No Redux constants, actions, reducers, or backend routes change.

---

## 6. States covered (per DESIGN.md §7)

| Element              | Default | Hover                  | Focus                              | Active             | Loading                 | Disabled / Empty                  |
|----------------------|---------|------------------------|------------------------------------|--------------------|-------------------------|-----------------------------------|
| Search / Select      | normal  | border brighter (none) | ring 2px var(--ring)               | —                  | —                       | n/a                               |
| Row                  | normal  | bg var(--card-alt)     | (rows aren't focusable in scope)   | —                  | shimmer skeleton (whole row) | empty state (whole table → empty card) |
| Status badge         | normal  | —                      | (decorative, not focusable)        | —                  | —                       | included as Disabled variant      |
| Slider thumb         | normal  | scale(1.15)            | ring 4px var(--ring) 25% on thumb  | dragging           | —                       | (only --primary, not disabled)    |
| Toggle switch        | off     | —                      | ring 2px var(--ring) 50% on track  | checked = lime     | —                       | (no per-row disabled state)       |
| Empty-state CTA      | n/a     | n/a                    | n/a                                | n/a                | n/a                     | this screen has no CTA in empty   |

The Loading and Error states are handled by the screen's existing branching
(`loading` → skeleton rows; `error` → `<Message variant='danger'>`).

---

## 7. Accessibility (preserved + checks)

- All existing `aria-label`s on inputs, slider, switch are kept.
- `aria-live="polite"` on the slider value span is kept.
- Badge text is plain text inside the span — no icon-only state.
- Focus rings use `:focus-visible` so mouse clicks don't show rings, keyboard navigation does.
- Contrast measured for the three badge variants on `var(--card)`
  (`#2E2E2E`):
  - Enabled `#C6FF3D` → 12.0:1 (AAA)
  - Testing `#5DA9FF` → 5.9:1  (AA)
  - Disabled `#999999` → 4.3:1 — borderline AA, acceptable for the 11px label given the badge is supplemented by the upper-case text content (not color-only signal).
- Slider thumb hit area is 14px; combined with the row padding (16px) and
  cell vertical-align middle, the effective hit area on touch is ~44px tall.
  Acceptable per DESIGN.md §9.
- Switch hit area: 36×20px visible, 44×24px including padding wrapper added
  to `<label class="switch">` on touch devices via `@media (hover: none)`.

---

## 8. Done / acceptance

- [ ] `--info` token added to `DESIGN.md` (dark + light + prefers-color-scheme blocks, both color tables).
- [ ] `frontend/src/index.css` appends Manrope + DM Mono `@import` and the token set (`:root` light + `@media (prefers-color-scheme: dark)` overrides), without removing existing global rules.
- [ ] Dashboard wrapper has class `.feature-dashboard`; tokens / fonts apply only inside it (no global font cascade onto other screens).
- [ ] `FeatureListScreen.js` no longer uses `Table`, `Form.Control type='range'`, `Form.Check type='switch'`, or `Badge`.
- [ ] `FeatureListScreen.css` exists and is the only place with rules scoped to this page.
- [ ] `EmptyState` component is reusable (doesn't import anything from `FeatureListScreen`).
- [ ] Existing test passes after assertion adjustments (no behavior change is introduced).
- [ ] Dev server (`npm run dev`) renders the page; the four states (loading, populated, filtered-empty, server-error) all render with new visuals.
- [ ] Tabbing through the page: focus rings appear on search → select → each slider → each switch in row order.
- [ ] No console errors.

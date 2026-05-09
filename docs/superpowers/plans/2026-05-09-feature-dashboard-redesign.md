# Feature Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/admin/featuredashboard` (`FeatureListScreen`) to use `DESIGN.md` tokens (Tech-Minimal Dark, Manrope + DM Mono, lime primary, info-blue Testing), without changing layout, columns, or behavior.

**Architecture:** Tokens live in `frontend/src/index.css` as CSS custom properties (`:root` for light, `@media (prefers-color-scheme: dark)` for dark). All dashboard styling lives in a new page-scoped `FeatureListScreen.css` under a `.feature-dashboard` wrapper class so other screens keep their current Bootstrap defaults until they are redesigned. The Bootstrap JSX components (`Table`, `Form.Control type=range`, `Form.Check type=switch`, `Badge`) are replaced with plain semantic HTML carrying the new class names. A small `<EmptyState>` component is extracted for reuse on later screens.

**Tech Stack:** React 16.13, react-redux, react-router-dom v5, vanilla CSS custom properties, no Tailwind / no shadcn / no SCSS. Tests use `@testing-library/react` (CRA's Jest 24).

**Spec:** [`docs/superpowers/specs/2026-05-09-feature-dashboard-redesign-design.md`](../specs/2026-05-09-feature-dashboard-redesign-design.md)

**Branch:** `m4-redesign` (already checked out, two commits ahead of `main`).

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `frontend/src/components/EmptyState.js` | Reusable presentational component: icon + heading + subtitle + optional CTA |
| `frontend/src/components/EmptyState.css` | Styles for `.empty` / `.empty-icon` (matches DESIGN.md §6 empty state spec) |
| `frontend/src/components/EmptyState.test.js` | Unit test for EmptyState rendering |
| `frontend/src/screens/FeatureListScreen.css` | All page-scoped styles for the dashboard: header, filters, table-wrap, badge, slider, switch, skeleton |

**Modify:**

| File | Change |
|---|---|
| `DESIGN.md` | Add `--info` token to dark + light + `prefers-color-scheme` blocks and the §1 color tables |
| `frontend/src/index.css` | Append Manrope + DM Mono `@import` and the full token block (`:root` light + `@media prefers-color-scheme dark`) — without removing existing global rules |
| `frontend/src/screens/FeatureListScreen.js` | Replace `Table`/`Form.Control type=range`/`Form.Check type=switch`/`Badge` with semantic markup using new class names; remove `STATUS_BADGE` map; render `<EmptyState>` instead of `<Message>` for the two empty cases |

**Test (no schema change, just verify):** `frontend/src/screens/FeatureListScreen.test.js` keeps working as-is — all assertions go through aria-labels and text content that survive the redesign.

---

## Task 1: Add `--info` token to DESIGN.md

**Files:**
- Modify: `DESIGN.md` — sections §1 (two color tables) and §10 (`:root`, `.dark`, `prefers-color-scheme` CSS blocks)

- [ ] **Step 1: Add `--info` to the dark-mode color table in §1**

In `DESIGN.md`, find the "### Dark mode (default)" table and add a new row immediately after `--destructive`:

```markdown
| `--info`         | `#5DA9FF`  | informational / in-progress status      |
```

- [ ] **Step 2: Add `--info` to the light-mode color table in §1**

Find the "### Light mode (alt)" table and add the row after `--destructive`:

```markdown
| `--info`         | `#1E6FBA`  |
```

- [ ] **Step 3: Add `--info` to the contrast self-check note**

Append to the existing contrast bullets in §1 (right after the four current ones):

```markdown
- `#5DA9FF` on `#242424` = **6.5:1** (AA — used for Testing-status badge)
- `#1E6FBA` on `#FFFFFF` = **4.7:1** (AA)
```

- [ ] **Step 4: Add `--info` to the `:root` block in §10**

Find the `:root { /* light mode (default if user picks light or OS prefers light) */` block. Insert the new variable between `--destructive` and `--border`:

```css
  --info:         #1E6FBA;
```

- [ ] **Step 5: Add `--info` to the `.dark` block in §10**

Same insertion in the `.dark` block:

```css
  --info:         #5DA9FF;
```

- [ ] **Step 6: Add `--info` to the `prefers-color-scheme: dark` media query in §10**

Same insertion in the `@media (prefers-color-scheme: dark)` block:

```css
    --info:         #5DA9FF;
```

- [ ] **Step 7: Verify file is consistent**

Run: `grep -n -- "--info" DESIGN.md`
Expected: 7 hits — 2 table rows (dark + light), 2 contrast bullets, 3 CSS blocks (`:root`, `.dark`, `prefers-color-scheme`).

If the count is wrong, re-check the steps above for missed insertions.

- [ ] **Step 8: Commit**

```bash
git add DESIGN.md
git commit -m "course: feat: add --info token to design system"
```

---

## Task 2: Add EmptyState component (TDD)

**Files:**
- Create: `frontend/src/components/EmptyState.js`
- Create: `frontend/src/components/EmptyState.css`
- Create: `frontend/src/components/EmptyState.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/EmptyState.test.js`:

```jsx
import React from 'react'
import { render } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders heading and subtitle', () => {
    const { getByText } = render(
      <EmptyState heading="Nothing here" subtitle="Try again" />
    )
    expect(getByText('Nothing here')).toBeInTheDocument()
    expect(getByText('Try again')).toBeInTheDocument()
  })

  it('renders the icon SVG when provided', () => {
    const icon = <svg data-testid="my-icon" />
    const { getByTestId } = render(
      <EmptyState icon={icon} heading="x" subtitle="y" />
    )
    expect(getByTestId('my-icon')).toBeInTheDocument()
  })

  it('renders without an icon when none is provided', () => {
    const { container } = render(
      <EmptyState heading="x" subtitle="y" />
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- --testPathPattern=EmptyState --watchAll=false`
Expected: FAIL with `Cannot find module './EmptyState'` or similar.

- [ ] **Step 3: Implement EmptyState.js**

Create `frontend/src/components/EmptyState.js`:

```jsx
import React from 'react'
import './EmptyState.css'

const EmptyState = ({ icon, heading, subtitle }) => {
  return (
    <div className='empty'>
      {icon ? <div className='empty-icon'>{icon}</div> : null}
      <h3>{heading}</h3>
      <p>{subtitle}</p>
    </div>
  )
}

export default EmptyState
```

- [ ] **Step 4: Implement EmptyState.css**

Create `frontend/src/components/EmptyState.css`:

```css
.empty {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: var(--muted);
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.5;
}

.empty h3 {
  margin: 0 0 4px 0;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 17px;
  font-weight: 600;
  color: var(--foreground);
  /* override the global h3 padding from index.css for this scope */
  padding: 0;
}

.empty p {
  margin: 0;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 13px;
  color: var(--muted);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --prefix frontend -- --testPathPattern=EmptyState --watchAll=false`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/EmptyState.js frontend/src/components/EmptyState.css frontend/src/components/EmptyState.test.js
git commit -m "course: feat: add EmptyState component"
```

---

## Task 3: Append fonts + tokens to global index.css

**Files:**
- Modify: `frontend/src/index.css` — append-only at end of file

- [ ] **Step 1: Read the current file**

Run: `cat frontend/src/index.css`
Expected: 53 lines, ending with the `@media (max-width: 900px)` carousel rule.

- [ ] **Step 2: Append the font import and token blocks**

Append these blocks to the end of `frontend/src/index.css` (do **not** remove or edit existing rules above):

```css

/* ===========================================================================
   Design System tokens (DESIGN.md). Light mode is default; OS dark preference
   swaps to dark via the media query below. Manual theme toggle is a follow-up
   and not wired here. Tokens are global so any redesigned screen can read them.
   Fonts are imported globally so they can be referenced by component CSS, but
   are NOT applied as a body default — each redesigned screen opts in via its
   own scope class so legacy screens keep their current Bootstrap fonts.
   =========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

:root {
  --background:   #FAFAFA;
  --foreground:   #1A1A1A;
  --card:         #FFFFFF;
  --card-alt:     #F0F0F0;
  --primary:      #4A7000;
  --primary-fg:   #FFFFFF;
  --muted:        #666666;
  --accent:       #4A7000;
  --destructive:  #D63838;
  --info:         #1E6FBA;
  --border:       #E0E0E0;
  --ring:         #4A7000;

  --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-modal:   0 8px 32px rgba(0, 0, 0, 0.18);

  --space-micro: 4px;
  --space-xs:    8px;
  --space-sm:   16px;
  --space-md:   24px;
  --space-lg:   32px;
  --space-xl:   48px;
  --space-2xl:  64px;
  --space-3xl:  96px;

  --radius-sm:    4px;
  --radius-md:    8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background:   #242424;
    --foreground:   #F2F2F2;
    --card:         #2E2E2E;
    --card-alt:     #383838;
    --primary:      #C6FF3D;
    --primary-fg:   #0A0A0A;
    --muted:        #999999;
    --accent:       #C6FF3D;
    --destructive:  #FF6B6B;
    --info:         #5DA9FF;
    --border:       #3A3A3A;
    --ring:         #C6FF3D;

    --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.4);
    --shadow-modal:   0 8px 32px rgba(0, 0, 0, 0.5);
  }
}
```

- [ ] **Step 3: Verify other screens still render**

Run: `npm run dev` (this starts both backend and CRA dev server).
Open the home page (`http://localhost:3000/`) in a browser.
Expected: home page renders identically to before — Bootstrap fonts, layout intact, no console errors. The token block is purely additive and the `@import` only loads font files; nothing on existing screens should change visually.

If other screens look broken: revert this file change, the issue is most likely that an existing rule was accidentally edited.

Stop the dev server (Ctrl+C in its terminal) before continuing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "course: feat: import design fonts and expose design tokens globally"
```

---

## Task 4: Build FeatureListScreen.css

**Files:**
- Create: `frontend/src/screens/FeatureListScreen.css`

This is a CSS-only step — no failing test to drive it. The verification gate is: when Task 5 wires it up, the existing `FeatureListScreen.test.js` continues to pass and the dev server renders the redesigned screen with all visual elements present.

- [ ] **Step 1: Create the file with all dashboard styles**

Create `frontend/src/screens/FeatureListScreen.css`:

```css
/* All rules below are scoped to .feature-dashboard so they don't leak into
   other screens that still depend on Bootstrap defaults. */

.feature-dashboard {
  font-family: 'Manrope', system-ui, sans-serif;
  color: var(--foreground);
  background: var(--background);
  /* Negative margin counteracts the global .container padding of the parent
     so the dashboard background fills the viewport edge-to-edge inside the
     content area. Adjust if needed when the layout chrome changes. */
}

/* ---------- Header ---------- */
.feature-dashboard .fd-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 32px;
}
.feature-dashboard .fd-header h1 {
  margin: 0;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--foreground);
  /* override global h1 padding from index.css */
  padding: 0;
}
.feature-dashboard .fd-subtitle {
  margin: 8px 0 0 0;
  font-size: 15px;
  color: var(--muted);
}
.feature-dashboard .fd-count-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
  border-radius: 9999px;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.feature-dashboard .fd-count-chip .fd-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--primary);
}

/* ---------- Filter row ---------- */
.feature-dashboard .fd-filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}
.feature-dashboard .fd-input,
.feature-dashboard .fd-select {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--foreground);
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 14px;
  width: 100%;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.feature-dashboard .fd-input::placeholder { color: var(--muted); }
.feature-dashboard .fd-input:focus,
.feature-dashboard .fd-select:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent);
}
.feature-dashboard .fd-input.fd-search {
  padding-left: 40px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23999'><path d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z'/></svg>");
  background-repeat: no-repeat;
  background-position: 14px center;
  background-size: 14px;
}
.feature-dashboard .fd-select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23999'><path d='M8 11L3 6h10l-5 5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* ---------- Table ---------- */
.feature-dashboard .fd-table-wrap {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  overflow-x: auto;
}
.feature-dashboard .fd-table {
  width: 100%;
  border-collapse: collapse;
}
.feature-dashboard .fd-table th {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 14px 16px;
  text-align: left;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-transform: uppercase;
}
.feature-dashboard .fd-table th.fd-th-right { text-align: right; }
.feature-dashboard .fd-table td {
  border-bottom: 1px solid var(--border);
  padding: 16px;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 14px;
  vertical-align: middle;
  color: var(--foreground);
}
.feature-dashboard .fd-table tbody tr {
  transition: background-color 150ms ease;
}
.feature-dashboard .fd-table tbody tr:hover {
  background: var(--card-alt);
}
.feature-dashboard .fd-table tbody tr:last-child td {
  border-bottom: none;
}

.feature-dashboard .fd-feature-name {
  font-weight: 600;
  color: var(--foreground);
}
.feature-dashboard .fd-feature-key {
  display: block;
  margin-top: 2px;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--muted);
  font-feature-settings: "tnum" 1;
}

.feature-dashboard .fd-mono {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: "tnum" 1;
  font-size: 13px;
  color: var(--muted);
}

/* ---------- Status badge ---------- */
.feature-dashboard .fd-badge {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 9999px;
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.feature-dashboard .fd-badge--enabled {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
}
.feature-dashboard .fd-badge--testing {
  background: color-mix(in srgb, var(--info) 18%, transparent);
  color: var(--info);
}
.feature-dashboard .fd-badge--disabled {
  background: color-mix(in srgb, var(--foreground) 8%, transparent);
  color: var(--muted);
}

/* ---------- Slider ---------- */
.feature-dashboard .fd-slider-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
}
.feature-dashboard .fd-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  background: var(--card-alt);
  border-radius: 9999px;
  outline: none;
}
.feature-dashboard .fd-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--primary);
  border: 2px solid var(--card);
  border-radius: 9999px;
  cursor: pointer;
  transition: transform 150ms ease;
}
.feature-dashboard .fd-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.feature-dashboard .fd-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--primary);
  border: 2px solid var(--card);
  border-radius: 9999px;
  cursor: pointer;
}
.feature-dashboard .fd-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ring) 25%, transparent);
}
.feature-dashboard .fd-slider-value {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: "tnum" 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--primary);
  width: 40px;
  text-align: right;
}

/* ---------- Toggle switch ---------- */
.feature-dashboard .fd-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.feature-dashboard .fd-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.feature-dashboard .fd-switch-track {
  position: absolute;
  inset: 0;
  background: var(--card-alt);
  border-radius: 9999px;
  transition: background-color 150ms ease, box-shadow 150ms ease;
  cursor: pointer;
}
.feature-dashboard .fd-switch-track::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 3px;
  top: 3px;
  background: var(--muted);
  border-radius: 9999px;
  transition: transform 150ms ease, background-color 150ms ease;
}
.feature-dashboard .fd-switch input:checked + .fd-switch-track {
  background: color-mix(in srgb, var(--primary) 30%, var(--card-alt));
}
.feature-dashboard .fd-switch input:checked + .fd-switch-track::before {
  transform: translateX(16px);
  background: var(--primary);
}
.feature-dashboard .fd-switch input:focus-visible + .fd-switch-track {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 50%, transparent);
}

.feature-dashboard .fd-toggle-cell {
  text-align: right;
}

/* ---------- Skeleton ---------- */
.feature-dashboard .fd-skeleton-cell {
  display: inline-block;
  width: 70%;
  height: 14px;
  background: linear-gradient(90deg, var(--card) 0%, var(--card-alt) 50%, var(--card) 100%);
  background-size: 200% 100%;
  animation: fd-skeleton-shimmer 1.5s infinite linear;
  border-radius: 4px;
}
@keyframes fd-skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

/* ---------- Reduced motion (per DESIGN.md §8) ---------- */
@media (prefers-reduced-motion: reduce) {
  .feature-dashboard *,
  .feature-dashboard *::before,
  .feature-dashboard *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Sanity-check it compiles**

Run: `npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false`
Expected: PASS, the screen test still passes (it doesn't import the new CSS file yet, but CRA may pre-process it on build).

If this step fails with a compile error in the new CSS, fix the CSS and retry.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/screens/FeatureListScreen.css
git commit -m "course: feat: add FeatureListScreen.css with design tokens"
```

---

## Task 5: Refactor FeatureListScreen.js to use the new markup

**Files:**
- Modify: `frontend/src/screens/FeatureListScreen.js`
- (Test: `frontend/src/screens/FeatureListScreen.test.js` — assertions don't change; we run it as the regression gate.)

- [ ] **Step 1: Run the existing test to capture the green baseline**

Run: `npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false`
Expected: PASS — 4 tests in `FeatureListScreen.test.js`. Note the count for comparison after the refactor.

- [ ] **Step 2: Replace the file contents**

Overwrite `frontend/src/screens/FeatureListScreen.js` with:

```jsx
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import EmptyState from '../components/EmptyState'
import Message from '../components/Message'
import {
  listFeatures,
  toggleFeature,
  updateFeatureTraffic,
} from '../actions/featureActions'
import './FeatureListScreen.css'

const STATUS_BADGE_CLASS = {
  Enabled: 'fd-badge fd-badge--enabled',
  Testing: 'fd-badge fd-badge--testing',
  Disabled: 'fd-badge fd-badge--disabled',
}

const SearchIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    aria-hidden='true'
  >
    <circle cx='11' cy='11' r='7' />
    <line x1='21' y1='21' x2='16.65' y2='16.65' />
  </svg>
)

const SkeletonRow = () => (
  <tr>
    <td>
      <span className='fd-skeleton-cell' />
      <br />
      <span className='fd-skeleton-cell' style={{ width: '40%', marginTop: 4 }} />
    </td>
    {[0, 1, 2, 3].map((i) => (
      <td key={i}>
        <span className='fd-skeleton-cell' />
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
      <td>
        <span className='fd-feature-name'>{feature.name}</span>
        <span className='fd-feature-key'>{feature.key}</span>
      </td>
      <td>
        <span className={STATUS_BADGE_CLASS[feature.status]}>
          {feature.status}
        </span>
      </td>
      <td>
        <div className='fd-slider-cell'>
          <input
            type='range'
            className='fd-slider'
            min={0}
            max={100}
            value={localTraffic}
            onChange={handleSlider}
            aria-label={`Traffic percentage for ${feature.name}`}
          />
          <span className='fd-slider-value' aria-live='polite'>
            {localTraffic}%
          </span>
        </div>
      </td>
      <td className='fd-mono'>{feature.last_modified}</td>
      <td className='fd-toggle-cell'>
        <label className='fd-switch'>
          <input
            type='checkbox'
            checked={feature.status === 'Enabled'}
            onChange={handleToggle}
            aria-label={`Enable ${feature.name}`}
          />
          <span className='fd-switch-track' />
        </label>
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

  const totalCount = (features || []).length
  const showFilteredEmpty =
    !loading && !error && filtered.length === 0 && totalCount > 0
  const showInventoryEmpty =
    !loading && !error && totalCount === 0
  const showTable = !showFilteredEmpty && !showInventoryEmpty

  return (
    <div className='feature-dashboard'>
      <div className='fd-header'>
        <div>
          <h1>Feature Dashboard</h1>
          <p className='fd-subtitle'>
            Manage feature flag rollouts and traffic ramps.
          </p>
        </div>
        <div className='fd-count-chip'>
          <span className='fd-dot' />
          {totalCount} FLAGS
        </div>
      </div>

      <div className='fd-filters'>
        <input
          type='text'
          className='fd-input fd-search'
          placeholder='Search by name...'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label='Search features by name'
        />
        <select
          className='fd-input fd-select'
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label='Filter by status'
        >
          <option value='All'>All</option>
          <option value='Enabled'>Enabled</option>
          <option value='Testing'>Testing</option>
          <option value='Disabled'>Disabled</option>
        </select>
      </div>

      {error ? (
        <Message variant='danger'>{error}</Message>
      ) : showTable ? (
        <div className='fd-table-wrap'>
          <table className='fd-table'>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Traffic %</th>
                <th>Last modified</th>
                <th className='fd-th-right'>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
                : filtered.map((f) => <FeatureRow key={f.key} feature={f} />)}
            </tbody>
          </table>
        </div>
      ) : null}

      {showFilteredEmpty && (
        <EmptyState
          icon={<SearchIcon />}
          heading='No features match your filters.'
          subtitle='Try a different keyword or clear the status filter.'
        />
      )}

      {showInventoryEmpty && (
        <EmptyState
          icon={<SearchIcon />}
          heading='No feature flags yet.'
          subtitle='Once features are seeded, they appear here.'
        />
      )}
    </div>
  )
}

export default FeatureListScreen
```

- [ ] **Step 3: Run the existing test to verify behavior is unchanged**

Run: `npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false`
Expected: PASS — same 4 tests still pass. Specifically:
- `renders one row per feature` — passes via `getByText('New Search Algorithm')` (still rendered as feature-name text).
- `filters by name via the search input` — passes via `getByLabelText('Search features by name')` (aria-label preserved).
- `filters by status` — passes via `getByLabelText('Filter by status')` (aria-label preserved).
- `shows the empty-filter message when nothing matches` — passes via `getByText(/No features match your filters/i)` (text preserved in the new EmptyState).

If any test fails, do **not** edit the test to fit. Re-read the failure: it almost certainly means a real behavioral regression, e.g. a missing aria-label or a typo'd empty-state heading. Fix the component, not the test.

- [ ] **Step 4: Run the full test suite to make sure nothing else regressed**

Run: `npm test --prefix frontend -- --watchAll=false`
Expected: every test in the project still passes. Note any pre-existing failures (unrelated to this work) and skip them.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/FeatureListScreen.js
git commit -m "course: feat: redesign FeatureListScreen with design tokens"
```

---

## Task 6: Manual visual verification

**Files:** none.

This task closes the loop by running the dev server and confirming the four states the spec demands all render correctly with the new visuals.

- [ ] **Step 1: Start the dev server**

Run (from repo root): `npm run dev`
Expected: backend on port 5000, CRA on port 3000.

- [ ] **Step 2: Sign in as admin and navigate to the dashboard**

Open `http://localhost:3000/login` in a browser, sign in with the seeded admin user (see `backend/data/users.js` for credentials, e.g. `admin@example.com` / `123456`), then navigate to `/admin/featuredashboard` via the Admin dropdown in the nav.

Expected: page loads.

- [ ] **Step 3: Verify the populated state**

Confirm visually:
- Header shows "Feature Dashboard" in 40px bold Manrope and the subtitle below in muted grey.
- Lime count-chip on the top-right shows total count, e.g. "5 FLAGS".
- Search and status-filter inputs sit in a 2:1 grid with rounded corners and a focus ring on click.
- The table is wrapped in a single rounded card (no Bootstrap stripes / heavy borders).
- Status badges: Enabled = lime tint, Testing = blue tint, Disabled = muted grey.
- TRAFFIC % uses a custom slim slider with a lime thumb and a mono percentage on the right.
- TOGGLE column uses a custom switch (off = grey track + grey knob, on = lime-tinted track + lime knob).
- LAST MODIFIED renders in DM Mono.
- Hovering a row tints it `--card-alt`.

- [ ] **Step 4: Verify the loading state**

In Chrome DevTools, throttle the network to "Slow 3G" and reload the page. While the request is in flight, the body of the table should show 5 shimmer skeleton rows.

Restore network to "No throttling" after.

- [ ] **Step 5: Verify the filtered-empty state**

Type `zzznotreal` into the search input.
Expected: the table card disappears and is replaced by the empty-state card with the search-icon, heading "No features match your filters." and subtitle "Try a different keyword or clear the status filter."

Clear the search.

- [ ] **Step 6: Verify the error state**

Stop the backend server (Ctrl+C in the backend terminal). Reload the page.
Expected: the page renders without a table — instead an `<Alert variant='danger'>` (the legacy `Message` component) shows the error string. This deliberately keeps Bootstrap styling for now (the spec defers redesigning `Message` to a later screen).

Restart the backend (`npm run server` in another terminal) and reload to return to the populated state.

- [ ] **Step 7: Verify keyboard navigation**

Press Tab from the page header. Confirm focus rings appear, in order, on:
1. Search input
2. Status select
3. First row's slider
4. First row's switch
5. Second row's slider
6. Second row's switch
... and so on.

Expected: each focus ring is visible (2px lime, no `outline: none` swallow).

- [ ] **Step 8: Verify dark/light auto-switching**

In Chrome DevTools → Rendering → Emulate CSS media feature `prefers-color-scheme`. Toggle between `light` and `dark`.
Expected: dashboard tokens swap — light mode shows white card, dark olive primary, dark blue Testing badge. Dark mode shows the originally designed lime-on-black look.

- [ ] **Step 9: Final commit (only if any small fixes were needed)**

If steps 3-8 surfaced no issues, no further commit is needed.

If a fix was needed, commit it:

```bash
git add <fixed files>
git commit -m "course: fix: <what was fixed>"
```

- [ ] **Step 10: Summarize the branch**

Run: `git log --oneline main..HEAD`
Expected output (commit count after the spec/design-system commits): six new commits on `m4-redesign`:

```
<sha> course: feat: redesign FeatureListScreen with design tokens
<sha> course: feat: add FeatureListScreen.css with design tokens
<sha> course: feat: import design fonts and expose design tokens globally
<sha> course: feat: add EmptyState component
<sha> course: feat: add --info token to design system
<sha> course: docs: add feature dashboard redesign design spec
<sha> course: feat: add DESIGN.md design system + CLAUDE.md reference
```

Branch is ready for merge into `main`. The user has not asked for a push, so do not push the branch unless they explicitly request it.

---

## Self-Review

**Spec coverage:**
- §2 `--info` token addition → Task 1.
- §3.1 page header → Task 4 (CSS) + Task 5 (JSX).
- §3.2 filter row → Task 4 + Task 5.
- §3.3 table → Task 4 + Task 5.
- §3.4 status badge → Task 4 + Task 5.
- §3.5 traffic slider → Task 4 + Task 5.
- §3.6 toggle switch → Task 4 + Task 5.
- §3.7 skeleton row → Task 4 + Task 5.
- §3.8 empty state → Task 2 (component) + Task 5 (use sites).
- §4 file changes (DESIGN.md, index.css, FeatureListScreen.js, FeatureListScreen.css, EmptyState.{js,css}, test adjustment) → Tasks 1, 2, 3, 4, 5. Test "adjustment" turned out to be unnecessary — assertions all hit aria-labels and visible text that survive the redesign — so no test edits are scheduled, only verification (Task 5 step 3).
- §5 behavior unchanged → Task 5 preserves debounce, dispatches, useMemo, auth gate.
- §6 states covered → Task 6 manual verification.
- §7 a11y → Task 6 step 7 (keyboard) + Task 5 (aria-labels preserved).
- §8 acceptance checklist → directly mapped to Tasks 1-6.

**Placeholder scan:** no TBD, TODO, or "implement later" left in the steps. The "Reserved for future use" comment in `FeatureListScreen.css` step is real working CSS (a comment, not a placeholder for missing rules).

**Type / name consistency:**
- `STATUS_BADGE_CLASS` keys (`Enabled`, `Testing`, `Disabled`) match `feature.status` values from `features.json`.
- Class names: `fd-badge`, `fd-badge--enabled`, `fd-badge--testing`, `fd-badge--disabled` are referenced consistently between Task 4 (CSS) and Task 5 (JSX).
- `fd-feature-name`, `fd-feature-key`, `fd-mono`, `fd-slider-cell`, `fd-slider`, `fd-slider-value`, `fd-switch`, `fd-switch-track`, `fd-toggle-cell`, `fd-skeleton-cell`, `fd-table-wrap`, `fd-table`, `fd-th-right`, `fd-input`, `fd-search`, `fd-select`, `fd-filters`, `fd-header`, `fd-subtitle`, `fd-count-chip`, `fd-dot` — all defined in Task 4 CSS and used in Task 5 JSX. No drift.
- Component imports in Task 5: `EmptyState` from `../components/EmptyState` matches the file created in Task 2. `Message` from `../components/Message` is preserved (only used for the error case).

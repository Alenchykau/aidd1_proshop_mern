# M4 Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the rails for M4: M4 report section, working light/dark theme toggle, Bootstrap-token bridge, and the shared UI atoms that Phase 1–3 will compose into screens.

**Architecture:** CSS custom properties on `:root` (light) and `.dark` (dark) with a `prefers-color-scheme` fallback gated by `data-theme`. A React Context (`ThemeContext`) owns the user choice and writes it to `<html>`. An inline anti-FOUC script in `index.html` mirrors the same logic before the React bundle runs. Bootstrap is reskinned via a pure-CSS override sheet — no Sass/build deps added.

**Tech Stack:** React 16.13 + classic Redux + react-bootstrap 1.3 (existing). Pure CSS for tokens and overrides. `react-icons/fa` (already a dep) for icons.

**Spec:** `docs/superpowers/specs/2026-05-10-m4-foundation-design.md`

**Notes for the engineer:**
- The project pins old versions on purpose (see `CLAUDE.md` "Tech Stack — Explicitly NOT used"). Do not migrate to react-router v6 / Redux Toolkit / React 17+ / Mongoose 6+.
- Project has almost no test infra (one test file: `frontend/src/screens/FeatureListScreen.test.js`). Per spec §4, atoms in this phase ship without tests; verification is manual smoke + the existing test continuing to pass.
- All tasks are color/CSS work + small component scaffolding. Each task is one focused commit.
- Commit format from `CLAUDE.md`: `course: <type>: <summary>`. Do **not** add `Co-Authored-By:` trailer.

---

## File map

**New files**
- `frontend/src/context/ThemeContext.js`
- `frontend/src/bootstrap-overrides.css`
- `frontend/src/components/Header.css`
- `frontend/src/components/ui/index.js` (barrel)
- `frontend/src/components/ui/ThemeToggle.js` + `ThemeToggle.css`
- `frontend/src/components/ui/Card.js` + `Card.css`
- `frontend/src/components/ui/Button.js` + `Button.css`
- `frontend/src/components/ui/Badge.js` + `Badge.css`
- `frontend/src/components/ui/FormField.js` + `FormField.css`
- `frontend/src/components/ui/FormCard.js` + `FormCard.css`
- `frontend/src/components/ui/DataTable.js` + `DataTable.css`
- `frontend/src/components/ui/Pagination.js` + `Pagination.css`

**Modified files**
- `report.md` — append M4 section
- `frontend/src/index.css` — refactor token contract per spec §3.3
- `frontend/public/index.html` — inline anti-FOUC `<script>` in `<head>`
- `frontend/src/index.js` — wrap in `<ThemeProvider>`, import overrides
- `frontend/src/components/Header.js` — drop `bg='dark' variant='dark'`, mount ThemeToggle, add `Header.css` import

---

## Task 1: Add M4 section to report.md

**Files:**
- Modify: `report.md` (append at end of file, after the M3 section)

- [ ] **Step 1: Append the M4 section**

Append exactly this block to the end of `report.md` (no other changes):

```markdown

## M4 — Redesign

Дизайн-система: ProShop Tech-Minimal Dark (см. `DESIGN.md`). Подход —
семантические CSS-токены на `:root` (light) и `.dark` (dark), функциональный
переключатель тем в Header, OS preference как fallback. Bootstrap 4
переведён на токены через `bootstrap-overrides.css`, поэтому легаси-экраны
меняют тему вместе с редизайн-экранами.

Стратегия — гибрид: сначала общие atoms (`Card`, `Button`, `FormField`,
`FormCard`, `DataTable`, `Pagination`, `Badge`, `ThemeToggle`), потом
per-screen редизайн в порядке public → auth → admin. Восемь групповых
ASCII-wireframes в спеке Phase 0 покрывают все 16 экранов как шаблоны.

Phase split: Phase 0 — Foundation (этот PR). Phase 1 — Public.
Phase 2 — Auth/Checkout. Phase 3 — Admin.

| #  | Page                       | Route                              | File                       | Видимость | Сделал?           |
|----|----------------------------|------------------------------------|----------------------------|-----------|-------------------|
| 1  | Home / Search results      | /, /search/:keyword, /page/:n      | HomeScreen.js              | public    | [ ]               |
| 2  | Product details            | /product/:id                       | ProductScreen.js           | public    | [ ]               |
| 3  | Cart                       | /cart/:id?                         | CartScreen.js              | public    | [ ]               |
| 4  | Login                      | /login                             | LoginScreen.js             | public    | [ ]               |
| 5  | Register                   | /register                          | RegisterScreen.js          | public    | [ ]               |
| 6  | Profile                    | /profile                           | ProfileScreen.js           | auth      | [ ]               |
| 7  | Shipping                   | /shipping                          | ShippingScreen.js          | auth      | [ ]               |
| 8  | Payment                    | /payment                           | PaymentScreen.js           | auth      | [ ]               |
| 9  | Place Order                | /placeorder                        | PlaceOrderScreen.js        | auth      | [ ]               |
| 10 | Order details              | /order/:id                         | OrderScreen.js             | auth      | [ ]               |
| 11 | Admin: Users list          | /admin/userlist                    | UserListScreen.js          | admin     | [ ]               |
| 12 | Admin: User edit           | /admin/user/:id/edit               | UserEditScreen.js          | admin     | [ ]               |
| 13 | Admin: Products list       | /admin/productlist                 | ProductListScreen.js       | admin     | [ ]               |
| 14 | Admin: Product edit        | /admin/product/:id/edit            | ProductEditScreen.js       | admin     | [ ]               |
| 15 | Admin: Orders list         | /admin/orderlist                   | OrderListScreen.js         | admin     | [ ]               |
| 16 | Admin: Feature Dashboard   | /admin/featuredashboard            | FeatureDashboardScreen.js  | admin     | [x] обязательно   |

(Phase 0 — Foundation сама по себе галочки в таблице не ставит — это
инфраструктура. Phase 1/2/3 будут отмечать по мере сдачи.)
```

- [ ] **Step 2: Commit**

```bash
git add report.md
git commit -m "course: docs: add M4 redesign section with sitemap progress"
```

---

## Task 2: Refactor `index.css` token contract

**Files:**
- Modify: `frontend/src/index.css` (replace the token blocks per spec §3.3)

The current file uses `:root` (light) + `@media (prefers-color-scheme: dark) { :root { ... } }`. Per spec §3.3, dark must be defined on the `.dark` class so the JS toggle can flip it, and the media query must apply only when no explicit `data-theme` attribute is present.

- [ ] **Step 1: Replace the token blocks**

Read `frontend/src/index.css` and replace the existing `:root { ... }` and `@media (prefers-color-scheme: dark) { ... }` blocks (lines ~57–117) with the following. Leave everything above (font import, `main`, `h1/h2/h3`, carousel rules) untouched.

```css
/* ===========================================================================
   Design System tokens (DESIGN.md §10).
   Light is :root default. Dark applies via .dark class on <html>
   (set by ThemeContext / anti-FOUC script). When the user has not chosen
   (no data-theme attribute on <html>), prefers-color-scheme:dark fills in.
   =========================================================================== */

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

.dark {
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

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "course: refactor: define dark tokens on .dark and gate OS pref by data-theme"
```

---

## Task 3: Add anti-FOUC inline script to `public/index.html`

**Files:**
- Modify: `frontend/public/index.html`

The script must run synchronously in `<head>` BEFORE the React bundle, so the theme is applied to `<html>` before first paint.

- [ ] **Step 1: Insert the inline script**

In `frontend/public/index.html`, insert this `<script>` block immediately after the `<title>` line and before `</head>` (so it runs before any external CSS link below it; anything that depends on `<html data-theme>` reads the right value from the start):

```html
    <script>
      (function () {
        try {
          var saved = localStorage.getItem('proshop-theme');
          var html = document.documentElement;
          if (saved === 'dark') {
            html.setAttribute('data-theme', 'dark');
            html.classList.add('dark');
          } else if (saved === 'light') {
            html.setAttribute('data-theme', 'light');
          }
        } catch (e) { /* localStorage blocked → fall back to OS pref via media query */ }
      })();
    </script>
```

- [ ] **Step 2: Verify the file still validates as HTML**

Open `frontend/public/index.html` in your editor; confirm the `<script>` block sits inside `<head>`, after `<title>`, before `</head>`. No need to run a tool — visual check.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/index.html
git commit -m "course: feat: add anti-FOUC inline theme script in index.html"
```

---

## Task 4: Create `bootstrap-overrides.css`

**Files:**
- Create: `frontend/src/bootstrap-overrides.css`

Pure CSS overrides per spec §3.5. This file re-points the visible Bootstrap component selectors at our tokens. It loads after `bootstrap.min.css` (the Bootswatch base) so cascade wins naturally on most rules; `!important` is reserved for `.navbar-*` because Bootstrap's compiled rules carry high specificity there.

- [ ] **Step 1: Create the file**

Create `frontend/src/bootstrap-overrides.css` with exactly:

```css
/* Bootstrap 4 overrides — re-point component classes at design tokens.
   Loads after bootstrap.min.css and before index.css.
   See docs/superpowers/specs/2026-05-10-m4-foundation-design.md §3.5 */

/* Surface */
body, .bg-light { background: var(--background); color: var(--foreground); }
.card           { background: var(--card); border-color: var(--border); color: var(--foreground); }
.dropdown-menu  { background: var(--card-alt); border-color: var(--border); color: var(--foreground); }
.dropdown-item  { color: var(--foreground); }
.dropdown-item:hover, .dropdown-item:focus {
  background: var(--card); color: var(--foreground);
}

/* Navbar (existing Header uses navbar-dark; new Header uses .app-navbar) */
.navbar-dark, .navbar-light, .app-navbar {
  background: var(--card) !important;
  border-bottom: 1px solid var(--border);
}
.navbar-dark .navbar-brand,
.navbar-dark .nav-link,
.app-navbar .navbar-brand,
.app-navbar .nav-link { color: var(--foreground); }
.navbar-dark .nav-link:hover,
.app-navbar .nav-link:hover { color: var(--primary); }
.navbar-dark .navbar-toggler,
.app-navbar .navbar-toggler { color: var(--foreground); border-color: var(--border); }

/* Buttons */
.btn-primary { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.btn-primary:hover, .btn-primary:focus, .btn-primary:active {
  filter: brightness(1.08);
  background: var(--primary); border-color: var(--primary); color: var(--primary-fg);
}
.btn-danger  { background: var(--destructive); border-color: var(--destructive); color: #fff; }
.btn-info    { background: var(--info); border-color: var(--info); color: #fff; }
.btn-light, .btn-outline-secondary {
  background: transparent; border-color: var(--border); color: var(--foreground);
}
.btn-light:hover, .btn-outline-secondary:hover {
  background: var(--card-alt); border-color: var(--foreground); color: var(--foreground);
}

/* Forms */
.form-control {
  background: var(--background); color: var(--foreground); border-color: var(--border);
}
.form-control:focus {
  background: var(--background); color: var(--foreground); border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent);
}
.form-control::placeholder { color: var(--muted); }
.form-label, label { color: var(--foreground); }

/* Tables */
.table { color: var(--foreground); }
.table th, .table td { border-color: var(--border); }
.table-hover tbody tr:hover { background: var(--card-alt); color: var(--foreground); }

/* Pagination */
.pagination .page-link {
  background: var(--card); color: var(--foreground); border-color: var(--border);
}
.pagination .page-item.active .page-link {
  background: var(--primary); border-color: var(--primary); color: var(--primary-fg);
}
.pagination .page-link:hover {
  background: var(--card-alt); color: var(--foreground);
}

/* List group */
.list-group-item {
  background: var(--card); color: var(--foreground); border-color: var(--border);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/bootstrap-overrides.css
git commit -m "course: feat: add Bootstrap 4 token override stylesheet"
```

---

## Task 5: Wire `bootstrap-overrides.css` into `index.js`

**Files:**
- Modify: `frontend/src/index.js`

- [ ] **Step 1: Add the import**

In `frontend/src/index.js`, replace the existing import block:

```js
import './bootstrap.min.css'
import './index.css'
```

with:

```js
import './bootstrap.min.css'
import './bootstrap-overrides.css'
import './index.css'
```

Order matters: `bootstrap.min.css` first (base), `bootstrap-overrides.css` after (overrides win cascade), `index.css` last (defines the tokens both files reference).

- [ ] **Step 2: Smoke-run the dev server**

```
npm run dev
```

Open http://localhost:3000. Hard-refresh. Verify:
- The page loads without a console error from React (Webpack errors about missing `bootstrap-overrides.css` would block here).
- Light theme is applied (you should see a near-white background, since neither the OS nor a localStorage entry has chosen dark yet — depending on your OS, dark may apply via the media query, which is also fine).

Stop the server (Ctrl+C). If anything fails, fix it before committing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.js
git commit -m "course: feat: wire bootstrap overrides into entry point"
```

---

## Task 6: Create `ThemeContext`

**Files:**
- Create: `frontend/src/context/ThemeContext.js`

The Context owns the user's choice (`'light' | 'dark' | 'system'`), exposes `resolvedTheme` and a `toggleTheme` action, and synchronizes `<html>` (`data-theme` attribute + `.dark` class) on every change. It also subscribes to `matchMedia('(prefers-color-scheme: dark)')` only while the user has no explicit choice.

- [ ] **Step 1: Create the file**

Create `frontend/src/context/ThemeContext.js`:

```js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'proshop-theme'

function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch (e) {
    /* localStorage blocked */
  }
  return 'system'
}

function readOsTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme, resolvedTheme) {
  const html = document.documentElement
  if (theme === 'system') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', theme)
  }
  html.classList.toggle('dark', resolvedTheme === 'dark')
}

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme)
  const [osTheme, setOsTheme] = useState(readOsTheme)

  const resolvedTheme = theme === 'system' ? osTheme : theme

  // Sync DOM whenever theme or resolvedTheme changes.
  useEffect(() => {
    applyTheme(theme, resolvedTheme)
  }, [theme, resolvedTheme])

  // Subscribe to OS preference only while the user has no explicit choice.
  useEffect(() => {
    if (theme !== 'system') return undefined
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setOsTheme(e.matches ? 'dark' : 'light')
    if (mql.addEventListener) mql.addEventListener('change', handler)
    else mql.addListener(handler) // Safari < 14
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler)
      else mql.removeListener(handler)
    }
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch (e) {
      /* localStorage blocked → still flip in-memory */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/context/ThemeContext.js
git commit -m "course: feat: add ThemeContext with localStorage + matchMedia sync"
```

---

## Task 7: Wrap `<App />` in `<ThemeProvider>`

**Files:**
- Modify: `frontend/src/index.js`

- [ ] **Step 1: Add the import and wrap App**

Edit `frontend/src/index.js`. Add the ThemeProvider import and wrap the `<App />` render. The Redux Provider stays the outer wrapper; ThemeProvider is inside it (Theme has no Redux dependency, but this preserves the existing tree shape).

After the edit, the file should look like:

```js
import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'react-redux'
import store from './store'
import './bootstrap.min.css'
import './bootstrap-overrides.css'
import './index.css'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import * as serviceWorker from './serviceWorker'

ReactDOM.render(
  <Provider store={store}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </Provider>,
  document.getElementById('root')
)

serviceWorker.unregister()
```

- [ ] **Step 2: Smoke-run the dev server**

```
npm run dev
```

Open http://localhost:3000. Open DevTools → Console. There should be no React errors about missing context or undefined providers. Inspect `<html>`: it should have either no `data-theme` attribute (system), or the right one if you previously set localStorage. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.js
git commit -m "course: feat: wrap app in ThemeProvider"
```

---

## Task 8: Create `ThemeToggle` component

**Files:**
- Create: `frontend/src/components/ui/ThemeToggle.js`
- Create: `frontend/src/components/ui/ThemeToggle.css`

40×40 IconButton with sun (when current is dark) / moon (when current is light) glyph, transparent background, hover `var(--card-alt)`, focus ring per DESIGN.md §7. `aria-label` reflects the next theme.

- [ ] **Step 1: Create `ThemeToggle.css`**

Create `frontend/src/components/ui/ThemeToggle.css`:

```css
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  margin: 0 var(--space-xs);
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  color: var(--foreground);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.theme-toggle:hover {
  background: var(--card-alt);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.theme-toggle svg {
  width: 18px;
  height: 18px;
}
```

- [ ] **Step 2: Create `ThemeToggle.js`**

Create `frontend/src/components/ui/ThemeToggle.js`:

```js
import React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { useTheme } from '../../context/ThemeContext'
import './ThemeToggle.css'

const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  const Icon = resolvedTheme === 'dark' ? FaSun : FaMoon

  return (
    <button
      type='button'
      className='theme-toggle'
      aria-label={`Switch to ${next} theme`}
      onClick={toggleTheme}
    >
      <Icon aria-hidden='true' />
    </button>
  )
}

export default ThemeToggle
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/ThemeToggle.js frontend/src/components/ui/ThemeToggle.css
git commit -m "course: feat: add ThemeToggle icon button"
```

---

## Task 9: Refactor `Header.js` and add `Header.css`

**Files:**
- Modify: `frontend/src/components/Header.js`
- Create: `frontend/src/components/Header.css`

Drop `bg='dark' variant='dark'`, switch to neutral className `app-navbar`, mount `<ThemeToggle />` between the search box and the cart link.

- [ ] **Step 1: Create `Header.css`**

Create `frontend/src/components/Header.css`:

```css
/* Header surface — uses tokens via .app-navbar override (bootstrap-overrides.css). */
.app-navbar .navbar-brand {
  font-weight: 700;
  letter-spacing: -0.01em;
}
```

(Most of the navbar styling lives in `bootstrap-overrides.css` so it also wins on the legacy `.navbar-dark` class while the rest of the site is unredesigned. This file holds Header-only refinements.)

- [ ] **Step 2: Edit `Header.js`**

Replace the contents of `frontend/src/components/Header.js` with:

```js
import React from 'react'
import { Route } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { LinkContainer } from 'react-router-bootstrap'
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap'
import SearchBox from './SearchBox'
import ThemeToggle from './ui/ThemeToggle'
import { logout } from '../actions/userActions'
import './Header.css'

const Header = () => {
  const dispatch = useDispatch()

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const logoutHandler = () => {
    dispatch(logout())
  }

  return (
    <header>
      <Navbar expand='lg' collapseOnSelect className='app-navbar'>
        <Container>
          <LinkContainer to='/'>
            <Navbar.Brand>ProShop</Navbar.Brand>
          </LinkContainer>
          <Navbar.Toggle aria-controls='basic-navbar-nav' />
          <Navbar.Collapse id='basic-navbar-nav'>
            <Route render={({ history }) => <SearchBox history={history} />} />
            <Nav className='ml-auto align-items-center'>
              <ThemeToggle />
              <LinkContainer to='/cart'>
                <Nav.Link>
                  <i className='fas fa-shopping-cart'></i> Cart
                </Nav.Link>
              </LinkContainer>
              {userInfo ? (
                <NavDropdown title={userInfo.name} id='username'>
                  <LinkContainer to='/profile'>
                    <NavDropdown.Item>Profile</NavDropdown.Item>
                  </LinkContainer>
                  <NavDropdown.Item onClick={logoutHandler}>
                    Logout
                  </NavDropdown.Item>
                </NavDropdown>
              ) : (
                <LinkContainer to='/login'>
                  <Nav.Link>
                    <i className='fas fa-user'></i> Sign In
                  </Nav.Link>
                </LinkContainer>
              )}
              {userInfo && userInfo.isAdmin && (
                <NavDropdown title='Admin' id='adminmenu'>
                  <LinkContainer to='/admin/userlist'>
                    <NavDropdown.Item>Users</NavDropdown.Item>
                  </LinkContainer>
                  <LinkContainer to='/admin/productlist'>
                    <NavDropdown.Item>Products</NavDropdown.Item>
                  </LinkContainer>
                  <LinkContainer to='/admin/orderlist'>
                    <NavDropdown.Item>Orders</NavDropdown.Item>
                  </LinkContainer>
                  <LinkContainer to='/admin/featuredashboard'>
                    <NavDropdown.Item>Feature Flags</NavDropdown.Item>
                  </LinkContainer>
                </NavDropdown>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  )
}

export default Header
```

The only differences from the original:
- Removed `bg='dark' variant='dark'`.
- Added `className='app-navbar'` to `<Navbar>`.
- Added `align-items-center` to the right `<Nav>` so the IconButton aligns with text-based nav links.
- Added `<ThemeToggle />` as the first item in the right Nav.
- Added imports for `ThemeToggle` and `./Header.css`.

- [ ] **Step 3: Smoke-test in the browser**

```
npm run dev
```

Open http://localhost:3000. Verify:
- Navbar background follows the theme (light surface in light mode, dark surface in dark mode), not always-dark like before.
- Cart icon, Sign In, and the search box are visible and readable in both themes.
- Click the sun/moon button in the navbar — the whole page (navbar + content + footer) flips theme.
- Reload the page (Ctrl+R) — the chosen theme persists, no visible flash of the wrong theme.
- Open DevTools → Application → Local Storage → http://localhost:3000 → confirm `proshop-theme` key contains `light` or `dark` after you click.
- Open DevTools → Elements → inspect `<html>` — when you set dark, it should have `class="dark"` and `data-theme="dark"`.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Header.js frontend/src/components/Header.css
git commit -m "course: feat: token-driven Header with theme toggle"
```

---

## Task 10: Atom — `Card`

**Files:**
- Create: `frontend/src/components/ui/Card.js`
- Create: `frontend/src/components/ui/Card.css`

Per DESIGN.md §6 cards.

- [ ] **Step 1: Create `Card.css`**

Create `frontend/src/components/ui/Card.css`:

```css
.ui-card {
  background: var(--card);
  color: var(--foreground);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  transition: background-color 150ms ease, border-color 150ms ease;
}

.ui-card.is-clickable {
  cursor: pointer;
}

.ui-card.is-clickable:hover {
  border-color: var(--primary);
  background: var(--card-alt);
}

.ui-card.is-clickable:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Create `Card.js`**

Create `frontend/src/components/ui/Card.js`:

```js
import React from 'react'
import './Card.css'

const Card = ({ as: Tag = 'div', clickable = false, className = '', children, ...rest }) => {
  const cls = `ui-card ${clickable ? 'is-clickable' : ''} ${className}`.trim()
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}

export default Card
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Card.js frontend/src/components/ui/Card.css
git commit -m "course: feat: add Card UI atom"
```

---

## Task 11: Atom — `Button`

**Files:**
- Create: `frontend/src/components/ui/Button.js`
- Create: `frontend/src/components/ui/Button.css`

Variants per DESIGN.md §6 Buttons. Independent from react-bootstrap `<Button>`.

- [ ] **Step 1: Create `Button.css`**

```css
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-micro);
  padding: 10px 20px;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 150ms ease, background-color 150ms ease, border-color 150ms ease, transform 80ms ease;
  user-select: none;
}

.ui-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.ui-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.ui-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ui-btn--primary {
  background: var(--primary);
  color: var(--primary-fg);
  border-color: var(--primary);
}
.ui-btn--primary:hover:not(:disabled) { filter: brightness(1.08); }

.ui-btn--secondary {
  background: transparent;
  color: var(--foreground);
  border-color: var(--border);
}
.ui-btn--secondary:hover:not(:disabled) {
  background: var(--card-alt);
  border-color: var(--foreground);
}

.ui-btn--danger {
  background: var(--destructive);
  color: #fff;
  border-color: var(--destructive);
}
.ui-btn--danger:hover:not(:disabled) { filter: brightness(1.08); }

.ui-btn--ghost {
  background: transparent;
  color: var(--muted);
  border-color: transparent;
}
.ui-btn--ghost:hover:not(:disabled) {
  background: var(--card-alt);
  color: var(--foreground);
}

.ui-btn--icon {
  padding: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--foreground);
  border-color: transparent;
}
.ui-btn--icon:hover:not(:disabled) { background: var(--card-alt); }

.ui-btn--sm { padding: 6px 14px; font-size: 12px; }

.ui-btn__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ui-btn-spin 0.7s linear infinite;
}
@keyframes ui-btn-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 2: Create `Button.js`**

```js
import React from 'react'
import './Button.css'

const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) => {
  const cls = [
    'ui-btn',
    `ui-btn--${variant}`,
    size === 'sm' ? 'ui-btn--sm' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className='ui-btn__spinner' aria-hidden='true' />}
      {children}
    </button>
  )
}

export default Button
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Button.js frontend/src/components/ui/Button.css
git commit -m "course: feat: add Button UI atom with variants and loading"
```

---

## Task 12: Atom — `Badge`

**Files:**
- Create: `frontend/src/components/ui/Badge.js`
- Create: `frontend/src/components/ui/Badge.css`

Per DESIGN.md §6 Badges/Chips.

- [ ] **Step 1: Create `Badge.css`**

```css
.ui-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ui-badge--default {
  background: color-mix(in srgb, var(--foreground) 10%, transparent);
  color: var(--foreground);
}
.ui-badge--primary {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
}
.ui-badge--danger {
  background: color-mix(in srgb, var(--destructive) 15%, transparent);
  color: var(--destructive);
}
.ui-badge--info {
  background: color-mix(in srgb, var(--info) 15%, transparent);
  color: var(--info);
}
```

- [ ] **Step 2: Create `Badge.js`**

```js
import React from 'react'
import './Badge.css'

const Badge = ({ variant = 'default', className = '', children, ...rest }) => {
  const cls = `ui-badge ui-badge--${variant} ${className}`.trim()
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  )
}

export default Badge
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Badge.js frontend/src/components/ui/Badge.css
git commit -m "course: feat: add Badge UI atom"
```

---

## Task 13: Atom — `FormField`

**Files:**
- Create: `frontend/src/components/ui/FormField.js`
- Create: `frontend/src/components/ui/FormField.css`

`<label>` + `<input>` + error/helper text with proper ARIA wiring per DESIGN.md §6 Inputs and §9 Accessibility.

- [ ] **Step 1: Create `FormField.css`**

```css
.ui-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-micro);
  margin-bottom: var(--space-sm);
}

.ui-field__label {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.ui-field__required {
  color: var(--destructive);
  margin-left: 2px;
}

.ui-field__input {
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 14px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.ui-field__input::placeholder { color: var(--muted); }

.ui-field__input:focus-visible {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 25%, transparent);
}

.ui-field__input.is-invalid {
  border-color: var(--destructive);
}

.ui-field__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ui-field__helper {
  font-size: 13px;
  color: var(--muted);
}

.ui-field__error {
  font-size: 13px;
  color: var(--destructive);
}
```

- [ ] **Step 2: Create `FormField.js`**

```js
import React from 'react'
import './FormField.css'

const FormField = ({
  id,
  label,
  type = 'text',
  required = false,
  error,
  helperText,
  inputProps = {},
  className = '',
  ...rest
}) => {
  const helperId = helperText ? `${id}-helper` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`ui-field ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className='ui-field__label'>
          {label}
          {required && <span className='ui-field__required' aria-hidden='true'>*</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        required={required || undefined}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`ui-field__input ${error ? 'is-invalid' : ''}`.trim()}
        {...inputProps}
        {...rest}
      />
      {helperText && !error && (
        <span id={helperId} className='ui-field__helper'>{helperText}</span>
      )}
      {error && (
        <span id={errorId} role='alert' className='ui-field__error'>{error}</span>
      )}
    </div>
  )
}

export default FormField
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/FormField.js frontend/src/components/ui/FormField.css
git commit -m "course: feat: add FormField UI atom with ARIA wiring"
```

---

## Task 14: Atom — `FormCard`

**Files:**
- Create: `frontend/src/components/ui/FormCard.js`
- Create: `frontend/src/components/ui/FormCard.css`

Centered Card wrapper for auth-style screens (Login, Register, Shipping, Payment).

- [ ] **Step 1: Create `FormCard.css`**

```css
.ui-form-card {
  max-width: 480px;
  margin: var(--space-2xl) auto;
}

.ui-form-card__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--foreground);
  margin: 0 0 var(--space-md) 0;
}

@media (max-width: 640px) {
  .ui-form-card { margin: var(--space-lg) auto; padding: 0 var(--space-sm); }
}
```

- [ ] **Step 2: Create `FormCard.js`**

```js
import React from 'react'
import Card from './Card'
import './FormCard.css'

const FormCard = ({ title, children, className = '', ...rest }) => {
  return (
    <div className={`ui-form-card ${className}`.trim()} {...rest}>
      <Card>
        {title && <h1 className='ui-form-card__title'>{title}</h1>}
        {children}
      </Card>
    </div>
  )
}

export default FormCard
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/FormCard.js frontend/src/components/ui/FormCard.css
git commit -m "course: feat: add FormCard UI atom"
```

---

## Task 15: Atom — `Pagination`

**Files:**
- Create: `frontend/src/components/ui/Pagination.js`
- Create: `frontend/src/components/ui/Pagination.css`

Token-driven page-number row.

- [ ] **Step 1: Create `Pagination.css`**

```css
.ui-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  list-style: none;
  padding: 0;
  margin: var(--space-md) 0;
}

.ui-pagination__item {
  display: inline-flex;
}

.ui-pagination__btn {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  background: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.ui-pagination__btn:hover:not(:disabled) {
  background: var(--card-alt);
}

.ui-pagination__btn.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-fg);
}

.ui-pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ui-pagination__btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Create `Pagination.js`**

```js
import React from 'react'
import './Pagination.css'

const Pagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  if (totalPages <= 1) return null

  const pages = []
  for (let p = 1; p <= totalPages; p += 1) pages.push(p)

  const handle = (p) => () => {
    if (p < 1 || p > totalPages || p === currentPage) return
    onPageChange && onPageChange(p)
  }

  return (
    <ul className='ui-pagination' aria-label='Pagination'>
      <li className='ui-pagination__item'>
        <button
          type='button'
          className='ui-pagination__btn'
          onClick={handle(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label='Previous page'
        >
          ‹
        </button>
      </li>
      {pages.map((p) => (
        <li key={p} className='ui-pagination__item'>
          <button
            type='button'
            className={`ui-pagination__btn ${p === currentPage ? 'is-active' : ''}`.trim()}
            onClick={handle(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        </li>
      ))}
      <li className='ui-pagination__item'>
        <button
          type='button'
          className='ui-pagination__btn'
          onClick={handle(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label='Next page'
        >
          ›
        </button>
      </li>
    </ul>
  )
}

export default Pagination
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Pagination.js frontend/src/components/ui/Pagination.css
git commit -m "course: feat: add Pagination UI atom"
```

---

## Task 16: Atom — `DataTable`

**Files:**
- Create: `frontend/src/components/ui/DataTable.js`
- Create: `frontend/src/components/ui/DataTable.css`

Wrapper around `<table>` per DESIGN.md §6 Tables, with skeleton-loading body and slot for empty state.

- [ ] **Step 1: Create `DataTable.css`**

```css
.ui-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.ui-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card);
  color: var(--foreground);
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 14px;
}

.ui-table thead th {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.ui-table tbody td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.ui-table tbody tr:hover {
  background: var(--card-alt);
}

.ui-table .is-mono {
  font-family: 'DM Mono', 'SF Mono', Consolas, monospace;
  font-feature-settings: 'tnum' 1;
}

.ui-table .is-right { text-align: right; }
.ui-table .is-center { text-align: center; }

@keyframes ui-skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.ui-table .ui-skeleton {
  display: inline-block;
  height: 14px;
  width: 80%;
  background: linear-gradient(90deg, var(--card-alt) 0%, var(--border) 50%, var(--card-alt) 100%);
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: ui-skeleton-shimmer 1.5s infinite linear;
}

.ui-table__empty {
  padding: var(--space-xl) var(--space-md);
}
```

- [ ] **Step 2: Create `DataTable.js`**

```js
import React from 'react'
import './DataTable.css'

function getCellClass(col) {
  return [
    col.mono ? 'is-mono' : '',
    col.align === 'right' ? 'is-right' : '',
    col.align === 'center' ? 'is-center' : '',
  ].filter(Boolean).join(' ')
}

const DataTable = ({
  columns = [],
  rows = [],
  loading = false,
  emptyState = null,
  rowKey = 'id',
  className = '',
}) => {
  const skeletonRows = 6

  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className='ui-table'>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={getCellClass(c)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={`sk-${i}`}>
              {columns.map((c) => (
                <td key={c.key} className={getCellClass(c)}>
                  <span className='ui-skeleton' />
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className='ui-table__empty'>
                {emptyState}
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((c) => (
                <td key={c.key} className={getCellClass(c)}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/DataTable.js frontend/src/components/ui/DataTable.css
git commit -m "course: feat: add DataTable UI atom with skeleton loading"
```

---

## Task 17: Barrel `ui/index.js`

**Files:**
- Create: `frontend/src/components/ui/index.js`

- [ ] **Step 1: Create the barrel**

```js
export { default as Badge } from './Badge'
export { default as Button } from './Button'
export { default as Card } from './Card'
export { default as DataTable } from './DataTable'
export { default as FormCard } from './FormCard'
export { default as FormField } from './FormField'
export { default as Pagination } from './Pagination'
export { default as ThemeToggle } from './ThemeToggle'
```

(`EmptyState` lives at `frontend/src/components/EmptyState.js`, not in `ui/`. It is intentionally not re-exported here — Phase 1+ keeps its existing import path.)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/index.js
git commit -m "course: feat: add UI atoms barrel"
```

---

## Task 18: Final acceptance verification

This task runs through the spec §7 acceptance criteria. No new code — only verification + a final commit if any small fixups are needed.

- [ ] **Step 1: Existing test still passes**

```
npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false
```

Expected: PASS. If FAIL, investigate which override or import is interfering and fix before continuing.

- [ ] **Step 2: Dev server boots clean**

```
npm run dev
```

Expected: backend on :5000 and CRA on :3000 both up, no compile errors in the CRA terminal output.

- [ ] **Step 3: Manual browser checks**

Open http://localhost:3000 and walk through:

| Check | Expected |
|---|---|
| Header background follows theme | Light surface in light mode, dark surface in dark mode (not always-dark). |
| Click theme toggle | Whole page (Header, Home, Footer) flips. |
| Reload after toggle | Theme persists; no flash of the previously-applied theme. |
| `<html>` after picking dark | Has both `data-theme="dark"` and `class="dark"` (DevTools → Elements). |
| `<html>` after picking light | Has `data-theme="light"`, no `dark` class. |
| Clear `localStorage['proshop-theme']` and reload | Theme follows OS pref (try changing OS theme to confirm). |
| Visit `/cart`, `/login`, `/admin/featuredashboard` (login as admin) | All three look readable in both themes — text is on contrasting surface, no white-on-white or black-on-black. |
| Tab through navbar | Theme toggle is reachable; focus ring visible. |
| Activate toggle with Space/Enter | Theme flips. |
| Toggle's `aria-label` | Reads "Switch to dark theme" when current is light, and vice versa. |

If any check fails, fix it and commit the fix (commit message format: `course: fix: <what>`). Otherwise no new commit needed for this task.

- [ ] **Step 4: Spec acceptance traceability**

Open `docs/superpowers/specs/2026-05-10-m4-foundation-design.md` §7 and confirm:

1. `report.md` has the new section with the table — Task 1 ✓
2. Toggle switches the whole site — Task 9 + Step 3 above ✓
3. Reload preserves + no FOUC — Task 3 + Step 3 above ✓
4. OS pref + dark fallback — Task 2 + Task 6 + Step 3 above ✓
5. Atoms exist — Tasks 10–17 ✓
6. `bootstrap-overrides.css` compiles, legacy screens read tokens — Task 4 + Step 3 above ✓
7. Header has no `bg='dark'` — Task 9 ✓
8. Eight wireframes in spec (§5) — already in the spec, no plan task needed ✓
9. No screen redesigned — implicit, no screens were touched ✓
10. Dev server clean + tests pass — Steps 1 + 2 above ✓
11. Toggle keyboard accessible — Task 8 + Step 3 above ✓
12. Contrast spot-check — Step 3 above ✓

If any criterion is unmet, return to the relevant task. Otherwise Phase 0 is done.

---

## Done definition

- All 18 tasks above are checked off.
- All commits land on `m4-redesign`.
- The spec's 12 acceptance criteria (§7) are verified manually (Task 18 Step 3/4).
- No regression in `FeatureListScreen.test.js`.

When done, propose the commit log to the user and ask whether to:
- Open a PR for Phase 0 alone (recommended — Phase 0 is a self-contained reviewable unit), or
- Continue straight into Phase 1 (Public) on the same branch.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Dependencies are installed in two places (root + frontend):

```
npm install
npm install --prefix frontend
```

Dev (runs API on :5000 and CRA dev server on :3000 concurrently):

```
npm run dev
```

Other scripts (from repo root):

- `npm run server` — backend only, with nodemon reload
- `npm run client` — frontend only (CRA dev server)
- `npm start` — backend in non-reload mode (what `Procfile` / Heroku uses)
- `npm run data:import` / `npm run data:destroy` — seed or wipe MongoDB using `backend/data/*`
- `npm run build --prefix frontend` — produce `frontend/build` (also run by `heroku-postbuild`)
- `npm test --prefix frontend` — run CRA/Jest tests. Single test: `npm test --prefix frontend -- --testPathPattern=<file>`; append `-- --watchAll=false` for one-shot mode.

No backend test runner or linter is configured — the only lint config is CRA's `eslintConfig: react-app` in `frontend/package.json`.

Required `.env` at repo root: `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `PAYPAL_CLIENT_ID`.

## Tech Stack

**Runtime**
- Node ≥ 14.6 (for native ESM without flags)
- No npm workspaces — root and `frontend/` install independently via `--prefix`

**Backend**
- Express 4.17, Mongoose **5.10** (not 6+ — uses `useCreateIndex`/`useNewUrlParser`/`useUnifiedTopology`)
- `jsonwebtoken` 8, `bcryptjs` 2
- `express-async-handler` — the only async-handling pattern (throw → error middleware)
- `multer` 1.4 on disk storage
- `morgan` (dev only), `dotenv`, `colors`
- Dev: `nodemon`, `concurrently`

**Frontend**
- React **16.13** (not 17/18 — no automatic batching, no new JSX runtime)
- `react-router-dom` **v5** (not v6 — API is `<Route component={X}>`, not `element`)
- Classic Redux 4 + `redux-thunk` (**not** Redux Toolkit)
- `axios` 0.20, `react-bootstrap` 1.3, `react-paypal-button-v2`, `react-helmet`
- CRA 3.4.3 (`react-scripts` — Webpack 4)

**Explicitly NOT used — don't migrate without a direct request**
- Redux Toolkit / RTK Query
- React 17+ / react-router-dom v6
- Mongoose 6+ (breaks `config/db.js`)
- Hooks-only in new screens when neighbors use class-style — match the pattern in adjacent files

## Architecture

This is a MERN app split into two deployables that run as one in production:

- **`backend/`** — Express API on port 5000, **ES Modules** (`"type": "module"`).
- **`frontend/`** — Create React App. In dev it proxies `/api/*` to `http://127.0.0.1:5000` via the `proxy` field in `frontend/package.json`.
- **Production mode** (`NODE_ENV=production`): `backend/server.js` serves `frontend/build` as static and falls back to `index.html` for non-API routes, so the whole app runs on the single Express port. `Procfile` (`web: node backend/server.js`) is what Heroku executes after `heroku-postbuild` builds the frontend.

### Backend request flow

`server.js` mounts four route modules plus a PayPal config endpoint and a static `/uploads` directory:

```
/api/products  /api/users  /api/orders  /api/upload  /api/config/paypal  /uploads
```

Each route file wires Express routes to a controller in `backend/controllers/`. Controllers read/write Mongoose models in `backend/models/` (`productModel`, `userModel`, `orderModel`).

Auth composes middleware: `authMiddleware.js` exports `protect` (verifies the JWT and hydrates `req.user`) and `admin` (requires `req.user.isAdmin`). Admin-only routes register them as `protect, admin, handler`. Tokens are minted by `utils/generateToken.js` using `process.env.JWT_SECRET`.

File uploads go through `multer` disk storage in `routes/uploadRoutes.js`, writing to `uploads/` (served statically). Only `jpg|jpeg|png` pass `checkFileType`.

MongoDB connection is established once at startup by `config/db.js`; don't open additional connections.

### Frontend Redux layout

Classic Redux (not RTK) with `redux-thunk`. `frontend/src/store.js` combines ~20 domain-split reducers across four domains — products, cart, users, orders. Each domain has:

- `constants/<domain>Constants.js` — action-type strings
- `actions/<domain>Actions.js` — thunks that call the API with `axios` and dispatch those actions
- `reducers/<domain>Reducers.js` — one reducer per async operation (`productListReducer`, `productDetailsReducer`, …), each registered individually in `store.js`

Routing lives entirely in `frontend/src/App.js`. `/admin/*` routes are for admin-only screens (the backend enforces `admin`; the screens also guard via `userInfo.isAdmin`).

## Conventions

**Naming**
- Backend files: camelCase by role — `productController.js`, `authMiddleware.js`, `orderModel.js`
- Frontend components/screens: PascalCase — `HomeScreen.js`, `ProductCarousel.js`
- Frontend actions/reducers/constants: camelCase with domain prefix — `productActions.js`
- Mongoose: file `xModel.js` default-exports PascalCase `X`
- Redux constants: `DOMAIN_ACTION_STATE` — e.g. `PRODUCT_LIST_REQUEST`, `USER_LOGIN_SUCCESS`, `ORDER_DELIVER_RESET`

**Imports**
- Backend relative imports **must end in `.js`** (ESM rule — Node refuses to resolve otherwise)
- Backend: default export for one-thing modules (router, middleware, `connectDB`); named exports for controllers
- Frontend: no extensions in import paths (CRA); absolute imports aren't configured — use relative paths

**Error handling (backend)**
- Wrap every async controller in `asyncHandler(async (req, res) => { ... })`
- Return errors via `res.status(4xx)` followed by `throw new Error('message')` — `errorMiddleware.errorHandler` picks up the status already set on the response
- Document every route handler with a JSDoc-style comment:
  ```js
  // @desc    Fetch all products
  // @route   GET /api/products
  // @access  Public
  ```

**API calls (frontend)**
- Thunks call `axios` directly (no client wrapper)
- Build the auth header inline from `getState().userLogin.userInfo.token`:
  ```js
  const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
  ```

**Redux slice pattern**
- Four action types per async operation: `*_REQUEST` (loading), `*_SUCCESS` (data), `*_FAIL` (error), optional `*_RESET`
- One reducer per async operation — don't combine into a single domain reducer
- Persist to `localStorage` only what must survive reload: `cart.cartItems`, `cart.shippingAddress`, `userLogin.userInfo`. Rehydrate in `store.js` initial state.

### Commit rules

- Format: `course: <type>: <summary>` where `<type>` ∈ `feat | fix | docs | refactor | chore | test | style | perf`
- Language: English, imperative mood (`add`, `fix` — not `added`/`fixes`)
- First line ≤ 72 characters; body is optional and separated by a blank line
- **Do not** add a `Co-Authored-By:` trailer
- Do not use `--no-verify`; do not amend pushed commits

## Gotchas & Deployment Quirks

**Local gotchas**
- **Mongoose 5 connect options are required.** `config/db.js` passes `useCreateIndex`/`useNewUrlParser`/`useUnifiedTopology` — these were removed in Mongoose 6, so upgrading means rewriting the connect call.
- **`colors` patches `String.prototype`.** The `'text'.red.bold` syntax in `server.js` and `seeder.js` only works because of that import — removing the package breaks both files.
- **Dev proxy uses `127.0.0.1`, not `localhost`.** Explicit IPv4 in `frontend/package.json` — on Windows `localhost` can resolve to `::1` and the proxy silently fails.
- **SPA fallback must stay last.** In prod `app.get('*', ...)` returns `index.html` for everything; register any new `/api/*` route **before** that block in `server.js` or you'll get HTML instead of JSON.
- **`localStorage` is the source of truth for cart/user/shipping.** `npm run data:destroy` wipes Mongo but not the browser — after a re-seed, a logged-in user in the UI is a dangling reference to a deleted ID.
- **PayPal client ID is not a `REACT_APP_*` var.** The frontend doesn't read `.env` directly — it fetches the ID at runtime from `/api/config/paypal`. Expose new secrets the same way, not via CRA env.
- **JWT is HS256 with a 30-day expiry** (`utils/generateToken.js`). No refresh tokens; expired token = logout.

**Deployment quirks**
- **`Procfile` runs `node backend/server.js` directly** — no nodemon, no preload.
- **`heroku-postbuild` sets `NPM_CONFIG_PRODUCTION=false`** before installing `frontend/`, otherwise CRA (`react-scripts` is in devDeps) won't install and the build fails.
- **Single port in prod.** `NODE_ENV=production` flips `server.js` into serving `frontend/build` as static; API and SPA share one origin, so CORS isn't configured.
- **`uploads/` lives on local filesystem.** On Heroku this is an ephemeral dyno — images uploaded via `/api/upload` are lost on restart. Fine for the course, needs S3/external storage for real deployment.

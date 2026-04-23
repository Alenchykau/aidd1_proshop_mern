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
- `npm test --prefix frontend` — run CRA/Jest tests. To run a single test: `npm test --prefix frontend -- --testPathPattern=<file>` (watch mode is the default; append `-- --watchAll=false` for one-shot).

No backend test runner or linter is configured — the only lint config is CRA's `eslintConfig: react-app` in `frontend/package.json`.

Required `.env` at repo root: `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `PAYPAL_CLIENT_ID`.

## Architecture

This is a MERN app split into two deployables that run as one in production:

- **`backend/`** — Express API on port 5000, **ES Modules** (`"type": "module"`). Every relative import must end in `.js` or Node will refuse to resolve it.
- **`frontend/`** — Create React App (react-scripts 3.4.3, React 16, `react-router-dom` v5). In dev it proxies `/api/*` to `http://127.0.0.1:5000` via the `proxy` field in `frontend/package.json`.
- **Production mode** (`NODE_ENV=production`): `backend/server.js` serves `frontend/build` as static and falls back to `index.html` for non-API routes, so the whole app runs on the single Express port. `Procfile` (`web: node backend/server.js`) is what Heroku executes after `heroku-postbuild` builds the frontend.

### Backend request flow

`server.js` mounts four route modules plus a PayPal config endpoint and a static `/uploads` directory:

```
/api/products  /api/users  /api/orders  /api/upload  /api/config/paypal  /uploads
```

Each route file wires Express routes to a controller in `backend/controllers/`. Controllers read/write Mongoose models in `backend/models/` (`productModel`, `userModel`, `orderModel`).

Conventions to preserve when adding endpoints:

- Wrap every async controller in `express-async-handler` so thrown errors propagate to `errorMiddleware.errorHandler`. Throwing `new Error('...')` after `res.status(4xx)` is the idiomatic way to return an error — the handler picks up the status code already set on the response.
- Auth is JWT via `Authorization: Bearer <token>`. `middleware/authMiddleware.js` exports `protect` (verifies the token and hydrates `req.user`) and `admin` (requires `req.user.isAdmin`). Compose them as `protect, admin, handler` on admin-only routes. Tokens are minted by `utils/generateToken.js` using `process.env.JWT_SECRET`.
- File uploads go through `multer` disk storage in `routes/uploadRoutes.js`, writing to `uploads/` (served statically). Only `jpg|jpeg|png` pass `checkFileType`.
- MongoDB connection is established once at startup by `config/db.js`; don't open additional connections.

### Frontend Redux layout

This project uses **classic Redux** (not Redux Toolkit) with `redux-thunk`. `frontend/src/store.js` combines ~20 domain-split reducers across four domains — products, cart, users, orders — each following the `*_REQUEST / *_SUCCESS / *_FAIL / *_RESET` action-type pattern defined in `frontend/src/constants/`.

Structure per domain:

- `constants/<domain>Constants.js` — action-type strings
- `actions/<domain>Actions.js` — thunks that call the API with `axios` and dispatch those actions
- `reducers/<domain>Reducers.js` — one reducer per async operation (e.g. `productListReducer`, `productDetailsReducer`, `productCreateReducer`); they're registered individually in `store.js`, so adding a new operation means adding a new reducer slice, not extending an existing one.

Three slices persist to `localStorage` and are rehydrated into `initialState` in `store.js`: `cart.cartItems`, `cart.shippingAddress`, `userLogin.userInfo`. When you add state that must survive reload, extend the same pattern — don't introduce a separate persistence layer.

Routing lives entirely in `frontend/src/App.js`. `/admin/*` routes are for admin-only screens (the backend enforces `admin`, but the frontend screens also guard via `userInfo.isAdmin`).

## Notes

- README instructs using Node ≥ v14.6 for ES Modules without flags.
- The README states the project is deprecated in favor of `proshop-v2` (Redux Toolkit). Don't migrate to RTK unless asked — existing code deliberately uses classic Redux.

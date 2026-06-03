# 5. Introduce an authorization layer separate from authentication

- Status: **Proposed**
- Date: 2026-06-01 (drafted during M6 Stage 1 architecture review; ARCH-002)
- Confidence: HIGH (IDOR class observed; one instance fixed in M6 Stage 2)

## Context

The project has authentication (`authMiddleware.protect`) and a coarse admin gate (`authMiddleware.admin`) but **no authorization layer** for resource ownership. Consequences observed in Stage 1:

- `GET /api/orders/:id` returned any order to any logged-in user (SEC-001 IDOR) — **fixed in M6 Stage 2** with an inline ownership check.
- `PUT /api/orders/:id/pay` marks any order paid with no ownership check (SEC-002, still open).
- SPA admin routes are guarded only by per-screen `useEffect` redirects (ARCH-015) — easy to forget on a new screen.
- `admin` middleware returns 401 instead of 403 (ARCH-010), conflating authn/authz error channels and forcing the frontend to match error text instead of status codes (ARCH-017).

The Stage-2 inline fix proves the point: ownership logic copied per-handler will be forgotten on the next `/:id` route.

## Decision

Introduce `backend/middleware/authz.js` with explicit ownership policies (`ownsOrder`, `ownsResource(Model, ownerField)`) and a clean `isAdmin` that returns **403** on failure. Wire them after `protect` on every `/:id`-style private route. On the SPA, add `PrivateRoute` / `AdminRoute` (react-router v5 render-prop) and wrap all admin routes in `App.js`. The axios layer branches on HTTP status (401 → logout, 403 → "no access") instead of error text.

## Consequences

**Positive:** new `/:id` endpoints get IDOR protection by default; authn/authz error channels become machine-readable; per-screen redirect duplication disappears.
**Negative:** touching every controller is a non-trivial diff; `Model.findById` may run twice (policy + handler) — mitigate with a `loadResource` helper.

## Alternatives considered

- CASL / accesscontrol packages — heavier than needed for this app.
- Per-controller ownership checks (status quo) — relies on humans not forgetting; the IDOR class is the evidence it fails.

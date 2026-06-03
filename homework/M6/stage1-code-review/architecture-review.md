# Architecture Mate - Review Summary

**Reviewer:** architecture-mate (Opus 4.7)
**Scope:** whole fork (backend/, frontend/src/, mcp-feature-flags/, mcp-project-docs/, scripts/, docs/adr/)
**ADRs loaded (active, fork):** 3 - docs/adr/0001-jwt-bearer-token-in-localstorage.md, 0002-single-process-prod-deployment.md, 0003-runtime-paypal-client-id-endpoint.md
**ADRs ignored (synthetic RAG corpus):** docs/project-data/adrs/adr-001..005 - explicitly out of scope per task brief
**Findings file:** homework/M6/stage1-code-review/architecture-findings.jsonl (17 lines, valid JSONL)

---

## Findings by criticality

- **C1 (critical):** 4 - ARCH-001, ARCH-002, ARCH-003, ARCH-008
- **C2 (medium):** 8 - ARCH-004, ARCH-005, ARCH-006, ARCH-010, ARCH-011, ARCH-013, ARCH-014, ARCH-015
- **C3 (hygiene):** 5 - ARCH-007, ARCH-009, ARCH-012, ARCH-016, ARCH-017
- Total: 17

## Top concerns (C1)

1. **ARCH-001 backend/utils/featureFile.js:4** - backend writes features.json directly via fs.writeFile, bypassing the feature-flags MCP gateway that CLAUDE.md mandates as the only legal writer. Two writer code paths to the same file with no cross-process locking. Cross-ref PERF-005 / PERF-006 (no caching makes the dual-writer story worse). ADR candidate.
2. **ARCH-002 backend/controllers/orderController.js:43** - no authorization layer in the project; protect only verifies authn, ownership checks are expected per-controller and are missing. Surface: SEC-001 IDOR on GET /api/orders/:id, SEC-002 unauthenticated mark-as-paid. Fix is architectural (middleware/authz.js), not just patching each route. ADR candidate.
3. **ARCH-003 backend/controllers/orderController.js:60** - updateOrderToPaid writes a paymentResult from the client body verbatim with no PaymentProvider.verifyCapture step and no abstraction over PayPal vs anything else. ADR-0003 covers runtime client-id but not server-side verification. Cross-ref SEC-002. ADR candidate.
4. **ARCH-008 backend/routes/uploadRoutes.js:37** - upload route conflates infra (multer disk, file-filter), HTTP handler and response shaping; no auth, no storage abstraction, and the URL shape returned to clients (/req.file.path) leaks the filesystem layout into the public API contract. A future S3/Cloudinary swap is a breaking change. Cross-ref SEC-008, PERF-015. ADR candidate.

## Cross-cutting C2 themes

- **No service layer (ARCH-004)** - controllers own orchestration; the same shape (findById -> mutate -> save -> JSON-shape with token) is hand-copied across user/product/order controllers. ADR candidate to either (a) document the decision or (b) introduce services/.
- **No API client on the SPA (ARCH-005)** - every thunk hand-builds the Authorization: Bearer header; ADR-0001 already flagged this as a consequence. Solvable with one axios instance + interceptor.
- **Layer violation: derived state into Redux objects during render (ARCH-006)** - OrderScreen / PlaceOrderScreen mutate Redux-owned objects in the render path. Same root issue performance-mate captured as PERF-011.
- **authn vs authz channels conflated (ARCH-010)** - admin middleware returns 401 not 403; the frontend matches error text instead of codes (ARCH-017).
- **Persistence boundary missing (ARCH-011)** - localStorage is written from many sites without a single middleware.
- **MCP-backend coupling (ARCH-013) and MCP-scripts coupling (ARCH-014)** - both polyglot boundaries are wired by relative file paths or sys.path mutation with no schema/package contract.
- **No route-level authorization in the SPA (ARCH-015)** - every admin screen re-inlines its own userInfo.isAdmin redirect.

## Cross-specialist references

Read homework/M6/stage1-code-review/security-review.md and performance-review.md. Cross-refs woven into findings:

| Architecture | Security | Performance |
|---|---|---|
| ARCH-001 (MCP gateway bypass) | - | PERF-005, PERF-006 |
| ARCH-002 (no authz layer) | SEC-001 IDOR, SEC-002, SEC-005 | - |
| ARCH-003 (no PaymentProvider) | SEC-002 | - |
| ARCH-006 (derived-state in render) | - | PERF-011 |
| ARCH-007 (config endpoint hygiene) | SEC-014 | PERF-016 |
| ARCH-008 (upload boundary/storage) | SEC-008 | PERF-015 |
| ARCH-013 (MCP-backend file coupling) | SEC-015, SEC-016 | PERF-005, PERF-006 |
| ARCH-014 (sys.path mutation in MCP) | SEC-017 | PERF-007 |

## Proposed ADRs (2 new)

### ADR-0004 (proposed): Feature-flags MCP is the only writer for backend/features.json

**Status:** Proposed (drafted by architecture-mate during M6 stage-1 review)
**Date:** 2026-06-01
**Triggers:** ARCH-001, ARCH-013, PERF-005, PERF-006

**Context.** backend/features.json is the source of truth for runtime feature flags. CLAUDE.md states the file MUST only be mutated through the feature-flags MCP (it validates dependencies, enforces the disabled-traffic lock, stamps last_modified). The current implementation has two writers: backend/utils/featureFile.js (called from featureController.updateFeature on PUT /api/feature-flags/:key) writes the file directly, and mcp-feature-flags/server.ts writes it through set_feature_state / adjust_traffic_rollout. The Express writer re-implements a subset of MCP validation (validateEnable, INVALID_TRAFFIC, DISABLED_TRAFFIC_LOCKED) - drift is one PR away.

**Decision.** The feature-flags MCP is the only process allowed to write backend/features.json. The Express backend (admin dashboard PUT endpoint) becomes an MCP client: it calls the MCP HTTP transport (POST /mcp with set_feature_state / adjust_traffic_rollout) instead of fs.writeFile. backend/utils/featureFile.js keeps only a read-only cached loader for runtime gating. A startup assertion verifies the MCP is reachable.

**Consequences (positive).** Single writer -> no cross-process race, no validation drift, single audit point. Caching becomes easy.

**Consequences (negative).** Backend now depends on the MCP HTTP transport in production. Need a deployment story for the MCP under Heroku (separate dyno or sidecar).

**Alternatives considered.** (a) Status quo with file-lock advisory locks - fragile across processes/OSes. (b) Move flags to MongoDB - bigger refactor.

---

### ADR-0005 (proposed): Introduce an authorization layer separate from authentication

**Status:** Proposed (drafted by architecture-mate during M6 stage-1 review)
**Date:** 2026-06-01
**Triggers:** ARCH-002, ARCH-010, ARCH-015, SEC-001, SEC-002, SEC-005

**Context.** The project has authentication (authMiddleware.protect) and a coarse admin gate (authMiddleware.admin) but no authorization layer for resource ownership. Three concrete consequences: GET /api/orders/:id returns any order to any logged-in user (SEC-001 IDOR), PUT /api/orders/:id/pay marks any order paid (SEC-002), and the SPA admin routes are guarded only by per-screen useEffect redirects (ARCH-015), easy to forget on a new screen (FeatureListScreen). The admin middleware also returns 401 instead of 403 (ARCH-010), conflating authn and authz error channels and forcing the frontend to match error message text instead of status codes.

**Decision.** Introduce backend/middleware/authz.js with explicit ownership policies: ownsOrder, ownsResource(Model, ownerField), plus a clean isAdmin that returns 403 on failure. Wire them after protect in every /:id-style private route. On the SPA add PrivateRoute and AdminRoute (react-router v5 render-prop pattern) and wrap all admin routes in App.js. The frontend axios interceptor branches on HTTP status code (401 -> logout, 403 -> flash no-access) instead of error text.

**Consequences (positive).** New /:id endpoints get IDOR protection by default. Authn/authz error channels become machine-readable. Per-screen redirect duplication disappears.

**Consequences (negative).** Touching every controller is a non-trivial diff. Model.findById may happen twice on protected routes (once in policy, once in handler) - fix with a loadResource helper.

**Alternatives considered.** (a) CASL / accesscontrol packages - heavier than needed. (b) Per-controller ownership checks in code - what we have today; relies on humans not forgetting.

## Status

- All 3 active ADRs (docs/adr/0001..0003) were loaded and cross-referenced; no ADR is violated by static code, but ADR-0001 consequences (per-thunk auth header, no revocation) and ADR-0003 consequences (no caching, no validation) are unaddressed and surface as ARCH-005 / ARCH-007.
- Layer boundaries scanned across route - controller - model on the backend, screens - reducers - actions - store on the frontend, and the two MCPs.
- API contract stability checked: no breaking changes in this scope; ARCH-008 (URL shape leaking disk path) and ARCH-017 (error envelope) are latent breaking-change vectors.
- 17 findings written to homework/M6/stage1-code-review/architecture-findings.jsonl (C1=4, C2=8, C3=5).
- 2 new ADRs proposed inline (ADR-0004, ADR-0005). Not written under docs/adr/ per scope (only two report files allowed).

# Security Review — ProShop MERN fork (stage 1, M6)

**Scope:** entire repository — backend (Express 4 / Mongoose 5), frontend (React 16.13 / classic Redux 4), MCP feature-flags (TS), MCP project-docs (Python), RAG scripts/. Excluded per task: tests, node_modules, build artefacts, docs/project-data/ (RAG corpus, not source).

**Methodology:** read CLAUDE.md + DESIGN.md + docs/adr/0001-0003 first, then walked all controllers/routes/middleware/models/utils, both MCP servers, RAG scripts, package.json, .env, .gitignore. Owasp Top 10 (2021) mapping. Test files explicitly skipped.

**No code was modified.** Findings only.


## Summary

- **Total findings:** 20
- **HIGH:** 6
- **MEDIUM:** 7
- **LOW:** 7


### Top 3 critical (file:line)

1. **backend/controllers/orderController.js:43** — IDOR: any authenticated user can read any order by id (A01 Broken Access Control)
1. **backend/controllers/orderController.js:60** — Any authenticated user can mark any order as paid with arbitrary paymentResult (A01 Broken Access Control)
1. **.env:4** — Trivial JWT_SECRET (abc123) used to sign 30-day HS256 tokens (A02 Cryptographic Failures)


## HIGH (6)

### SEC-001 — IDOR: any authenticated user can read any order by id

- **File:** `backend/controllers/orderController.js:43`
- **Severity:** HIGH
- **OWASP:** A01 Broken Access Control
- **Detail:** getOrderById fetches Order by req.params.id and returns it without verifying ownership. Route /api/orders/:id is wrapped only by protect (orderRoutes.js:15), so any logged-in customer can enumerate IDs and read other users' shipping addresses, paymentResult.email_address, totals.
- **Fix:** After Order.findById, return 403 unless order.user.toString() === req.user._id.toString() || req.user.isAdmin.

### SEC-002 — Any authenticated user can mark any order as paid with arbitrary paymentResult

- **File:** `backend/controllers/orderController.js:60`
- **Severity:** HIGH
- **OWASP:** A01 Broken Access Control
- **Detail:** updateOrderToPaid (PUT /api/orders/:id/pay, orderRoutes.js:16) uses protect only and writes isPaid=true plus paymentResult from req.body without verifying ownership and without calling PayPal to verify the capture id/amount/currency. A logged-in attacker can mark someone else's order paid.
- **Fix:** Verify ownership; verify the PayPal transaction server-side via PayPal Orders API using captured id; reject if amount/currency/status do not match the stored order.

### SEC-003 — Trivial JWT_SECRET (abc123) used to sign 30-day HS256 tokens

- **File:** `.env:4`
- **Severity:** HIGH
- **OWASP:** A02 Cryptographic Failures
- **Detail:** JWT_SECRET=abc123 is brute-forceable in milliseconds. Tokens are HS256 with 30-day expiry, no rotation, no revocation list (ADR-0001). A leaked or guessed secret lets an attacker mint tokens that pass protect+admin for 30 days. .env is git-ignored but this value will be re-used by anyone cloning the repo; there is no startup assertion against weak secrets.
- **Fix:** Generate a 256-bit random secret (openssl rand -base64 32); assert at startup that JWT_SECRET length >= 32; fail-fast otherwise.

### SEC-005 — Admin updateUser blindly assigns req.body.isAdmin (no validation, no audit)

- **File:** `backend/controllers/userController.js:153`
- **Severity:** HIGH
- **OWASP:** A01 Broken Access Control
- **Detail:** user.isAdmin = req.body.isAdmin sets the privilege flag from raw body. No boolean validation (any truthy value sticks), no audit log, no guard against demoting the last admin. The frontend gates admin UI purely on userInfo.isAdmin (from localStorage).
- **Fix:** Validate isAdmin is strictly boolean; reject otherwise; emit audit log (actor, target, before/after); consider a dedicated PUT /api/users/:id/role endpoint.

### SEC-007 — No rate-limit on /api/users/login (credential stuffing)

- **File:** `backend/routes/userRoutes.js:16`
- **Severity:** HIGH
- **OWASP:** A07 Identification and Authentication Failures
- **Detail:** POST /api/users/login is wired with no rate-limit middleware. No account lockout, no CAPTCHA. Combined with the trivial JWT_SECRET and no password policy, the system is wide open to credential stuffing. Same gap on POST /api/users (register).
- **Fix:** Add express-rate-limit (5 failed attempts / 15 min / IP+username) on /login and a looser limit on /register.

### SEC-008 — POST /api/upload is unauthenticated, no size limit, only checks client-supplied MIME

- **File:** `backend/routes/uploadRoutes.js:37`
- **Severity:** HIGH
- **OWASP:** A04 Insecure Design
- **Detail:** router.post (/, upload.single(image), handler) has neither protect nor admin. Anyone on the internet can POST files. No multer limits.fileSize is set; a single huge POST exhausts ephemeral FS. MIME check (line 21) trusts client-supplied file.mimetype. Files are served as static (server.js:38).
- **Fix:** Wrap with protect, admin; add multer limits.fileSize 2MB; sniff magic bytes via file-type pkg; sanitise originalname extension via path.basename + allowlist.


## MEDIUM (7)

### SEC-004 — User-controlled regex fed into Mongo $regex (ReDoS + match injection)

- **File:** `backend/controllers/productController.js:14`
- **Severity:** MEDIUM
- **OWASP:** A03 Injection
- **Detail:** req.query.keyword is passed as-is into a $regex query with no escaping and no length cap. Attackers can send catastrophic-backtracking patterns to spin Mongo CPU, and use metacharacters (^, $, .*) to bypass intended filtering.
- **Fix:** Escape the keyword (escape-string-regexp), or switch to a Mongo text index with $text $search. Cap keyword length to 64 chars.

### SEC-006 — No password complexity or minimum-length policy

- **File:** `backend/controllers/userController.js:86`
- **Severity:** MEDIUM
- **OWASP:** A07 Identification and Authentication Failures
- **Detail:** registerUser (line 30) and updateUserProfile (line 86) accept any non-empty password. No min length, no complexity, no breached-password check. bcrypt cost is 10 (userModel.js:39).
- **Fix:** Enforce min-length 12, reject breached passwords (zxcvbn or HIBP k-anon), bump bcrypt cost to 12 in both registerUser and updateUserProfile.

### SEC-009 — JWT with 30-day TTL stored in localStorage; no CSP; no revocation

- **File:** `frontend/src/actions/userActions.js:53`
- **Severity:** MEDIUM
- **OWASP:** A02 Cryptographic Failures
- **Detail:** login/register dispatch localStorage.setItem(userInfo, JSON.stringify(data)) including the JWT. Any XSS on the SPA (no CSP, review comments unsanitised at storage) lets an attacker exfiltrate a token valid for 30 days. Logout is purely client-side (userActions.js:66); server is unaware. ADR-0001 acknowledges the trade-off; no mitigations exist.
- **Fix:** Move tokens to httpOnly+Secure+SameSite=Lax cookies; or install a strict CSP, shorten JWT TTL to 15-60 min with refresh tokens, add a jti revocation list.

### SEC-011 — No security headers (helmet/CSP/HSTS), no global rate-limit, no CORS config

- **File:** `backend/server.js:25`
- **Severity:** MEDIUM
- **OWASP:** A05 Security Misconfiguration
- **Detail:** server.js mounts express.json() but never installs helmet/CSP/HSTS/X-Frame-Options. CORS is not configured (relying on same-origin per ADR-0002) so a future split deploy silently inherits whatever Express default behaviour is. No global rate-limit on /api/*.
- **Fix:** helmet() with strict CSP (script-src self, frame-ancestors none); explicit cors() with allowlist; global express-rate-limit (300 req/min/IP).

### SEC-015 — MCP HTTP transport: no auth, no CORS allowlist, no rate-limit

- **File:** `mcp-feature-flags/server.ts:102`
- **Severity:** MEDIUM
- **OWASP:** A05 Security Misconfiguration
- **Detail:** With --http (server.ts:85), the MCP server exposes POST /mcp, GET /mcp, GET /feature/:feature_name (server.ts:171), DELETE /mcp on MCP_HTTP_PORT (default 5680) with no authentication and no origin check. Anyone reaching the port can read all feature flag state and (via the registered tools) flip features, including kill-switching live traffic. express.json limit (4mb) is overly generous.
- **Fix:** Require a shared-secret bearer token via env on every route; add CORS allowlist; bind to 127.0.0.1 by default and require MCP_BIND=0.0.0.0 to expose externally; reduce json limit to 64kb.

### SEC-016 — REST shortcut /feature/:feature_name uses URL param directly as object key

- **File:** `mcp-feature-flags/server.ts:171`
- **Severity:** MEDIUM
- **OWASP:** A03 Injection
- **Detail:** data[req.params.feature_name] uses the unsanitised URL param as an object key against a freshly-parsed JSON object. No allowlist regex (feature ids are expected snake_case) and no length cap. Truthy-check (if !f) instead of Object.prototype.hasOwnProperty.call means accessor names like constructor or toString return truthy junk objects instead of 404. While current JSON.parse strips __proto__, this is one refactor away from prototype pollution.
- **Fix:** Validate the param against ^[a-z][a-z0-9_]{1,64}$ before lookup; use Object.prototype.hasOwnProperty.call(data, name) for existence.

### SEC-019 — Backend depends on EoL/vulnerable major versions

- **File:** `package.json:29`
- **Severity:** MEDIUM
- **OWASP:** A06 Vulnerable and Outdated Components
- **Detail:** mongoose ^5.10.6 (Mongoose 5 is end-of-life, no security patches), jsonwebtoken ^8.5.1 (8.x had CVE-2022-23529 algorithm-confusion and CVE-2022-23540/41 around verify semantics; fixed in 9.x), multer ^1.4.2 (1.x relied on dicer which had CVE-2022-24434 ReDoS; fixed in 1.4.5-lts.1 / 2.x), express ^4.17.1 (qs prototype-pollution fixed in 4.19+). No npm audit step in CI.
- **Fix:** Upgrade jsonwebtoken to 9.x, multer to 1.4.5-lts.1+ or 2.x, express to 4.19+. Plan a Mongoose 6/7 migration (config/db.js needs rewriting). Add npm audit --audit-level=high to CI.


## LOW (7)

### SEC-010 — errorHandler leaks stack trace whenever NODE_ENV != production

- **File:** `backend/middleware/errorMiddleware.js:11`
- **Severity:** LOW
- **OWASP:** A05 Security Misconfiguration
- **Detail:** errorHandler returns err.stack when NODE_ENV !== production. Staging/preview/review-app deployments that forget to set NODE_ENV=production leak full stack traces (absolute file paths, internal module names) to any unauthenticated client.
- **Fix:** Default to suppressing stack; opt-in via an explicit DEBUG_ERRORS env var. Always log full stack server-side via structured logger.

### SEC-012 — console.error(error) on failed JWT verify enables log flooding

- **File:** `backend/middleware/authMiddleware.js:21`
- **Severity:** LOW
- **OWASP:** A09 Logging and Monitoring Failures
- **Detail:** On invalid/expired token the catch does console.error(error). The full error object hits stdout. No rate-limit on the log; an attacker can flood the log sink by spamming bad tokens.
- **Fix:** Log only error.name + a constant message. Throttle bad-token logs by IP, or route through a security-event logger.

### SEC-013 — User enumeration via distinct User already exists on register

- **File:** `backend/controllers/userController.js:35`
- **Severity:** LOW
- **OWASP:** A07 Identification and Authentication Failures
- **Detail:** registerUser returns 400 User already exists for taken emails. authUser correctly returns a generic Invalid email or password, but register undoes that — attackers can iterate an email list and reliably tell which addresses are registered.
- **Fix:** Return a generic 202 If your email is new, we sent a verification link; either silently no-op or send an already-registered notice out-of-band.

### SEC-014 — /api/config/paypal returns raw env var verbatim, no validation, no caching

- **File:** `backend/server.js:33`
- **Severity:** LOW
- **OWASP:** A05 Security Misconfiguration
- **Detail:** res.send(process.env.PAYPAL_CLIENT_ID) returns the env var as-is. If anything other than a PayPal client id ever ends up in PAYPAL_CLIENT_ID (typo, swap with a *_SECRET), it is served to every client. No Cache-Control header (ADR-0003 notes this) and no shape validation.
- **Fix:** Validate at startup that the value matches PayPal client-id shape (alphanumeric, length ~80); cache with Cache-Control public max-age=300; never read *_SECRET env vars in a public route.

### SEC-017 — sys.path.insert(0, REPO_ROOT) lets repo-local files shadow installed packages

- **File:** `mcp-project-docs/server.py:24`
- **Severity:** LOW
- **OWASP:** A08 Software and Data Integrity Failures
- **Detail:** sys.path.insert(0, str(REPO_ROOT)) prepends the repo root to the import path. A malicious mcp.py / scripts/*.py dropped in the repo would be imported in preference to installed packages. _retriever is instantiated at import time, so any import-time side-effect runs on server start.
- **Fix:** Do not mutate sys.path at runtime; use a proper package layout (pip install -e .) or absolute imports; lazy-instantiate _retriever inside the tool function.

### SEC-018 — No request/audit logging in production

- **File:** `backend/server.js:21`
- **Severity:** LOW
- **OWASP:** A09 Logging and Monitoring Failures
- **Detail:** morgan(dev) is gated to NODE_ENV === development (server.js:21). In production there is no audit trail for privileged actions — admin user-role changes (userController.js:153), feature-flag flips (featureController.js:15), payment-state changes (orderController.js:60). After an incident there is nothing to reconstruct from.
- **Fix:** Always enable structured logging in production (pino/winston): method/path/status/userId/duration. Tag admin actions and login failures; ship to a managed sink.

### SEC-020 — Review comment/rating accepted without bounds — DoS + future XSS surface

- **File:** `backend/controllers/productController.js:113`
- **Severity:** LOW
- **OWASP:** A03 Injection
- **Detail:** createProductReview pushes req.body.comment straight into the product document; rating is Number(rating) with no 1..5 bounds check. React escapes text on render today, but: (a) no length cap means one reviewer can DoS the product page with megabytes of text; (b) ratings outside [1,5] silently corrupt average rating; (c) future renderers (dangerouslySetInnerHTML / email / PDF) re-open the XSS vector.
- **Fix:** Cap comment to 2000 chars server-side, strip control chars, reject rating not in [1,5] integer.


## Cross-cutting observations

- The auth pipeline has multiple compounding weaknesses (HIGH-007 no rate-limit, HIGH-003 weak secret, MEDIUM-006 no password policy, MEDIUM-009 token in localStorage with no CSP). Treat as a single hardening initiative — fixing them in isolation gives marginal gains.

- Two HIGH access-control bugs in the order flow (SEC-001 IDOR, SEC-002 self-mark-paid) plus the unauthenticated upload (SEC-008) are the most directly exploitable issues for a remote attacker with a free user account. Prioritise these.

- The MCP HTTP transport (SEC-015/016) bypasses the entire web app auth model. If MCP_HTTP_PORT is ever opened beyond loopback (n8n docker network, ngrok, etc.) the attacker controls feature flags directly, dwarfing the web app risk.

- The dependency situation (SEC-019) compounds everything — Mongoose 5 EoL means even the application-layer fixes above will not get backported security patches once Atlas drops protocol support.

- Logging/observability (SEC-012/018) means **none of these issues are detectable in production today**. Pair every fix with an audit-log entry.


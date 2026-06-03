# Performance Review --- ProShop MERN fork (stage 1, M6)

**Scope:** entire repository --- backend (Express 4 / Mongoose 5), frontend (React 16.13 / classic Redux 4), MCP feature-flags (Node/TS), MCP project-docs (Python), RAG scripts/. Excluded per task: tests, node_modules, build artefacts, frontend/public, homework/, docs/project-data/.

**Methodology:** read CLAUDE.md + DESIGN.md first, then walked every backend controller / route / model / middleware, both MCP servers, every RAG script, and the React screens that pull from the hot-path endpoints. Cross-referenced security-findings.jsonl for overlap (SEC-004 ReDoS, SEC-008 unauth upload).

**No code was modified.** Findings only.

## Summary

- **Total findings:** 20
- **HIGH:** 5
- **MEDIUM:** 10
- **LOW:** 5

### Top 3 critical concerns (file:line, impact)

1. **backend/controllers/orderController.js:113** --- GET /api/orders returns ALL orders with no pagination. At 10k orders ~5-10MB JSON / 200-600ms event-loop block; at 100k orders the dyno OOMs.
2. **backend/controllers/productController.js:14** --- User-controlled regex with no anchoring on the product-list hot path. ~500ms-2s per request at 100k products + ReDoS surface (cross-ref SEC-004).
3. **frontend/src/screens/OrderScreen.js:42** --- Render-time MUTATION of Redux state. Breaks useSelector shallow equality, doubles render counts across the order page, and runs the reduce every render.

### Hot-path totals (worst case under current code)

| Path | p95 today (estimate) | Root cause |
|---|---|---|
| GET /api/orders (admin) | 200-600ms @ 10k orders | PERF-002 (no pagination) + PERF-016 (no gzip) |
| GET /api/products (search) | 50-500ms @ 100k products | PERF-001 (regex COLLSCAN) + PERF-017 (no index) |
| GET /api/feature-flags | 5-20ms incl. disk | PERF-005 (sync disk on every read) |
| Any protected API call | +30-80ms per page | PERF-014 (User.findById per request) |

## HIGH (5)

### PERF-001 --- User-controlled regex with no anchoring or escaping
- **File:** backend/controllers/productController.js:14
- **Severity:** HIGH
- **Cross-ref:** SEC-004 (same line; security side is ReDoS / match injection)
- **Detail:** req.query.keyword is interpolated raw into Mongo $regex with $options i. No Mongo text index, so each query runs a case-insensitive unanchored regex over every product document. Two queries per request (countDocuments + find) both scan. No length cap on the keyword.
- **Impact:** Linear COLLSCAN per request. At 1k products: ~5-15ms p50 per query x 2 + regex backtracking risk. At 100k products: ~500ms-2s per request + CPU spike for ReDoS-style inputs.
- **Fix:** Mongo text index on name + $text $search; or escape-string-regexp + anchor the pattern. Cap keyword to 64 chars.

### PERF-002 --- GET /api/orders returns ALL orders with no pagination
- **File:** backend/controllers/orderController.js:113
- **Severity:** HIGH
- **Detail:** Order.find({}).populate(user, id name) --- no .limit(), .skip(), .lean(), no projection. Every admin dashboard load returns the entire orders collection including the embedded orderItems array per doc.
- **Impact:** Linear in number of orders. 10k orders x ~3 items: ~5-10MB JSON, 200-600ms server-side serialize, event-loop blocked. 100k orders: hundreds of MB --> OOM-kill on a Heroku dyno.
- **Fix:** Paginate (?page=, ?pageSize=) mirroring getProducts, add .lean(), project only fields the admin table renders, add an index on { createdAt: -1 }.

### PERF-005 --- features.json read from disk on every admin GET, then again per write
- **File:** backend/utils/featureFile.js:14
- **Severity:** HIGH
- **Detail:** readFeaturesObject does fs.readFile + JSON.parse on every call. getFeatures calls it for every GET; writeFeature calls it AGAIN inside the writeQueue for every PUT. 293 lines / ~8KB today, but the read is unconditional --- no cache, no fs.stat().mtime check.
- **Impact:** ~0.5-2ms per call on SSD, 5-20ms on Windows/NFS. JSON.parse phase blocks the event loop. Polling admin UI keeps the syscall stream constant. Cost grows ~10x as the flag count grows.
- **Fix:** Module-level cache keyed by fs.stat().mtime. Read once at startup; swap in atomically after writes.

### PERF-006 --- MCP load/save rereads features.json on every tool invocation
- **File:** mcp-feature-flags/server.ts:15
- **Severity:** HIGH
- **Detail:** load() runs at the top of every tool (get_feature_info, set_feature_state, adjust_traffic_rollout) and the REST shortcut GET /feature/:feature_name (line 171). Duplicate raw readFile + JSON.parse inside list_features (lines 67-68) bypasses even the helper. Two writers (Express API and MCP) compete for the same file with no shared lock.
- **Impact:** An n8n WF1 run that calls list_features once and get_feature_info N times = N+1 disk reads. ~1ms/call. Concurrency bug: simultaneous writes from Express + MCP can corrupt the file.
- **Fix:** mtime-keyed cache shared between MCP and Express. Single writer (file lock or move ownership to one process).

### PERF-011 --- Reducer over order.orderItems runs during render and MUTATES Redux state
- **File:** frontend/src/screens/OrderScreen.js:42
- **Severity:** HIGH
- **Detail:** Lines 41-46 execute on every render: order.itemsPrice = addDecimals(order.orderItems.reduce(...)). Direct mutation of the Redux store object (orderDetails.order) violates immutability. Same anti-pattern in PlaceOrderScreen.js:26-35 mutating cart.
- **Impact:** (1) useSelector shallow equality breaks --> extra re-renders across the app; (2) the reduce + 4 number conversions run on every parent re-render. Net effect: 2x render counts on the order page.
- **Fix:** useMemo, or compute itemsPrice server-side and read it from order.itemsPrice. Never assign to a redux-owned object during render.

## MEDIUM (10)

### PERF-003 --- getMyOrders has no pagination, no sort, no index hint
- **File:** backend/controllers/orderController.js:105
- **Detail:** Returns every order for the user. No .limit, .sort, .lean, no schema index on { user: 1 }.
- **Impact:** At 50 orders x ~3 items: ~50-150KB JSON, ~10-30ms p50. Long-time users hit ~100-500ms.
- **Fix:** orderSchema.index({ user: 1, createdAt: -1 }), paginate (limit 20), .lean, project columns.

### PERF-004 --- GET /api/users returns every user including bcrypt hash
- **File:** backend/controllers/userController.js:111
- **Detail:** User.find({}) --- no pagination, no .select(-password), no .lean(). The bcrypt hash crosses the wire.
- **Impact:** At 5k users: ~1-2MB response, ~80-150ms p50. ~300KB wasted on hash bytes.
- **Fix:** Paginate, .select(-password), .lean(), 30s TTL cache.

### PERF-007 --- BM25 index rebuilt at import time on every server start
- **File:** mcp-project-docs/server.py:96
- **Detail:** _retriever = HybridRetriever(...) constructed at module import --> reads all of docs/chunks.jsonl, tokenizes every chunk, builds an in-memory BM25Okapi.
- **Impact:** 50-300ms cold start for 600 chunks. At 10k chunks: 1-3s + 50-100MB RSS. MCP stdio server is short-lived, so the cost repeats per spawn.
- **Fix:** Pickle the BM25 index, rebuild only when chunks.jsonl mtime changes. Long-term: move BM25 sparse vectors into Qdrant.

### PERF-008 --- BM25 scoring scans entire corpus on every query, then sorts in Python
- **File:** scripts/rag_query.py:91
- **Detail:** self._bm25.get_scores(q_tokens) is O(N) over all chunks. Filter (group / source_file) applied AFTER scoring; full Python sort is O(N log N).
- **Impact:** 600 chunks: ~5-15ms. 50k chunks: ~500ms-1s --- would dominate p95 of search_project_docs.
- **Fix:** Pre-filter by group/source_file. heapq.nlargest(PREFETCH_LIMIT, ...) instead of full sort.

### PERF-009 --- Embedding loop runs sequentially with no parallelism
- **File:** scripts/embed_chunks.py:124
- **Detail:** for rec in tqdm(chunks): vec = _embed_with_retry(oc, rec) --- one Ollama HTTP round-trip at a time. _embed_with_retry catches bare Exception and tries 3 fallback prompts.
- **Impact:** 604 chunks x ~80-200ms = 50-120s per full re-embed. 10k chunks = 13-30 minutes. Bare-exception retry triples latency silently on transient Ollama hiccups.
- **Fix:** asyncio.gather with bounded semaphore (e.g. 8 in flight); narrow exception catch to network/timeout types.

### PERF-010 --- keyword.toLowerCase() per feature per keystroke; search not debounced
- **File:** frontend/src/screens/FeatureListScreen.js:177
- **Detail:** Inside the filter closure, keyword.toLowerCase() is called N times per render. The setKeyword handler fires on every keystroke with no debounce; useMemo runs the full filter each time.
- **Impact:** 30 features: negligible. 300+ features: 1-3ms per keystroke + full table re-render.
- **Fix:** Hoist const kw = keyword.toLowerCase() outside the filter callback. Debounce to 100-150ms.

### PERF-012 --- useEffect re-dispatches listProducts on every successDelete/successCreate flip
- **File:** frontend/src/screens/ProductListScreen.js:54
- **Detail:** Dependency array includes successDelete and successCreate. After an action, the flag flips true but is not reset on remount. Combined with the in-effect PRODUCT_CREATE_RESET dispatch, this triggers re-render storms.
- **Impact:** Per admin action: +2-3 extra renders + 1 extra GET /api/products (= +50-200ms) and that GET is the unbounded $regex query (PERF-001).
- **Fix:** Split into two effects (redirect vs fetch); reset success flags in the cleanup.

### PERF-014 --- protect issues a fresh User.findById on every authenticated request
- **File:** backend/middleware/authMiddleware.js:17
- **Detail:** jwt.verify + User.findById(decoded.id).select(-password) on every protected route. No caching, no .lean().
- **Impact:** ~3-8ms per Mongo round-trip x ~10 protected calls per page = +30-80ms per page; on remote Atlas (~30ms RTT) ~+300ms/page. Worst on admin dashboards.
- **Fix:** .lean() the lookup; LRU cache keyed by jti with 1-2 min TTL; or fold isAdmin into the JWT claim.

### PERF-015 --- multer disk storage with no limits.fileSize
- **File:** backend/routes/uploadRoutes.js:30
- **Cross-ref:** SEC-008 (unauthenticated upload)
- **Detail:** multer({ storage, fileFilter }) --- no limits. Multipart parsing blocks the event loop while streaming. The fileFilter regex /jpg|jpeg|png/ is unanchored (correctness bug --- matches jpgsomething).
- **Impact:** Combined with SEC-008, an attacker can saturate event loop and ephemeral FS with concurrent 100MB POSTs. 10 concurrent uploads = ~1GB of ephemeral disk + tens of seconds of blocked event loop.
- **Fix:** limits: { fileSize: 2 * 1024 * 1024, files: 1 }. Anchor the regex. Authenticate the route.

### PERF-017 --- Missing Mongo indexes on hot-path query fields
- **File:** backend/models/productModel.js:19 (also orderModel.js)
- **Detail:** productSchema has no explicit indexes despite getProducts (name regex) and getTopProducts (sort by rating) running COLLSCAN. orderSchema has no index on { user: 1 } despite getMyOrders filtering by it.
- **Impact:** 10k products --> getTopProducts ~30-100ms vs <5ms with { rating: -1 }. 10k orders x 5k users --> getMyOrders ~50-200ms vs <10ms with { user: 1, createdAt: -1 }.
- **Fix:** productSchema.index({ rating: -1 }), productSchema.index({ name: text }), orderSchema.index({ user: 1, createdAt: -1 }). Mongoose 5 + useCreateIndex:true (db.js) auto-creates on connect.

## LOW (5)

### PERF-013 --- Static skeleton array allocated on every render
- **File:** frontend/src/screens/HomeScreen.js:42 (also FeatureListScreen, ProductScreen)
- **Impact:** Negligible (~0.01ms / 0.5ms reconcile). Hygiene only.
- **Fix:** Hoist const SKELETON_KEYS = [0,1,2,3,4,5,6,7] outside the component.

### PERF-016 --- No compression middleware; no Cache-Control on static assets
- **File:** backend/server.js:25
- **Impact:** A 5MB getOrders response (PERF-002) gzips to ~500-800KB --- 5-10x bandwidth win, ~1.3s saved on 4G. Static /uploads re-fetched on every nav.
- **Fix:** app.use(compression()). Long max-age + immutable on /uploads. Cache-Control: public, max-age=3600 on /api/config/paypal.

### PERF-018 --- No AbortController on AutoPilot fetch; webhook URL baked at build time
- **File:** frontend/src/components/AutoPilotControls.js:36
- **Impact:** Orphaned promise + React 16 warning on rapid unmount. Build-time env coupling forces full rebuild per env switch.
- **Fix:** AbortController + cleanup in useEffect; runtime /api/config/n8n endpoint mirroring the PayPal client-id pattern.

### PERF-019 --- Two independent reduces over cartItems on every render
- **File:** frontend/src/screens/CartScreen.js:33
- **Impact:** Negligible (<0.05ms for 10 items). Hygiene; co-symptom of PERF-011.
- **Fix:** Single reduce in useMemo([cartItems]).

### PERF-020 --- atomicWrite rewrites entire features.json for any single-field patch
- **File:** backend/utils/featureFile.js:34
- **Impact:** 1-3ms per write today (8KB). At 3000 flags (~800KB): 50-100ms per write --- close to the 150ms slider debounce --> queue depth can build under load.
- **Fix:** Long-term, structured store (SQLite via better-sqlite3, or Mongo). Short-term: queue-depth metric.

## Cross-specialist collaboration

- **PERF-001 <-> SEC-004:** Same line. The fix (Mongo text index + escape + length cap) addresses both performance (no full COLLSCAN) and security (no ReDoS, no match injection).
- **PERF-015 <-> SEC-008:** limits.fileSize is mandatory because the upload route is unauthenticated. Fixing one without the other still leaves a DOS surface (auth alone) or perf cliff (limits alone).
- **PERF-005/006 <-> ADR-0001:** The files-as-storage decision is sound for the current scale, but the absence of an in-memory cache means we are paying the full disk-read tax even when nothing changed. The cache is a 20-line change that does not invalidate the ADR.
- **PERF-014:** Fixing the per-request User.findById helps every protected route --- pair this with SEC-009 (JWT in localStorage / no revocation) so a server-side jti cache doubles as a revocation primitive.

## Cross-cutting observations

- The two top latency drivers (PERF-002 unbounded order list, PERF-001 regex search) compound: an admin who searches in one tab and views the order list in another runs both bad paths in the same Node process. Fixing pagination first gives the biggest visible improvement.
- The render-time mutation of Redux state (PERF-011) is a correctness bug masquerading as a perf issue --- it likely also causes stale itemsPrice bugs that PlaceOrderScreen sometimes shows on fast nav. Fixing it removes both classes of issue.
- The MCP + Express dual-writer to features.json (PERF-006 race) is a correctness time-bomb, not just a perf nit. Either centralise writes in one process or introduce a real file lock.
- RAG hot-path findings (PERF-007/008/009) are all latent at today's 600-chunk corpus --- none degrades p95 by more than ~20ms today. They become real at ~10k chunks; treat them as growth-track, not stop-the-line.

## Status

- N+1 / unbounded queries scan: complete (PERF-002, PERF-003, PERF-004, PERF-014)
- Blocking I/O scan: complete (PERF-005, PERF-006, PERF-015)
- Missing index scan: complete (PERF-001, PERF-017)
- React render hot-path scan: complete (PERF-010, PERF-011, PERF-012, PERF-013, PERF-019)
- Caching / compression scan: complete (PERF-014, PERF-016, PERF-020)
- RAG pipeline scan: complete (PERF-007, PERF-008, PERF-009)
- Bundle / asset diff: not flagged --- no large dep additions detected; React 16 bundle is already CRA's baseline

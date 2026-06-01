# M6 Stage 4 — Tests Agent

Used the **`test-writer-mate`** sub-agent (write-only: `Read/Grep/Glob/Write`, no Bash — it writes tests, the orchestrator runs them) to generate strong tests for **2 services**, both of which have Stage 3 reverse-engineering specs.

| # | Service | Why this one | Framework | Tests | Result |
|---|---|---|---|---|---|
| 1 | RAG engine — `scripts/rag_query.py` | The actual hybrid-retrieval logic (dense+BM25+RRF). `mcp-project-docs/server.py` is a thin wrapper over it and **can't be imported in the test env** (the `mcp` package isn't installed in `.venv-rag`), so the engine is the testable surface. Spec: `docs/specs/project-docs-rag-spec.md`. | pytest (`.venv-rag`, offline — Ollama/Qdrant mocked) | 27 | ✅ 27/27 |
| 2 | `backend/controllers/orderController.js` | Core domain, endorsed by the M6 FAQ as a valid target; Stage 3 spec `docs/specs/order-controller-spec.md`. `getOrderById` already covered in Stage 2, so these cover the other 5 handlers. | node:test + `mock.module` (`--experimental-test-module-mocks`) | 14 | ✅ 14/14 |

Run:
```bash
# Service 1 (RAG)
.venv-rag/Scripts/python.exe -m pytest tests/test_rag_query.py -q
# Service 2 (orderController) — and all node:test files (stage2 + stage4)
npm run test:backend
```
See `coverage-report.txt` for captured output (text evidence — no GUI available to produce `coverage-report.png`).

## Why feature-flags MCP (TS) was NOT a target

Its business logic (dependency-gate, traffic derivation, disabled-lock) lives **inline inside `registerTool` callbacks** and isn't exported, and importing `server.ts` immediately starts a transport (`await server.connect(...)`). Unit-testing it would require **refactoring production code** (extracting the logic into an exported module) — outside `test-writer-mate`'s ROLE-LOCK. Chose two services testable without touching production.

## Failing tests during the run? (Stage 4 checklist)

All tests pass now. Two failures surfaced on first run — **both were test-side bugs, not production bugs** (fixed in the test code only):

1. **RAG `test_search_hybrid_rrf_promotes_chunk_present_in_both_retrievers`** — the test assumed a both-retrievers chunk strictly outranks a dense-only chunk, but the real `_bm25_ranks` ranks the *entire* corpus (a dense-only chunk also picks up a BM25 rank and ties via RRF). Fixed by stubbing **both** retriever inputs so the RRF property is isolated. Production RRF is correct.
2. **orderController `updateOrderToDelivered` happy path** — the mock's `save()` echoed a **hand-picked field list** that omitted `isDelivered`/`deliveredAt`, so the response looked empty. Fixed the mock to spread all fields (like Mongoose returns the saved doc). Production handler is correct.

## Characterization tests that pin *current* (still-buggy) behavior

Several tests intentionally pin known-bad behavior so a future fix consciously updates them (each marked in-code):
- `updateOrderToPaid: stranger marks another user order paid -> 200` — pins **SEC-002** (no ownership check).
- `addOrderItems: client-supplied totalPrice 0.01 persisted verbatim` — pins **FINDINGS#2** (price tampering).
- `addOrderItems: orderItems:undefined slips past guard` — pins **FINDINGS#4**.
- `updateOrderToPaid: body without payer -> throws` — pins the unguarded `req.body.payer` 500.
- `getOrders: ignores pagination params` — pins **PERF-002** (unbounded scan).

These document the contract as-is; they are **not** endorsements. The matching fixes are tracked in the Stage 1 synthesis / proposed ADR-0005.

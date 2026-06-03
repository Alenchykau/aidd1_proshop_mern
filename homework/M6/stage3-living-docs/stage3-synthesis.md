# Stage 3 Synthesis — proshop_mern fork (M6 Living Documentation)

**Date:** 2026-06-02
**Role:** main CC session as `legacy-auditor-mate` (orchestrator).
**Inputs:** Stage 1 `homework/M6/stage1-code-review/synthesis.md` (read-only — graded artifact) + Phase-3 reverse-engineering specs (`docs/specs/*-spec.md`).

> This is the Stage-3 value-add: it maps each reverse-engineered module to the Stage-1 findings that live in it, so the living docs and the audit point at the same coordinates. **Findings were NOT recomputed** — they are reused from Stage 1 per the plan (Phase 3.0).

## Module → findings map

| Module (spec) | Stage 1 findings present | Status |
|---|---|---|
| `mcp-feature-flags/server.ts` (`feature-flags-mcp-spec.md`) | SEC-015 (HTTP no auth), SEC-016 (param-as-key), PERF-006 (reread/dual-writer), ARCH-001/013 (MCP-gateway bypass + file coupling) | open; ADR-0004 proposed |
| `mcp-project-docs/server.py` + `scripts/rag_query.py` (`project-docs-rag-spec.md`) | PERF-007 (import-time BM25 rebuild), PERF-008 (O(N) BM25 scan), PERF-009 (sequential embed), SEC-017 (`sys.path` shadow), ARCH-014 (sys.path coupling) | open; growth-track |
| `backend/controllers/orderController.js` (`order-controller-spec.md`) | SEC-001 (IDOR) **fixed Stage 2**, SEC-002 (mark-paid) open, PERF-002/003 (no pagination), ARCH-002/003 (no authz / no PaymentProvider), FINDINGS#2/#4 (price tamper / empty-items) | partly fixed |

## What changed vs Stage 1

- **SEC-001 closed** in Stage 2 (ownership check on `getOrderById`); the order-controller spec documents the new 403 path and warns the IDOR class recurs without a shared authz layer (ADR-0005).
- **SEC-004/PERF-001 closed** in Stage 2 (escape + length-cap on product `$regex`) — that module wasn't re-spec'd here (not in the 3-core set) but is captured in Stage 1 + Stage 2 docs.
- **SEC-008/PERF-015 closed** in Stage 2 (upload auth + size cap + anchored regex).

## Cross-cutting themes (carried from Stage 1, confirmed during reverse-eng)

1. **No authorization layer (ARCH-002).** `protect` = authn only; ownership is per-handler and easy to forget. SEC-001 (fixed) and SEC-002 (open) are the same root. → **ADR-0005**.
2. **`features.json` dual-writer (ARCH-001 / PERF-006).** The MCP encodes the dependency-gate + disabled-traffic-lock; `backend/utils/featureFile.js` re-implements a subset and writes directly. → **ADR-0004**.
3. **RAG is a data subtree, not docs.** `docs/chunks.jsonl` + `docs/project-data/` are read at import by the RAG MCP — documented as data in `project-index.json`, excluded from the docs restructure/archive.
4. **Polyglot boundaries are file-path-coupled (ARCH-013/014).** Backend↔MCP via relative `../../backend/features.json`; MCP↔scripts via `sys.path.insert`. No schema/package contract.

## New ADRs proposed (from Stage 1, to be added under `docs/adr/`)

- **ADR-0004** — Feature-flags MCP is the only writer for `backend/features.json`.
- **ADR-0005** — Introduce an authorization layer separate from authentication.

(Numbering continues from the 3 existing fork ADRs; do not restart — see `docs-audit.md` cross-references.)

## Deliverables produced this stage

- `docs/specs/{feature-flags-mcp,project-docs-rag,order-controller}-spec.md` (4-step).
- `project-index.json` (repo root) + `.claude/scripts/update_project_index.py` + PostToolUse hook.
- `docs/README.md` + `docs/architecture/` (overview) ; archived 📦 → `docs-archived-2026-06-02/`.
- Two new sections in `CLAUDE.md`.

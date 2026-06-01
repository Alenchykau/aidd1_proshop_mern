# Audit Plan — proshop_mern fork (M6 Stage 3)

**Role:** main CC session acting as `legacy-auditor-mate` (orchestrator, NOT spawned via Task).
**Output dir:** `homework/M6/stage3-living-docs/`
**Deliverables to repo root/tree:** `project-index.json`, `.claude/scripts/update_project_index.py`, restructured `docs/`, `docs-archived-2026-06-02/`, two new sections in `CLAUDE.md`.

## Project shape (from Phase 1)

- **Type:** fullstack polyglot monorepo (no workspace tool; root + frontend install independently).
- **Tech stack:** Node + Express 4 + Mongoose 5 + MongoDB · React 16.13 + classic Redux 4 + RRv5 (CRA 3.4) · TypeScript (feature-flags MCP) · Python 3 (project-docs RAG MCP + RAG pipeline; ollama + qdrant + rank-bm25).
- **Subprojects discovered:**
  - `backend/` — Express REST API (route→controller→Mongoose model; no service layer), JWT auth, multer upload.
  - `frontend/` — CRA SPA + M4 Feature Dashboard.
  - `mcp-feature-flags/` — TS MCP server; sole legal writer of `backend/features.json`.
  - `mcp-project-docs/` — Python RAG MCP (vector search over `docs/`).
  - `scripts/` — Python RAG pipeline (build_chunks / embed_chunks / rag_query).
  - data: `backend/features.json` (flags), `docs/chunks.jsonl` + `docs/project-data/` (RAG corpus).
- **Tests surface:** `tests/build_chunks/` (pytest, Python) · frontend CRA jest · `homework/M6/stage2-fix-top3/tests/` (node:test, added this module). No backend Express runner historically.
- **Legacy markers:** only 2 TODO/FIXME in source — codebase is young; MCP/RAG untouched ~4 weeks (stable).

## Existing docs audit (from Phase 1.5 → `docs-audit.md`)

- ✅ **Keep:** 3 fork ADRs (`docs/adr/0001-0003`), `CLAUDE.md`, `DESIGN.md`.
- ✅ **Keep as DATA (out of scope):** `docs/project-data/**`, `docs/chunks.jsonl` — **live RAG runtime data; archiving them breaks `mcp-project-docs/server.py`.**
- 🔄 **Update + keep:** `docs/architecture.md` (missing M3-M5), `README.md` (path drift + missing M4/M5).
- 📦 **Archive (historical):** `docs/superpowers/plans/**` (9), `docs/superpowers/specs/**` (9), `FINDINGS.md`, `report.md`, `m5-spec.md`.
- ❌ untracked scratch (`anti-slop-supplement.md`, `prompt.md`, `error-message.txt`) — left untouched.

## Audit scope (confirmed)

- **In scope (document + index):** backend/, frontend/, mcp-feature-flags/, mcp-project-docs/, scripts/, feature-flags data.
- **Out of scope:** `docs/project-data/` + `docs/chunks.jsonl` (RAG data), `node_modules/`, `*/dist/`, `homework/` (course artifacts), untracked scratch.
- **Findings input:** reuse Stage 1 `homework/M6/stage1-code-review/synthesis.md` (specialists already ran) — Phase 3.0.

## Phase 3 — REVERSE-ENGINEERING (Execute mode, after approval)

- [x] 3.0 **Reuse Stage 1 synthesis.md as findings input** — do NOT re-run security/performance/architecture mate'ы (3.1-3.3 skipped; specialists already ran in Stage 1).
- [x] 3.4 4-step reverse engineering (UNDERSTAND → DECISION TABLE → SEQUENCE DIAGRAM → EDGE CASES) per module → `docs/specs/<module>-spec.md`. **Proposed module set** (serial, small repo):
  - [x] `mcp-feature-flags/server.ts` → `feature-flags-mcp-spec.md`  *(also Stage 4 test target #1)*
  - [x] `mcp-project-docs/server.py` (+ `scripts/rag_query.py` retriever) → `project-docs-rag-spec.md`  *(also Stage 4 test target #2)*
  - [x] `backend/controllers/orderController.js` → `order-controller-spec.md`  *(core domain; hardened in Stage 2)*
  - [~] (optional) `backend/middleware/authMiddleware.js` + `utils/generateToken.js` → `auth-spec.md` — **skipped** (user chose 3-core set)

## Phase 4 — AGGREGATE (Execute mode)

- [x] 4.1 `stage3-synthesis.md` — specs + Stage 1 findings woven together (Stage 1 `synthesis.md` read-only; it is a graded artifact).
- [x] 4.2 `project-index.json` at repo root — subprojects, system_folders, root_files, hard_rules (≥5, incl. "read project-index.json FIRST"), ai_routing (feature-flag Q → feature-flags MCP; docs Q → project-docs MCP; ADR vs RAG-corpus distinction), filesystem_tree (depth 4), last_updated.
- [x] 4.3 New `docs/` structure (NO full swap — RAG data stays in place):
  - `docs/README.md` (index) · `docs/architecture/` (architecture.md + overview, TODO markers) · `docs/specs/` (Phase-3 specs) · `docs/adr/` (unchanged ✅) · keep `docs/project-data/` + `docs/chunks.jsonl` as data.
- [x] 4.4 Archive 📦 only → `docs-archived-2026-06-02/`: `docs/superpowers/`, `FINDINGS.md`, `report.md`, `m5-spec.md` (via `git mv`, never `rm`).

## Phase 5 — AUTOMATE (Execute mode)

- [x] 5.1 Author `.claude/scripts/update_project_index.py` (generated — no course reference present; rewrites `filesystem_tree` + `last_updated`, preserves annotations).
- [x] 5.2 `WATCH_PATHS = backend/, frontend/src/, mcp-feature-flags/, mcp-project-docs/, scripts/, backend/features.json`.
- [x] 5.3 (optional) PostToolUse hook in `.claude/settings.local.json` + smoke test + screenshot.
- [x] 5.4 Two sections into `CLAUDE.md`: "⭐ START HERE — read project-index.json first" + "⭐ Keeping project-index.json current — MANDATORY".
- [x] 5.5 Validate `python -m json.tool < project-index.json`; standalone-run the update script.
- [x] 3.7 Package submission: copy curated `docs/` → `stage3-living-docs/docs-new/`, `docs-archived-2026-06-02/` → `stage3-living-docs/docs-archived/`, `project-index.json` + script + `CLAUDE.md` copy.

## Time estimate

- Phase 3 (4-step specs ×3-4, serial): ~50-80 min.
- Phase 4 (synthesis + project-index + docs restructure + archive): ~40-60 min.
- Phase 5 (script + hook + CLAUDE.md + packaging): ~20-30 min.

## Execution status (2026-06-02 — plan approved, Phase 3-5 executed)

- ✅ Phase 3: reused Stage 1 synthesis.md (3.0); 3 core specs written (`feature-flags-mcp`, `project-docs-rag`, `order-controller`). Auth spec skipped per decision.
- ✅ Phase 4: `stage3-synthesis.md`, `project-index.json` (root, valid), docs restructured (no full swap — RAG data left in place), 📦 archived to `docs-archived-2026-06-02/`.
- ✅ Phase 5: `update_project_index.py` (UTF-8-safe, idempotent), `WATCH_PATHS` adapted, PostToolUse + SessionStart hooks in `settings.local.json` (smoke-tested → `hook-smoketest.txt`), two `⭐` sections added to `CLAUDE.md`. Proposed ADR-0004/0005 written.
- ✅ Phase 3.7: submission packaged (`docs-new/`, `docs-archived/`, `project-index.json`, `update_project_index.py`, `CLAUDE.md`).

## Resolved decisions (from approval)

1. Module specs → **3 core** (feature-flags MCP, project-docs RAG, orderController).
2. Hook → **yes**, configured + smoke-tested.
3. Loose root docs → `FINDINGS.md`+`report.md` archived; `m5-spec.md` → `homework/M5/`.
4. `docs/superpowers/` → archived (linked from `docs/architecture/overview.md`).

## Original open questions (now answered above)

1. **Module set for specs** — OK with the 3 core (`feature-flags MCP`, `project-docs RAG`, `orderController`)? Add the optional `auth` spec (→ 4 total), or trim to 2 (the two MCP services, минимум по чеклисту)?
2. **Hook (Stage 3.5, optional)** — set up the PostToolUse hook in `.claude/settings.local.json` + take the screenshot, or skip the hook and just wire the manual `update_project_index.py` (checklist marks the hook optional)?
3. **Archiving loose root docs** — OK to `git mv FINDINGS.md report.md m5-spec.md → docs-archived-2026-06-02/`? (`m5-spec.md` alternatively could move to `homework/M5/` instead of archive — preference?)
4. **`docs/superpowers/`** — confirm archive (📦). It holds M3-M5 plans/specs; I'll link them from the new architecture README so dev-history isn't orphaned.

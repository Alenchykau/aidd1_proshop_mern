# Existing Docs Audit — proshop_mern fork (M6 Stage 3, Phase 1.5)

**Date:** 2026-06-02
**Auditor:** main CC session in `legacy-auditor-mate` role (Plan mode, read-only)
**Method:** read each doc / sample large folders, compare to current code, classify into ✅ ACCURATE / 🔄 PARTIALLY / 📦 HISTORICAL / ❌ STALE.

## ⚠️ Critical constraint discovered in Phase 1

`docs/chunks.jsonl` and `docs/project-data/` are **live runtime data for the project-docs RAG MCP**, not documentation to be reorganized:
- `mcp-project-docs/server.py:16-17` reads `CHUNKS_PATH = docs/chunks.jsonl` at import (fail-fast singleton).
- `scripts/rag_query.py:29` defaults to `docs/chunks.jsonl`; `docs/project-data/` is the corpus those chunks are built from (README §"Domain documentation and RAG chunks").

**→ These MUST stay in place. Archiving them breaks the RAG server.** They are explicitly OUT of the docs-restructure scope (treated as a data subtree, not living docs).

## Inventory & verdicts

| Path | Type | Verdict | Reasoning | Action (Phase 4) |
|---|---|---|---|---|
| `docs/adr/0001-jwt-bearer-token-in-localstorage.md` | ADR (fork) | ✅ ACCURATE | Confidence HIGH, cites real files; matches authMiddleware/generateToken/store.js | Keep as-is; **preserve numbering** |
| `docs/adr/0002-single-process-prod-deployment.md` | ADR (fork) | ✅ ACCURATE | Matches server.js + Procfile + heroku-postbuild + proxy | Keep as-is |
| `docs/adr/0003-runtime-paypal-client-id-endpoint.md` | ADR (fork) | ✅ ACCURATE | Matches `/api/config/paypal` + OrderScreen | Keep as-is |
| `docs/architecture.md` | Architecture overview | 🔄 PARTIALLY | C4 + sequence diagrams correct for MERN core, but predates M3-M5: no MCP feature-flags, no project-docs RAG, no M4 feature dashboard, no feature flags | Carry into `docs/architecture/`, add `TODO(audit-2026-06-02)` for MCP/RAG/dashboard; new module specs (Phase 3) fill the gap |
| `README.md` (root) | Project README | 🔄 PARTIALLY | Covers MCP feature-flags + RAG corpus, but: path drift (`project-data/features.json` → actually `backend/features.json`; `project-data/` → actually `docs/project-data/`), no M4 dashboard, no M5 n8n, no project-docs MCP server section | Keep at root (canonical entry); add `TODO` markers for the path drift + missing M4/M5; link to project-index.json |
| `docs/project-data/**` (47 files) | RAG corpus (synthetic) | ✅ in-use as DATA | Synthetic Brad-Traversy proshop docs; the project-docs MCP corpus. NOT living docs of this fork (incl. `project-data/adrs/adr-001..005` = synthetic, distinct from the 3 fork ADRs) | **Leave in place** — RAG data, out of restructure scope |
| `docs/chunks.jsonl` (604) | RAG build artifact | ✅ in-use as DATA | Generated chunk store read by server.py / rag_query.py | **Leave in place** — runtime data |
| `docs/superpowers/plans/**` (9) | Impl. plans M3-M5 | 📦 HISTORICAL | Dated 2026-05-03…05-13 implementation plans (vector-db chunking, mcp-project-docs, dashboard, m4 phases, ff-correction). Valuable dev-history, superseded by shipped code | Archive → `docs-archived-2026-06-02/`; link from new architecture README |
| `docs/superpowers/specs/**` (9) | Design specs M3-M5 | 📦 HISTORICAL | Companion design docs to the plans above | Archive → `docs-archived-2026-06-02/` |
| `FINDINGS.md` (root) | Prior risk table | 📦 HISTORICAL | Small pre-M6 findings table; #1 fixed, #2/#3/#4 open. Superseded by Stage 1 `synthesis.md` (broader, 57 findings). #2 (price tampering) overlaps SEC-002 area | Archive; cross-ref into Stage-1 synthesis as "prior known issues" |
| `report.md` (root, 483) | M2 homework report | 📦 HISTORICAL | "M2 — Report" (IDE setup writeup). Course artifact, not living doc | Archive → `docs-archived-2026-06-02/` |
| `m5-spec.md` (root, 2298) | M5 homework spec | 📦 HISTORICAL | The M5 assignment text sitting at repo root; belongs with homework. Describes already-shipped M5 | Archive (or move under `homework/M5/`); out of living-docs |
| `anti-slop-supplement.md` (root) | scratch | ❌ untracked | Not git-tracked (working scratch) | Leave alone — not a committed doc |
| `prompt.md` (root) | scratch | ❌ untracked | Not git-tracked | Leave alone |
| `error-message.txt` (root) | scratch | ❌ untracked | Not git-tracked | Leave alone |
| `CLAUDE.md`, `DESIGN.md` (root) | Agent rules / design | ✅ ACCURATE | Live agent-rules + design rules; CLAUDE.md just updated (main-branch note). DESIGN.md = M4 design rules | Keep at root; CLAUDE.md gets the two new project-index sections in Phase 5 |

## Summary counts

`✅ ACCURATE: 5` (3 ADR + CLAUDE.md + DESIGN.md) · `✅ in-use DATA: 2` (project-data/, chunks.jsonl) · `🔄 PARTIALLY: 2` (architecture.md, README.md) · `📦 HISTORICAL: 5` (superpowers plans, superpowers specs, FINDINGS.md, report.md, m5-spec.md) · `❌ untracked scratch: 3` (left untouched)

## Cross-references to preserve

- **ADR numbering** — the 3 fork ADRs are `0001-0003`. New ADRs (Stage 1 proposed ADR-0004 MCP-single-writer, ADR-0005 authz-layer) continue from `0004`. Do **not** restart numbering.
- **`docs/project-data/adrs/` ≠ fork ADRs** — synthetic RAG corpus. Keep the distinction explicit in project-index.json `ai_routing` so future agents don't treat them as decisions.
- **dev-history** — `docs/superpowers/plans/` chronicles how M3-M5 were built; link from the new `docs/architecture/README.md` so the institutional knowledge isn't orphaned after archiving.
- **FINDINGS.md → Stage 1 synthesis** — note in synthesis that FINDINGS#1 was fixed (c936c41) and #2 maps to the SEC-002 price/payment area.
- **RAG data subtree** — `docs/project-data/` + `docs/chunks.jsonl` stay; document them as data (not docs) in project-index.json.

# proshop_mern — Documentation Index

> Start with **`project-index.json`** (repo root) for the machine-readable map. This folder holds the human-facing living docs. Rebuilt M6 Stage 3 (2026-06-02).

## Layout

| Path | What |
|---|---|
| [`architecture/overview.md`](architecture/overview.md) | C4 + sequence diagrams for the MERN core (has a TODO banner for M3-M5 coverage gaps). |
| [`adr/`](adr/) | Architecture Decision Records for **this fork**. `0001-0003` accepted; `0004-0005` proposed (from the M6 Stage 1 review). |
| [`specs/`](specs/) | Per-module 4-step reverse-engineering specs (Overview / Decision Table / Sequence Diagram / Edge Cases / Open Questions / Suggested Tests). |
| `project-data/` | **RAG corpus — DATA, not docs.** Synthetic long-form docs that feed the project-docs MCP. Do not treat as authoritative about the current fork. |
| `chunks.jsonl` | **RAG runtime artifact** read at import by `mcp-project-docs/server.py`. Generated; do not hand-edit. |

## Module specs

- [`specs/feature-flags-mcp-spec.md`](specs/feature-flags-mcp-spec.md) — TS MCP, sole writer of `backend/features.json`.
- [`specs/project-docs-rag-spec.md`](specs/project-docs-rag-spec.md) — Python hybrid-RAG MCP (BGE-M3 + BM25 + RRF).
- [`specs/order-controller-spec.md`](specs/order-controller-spec.md) — order lifecycle (post Stage-2 SEC-001 fix).

## ADRs

- [`adr/0001-jwt-bearer-token-in-localstorage.md`](adr/0001-jwt-bearer-token-in-localstorage.md) — Accepted
- [`adr/0002-single-process-prod-deployment.md`](adr/0002-single-process-prod-deployment.md) — Accepted
- [`adr/0003-runtime-paypal-client-id-endpoint.md`](adr/0003-runtime-paypal-client-id-endpoint.md) — Accepted
- [`adr/0004-feature-flags-mcp-single-writer.md`](adr/0004-feature-flags-mcp-single-writer.md) — **Proposed**
- [`adr/0005-authorization-layer.md`](adr/0005-authorization-layer.md) — **Proposed**

## Provenance / history

- Review findings: `homework/M6/stage1-code-review/synthesis.md` (57 findings; Top-3 fixed in Stage 2).
- Build history (how M3-M5 were implemented): `docs-archived-2026-06-02/superpowers/` (plans + design specs).
- Prior risk table: `docs-archived-2026-06-02/FINDINGS.md` (superseded by the Stage 1 synthesis).

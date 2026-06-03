# Design: MCP server `project-docs`

**Date:** 2026-05-05
**Topic:** Wrap the Part 2 RAG query script (`scripts/rag_query.py`) in an MCP
server that exposes a single tool, `search_project_docs`, alongside the
existing Part 1 `feature-flags` MCP server.

## Goal

Make the proshop_mern documentation corpus (architecture, ADRs, features,
runbooks, incidents, glossary, dev history) reachable from any MCP client
through one well-described tool. The retrieval pipeline (BGE-M3 dense +
BM25Okapi keyword, fused via RRF) already exists in `scripts/rag_query.py`
and is reused as-is.

## Non-goals

- Re-implementing the retrieval pipeline. The MCP server is a thin wrapper
  around `HybridRetriever` from `scripts/rag_query.py`.
- Exposing retrieval knobs (`mode`, `RRF_K`, `prefetch`, group/source-file
  filters). The tool surface is exactly `query` + `top_k`.
- Inter-server communication. The two MCP servers (`feature-flags` and
  `project-docs`) coexist in the same MCP client config but never call each
  other; cross-references live only in tool descriptions.
- Writing pytest for the wrapper. The retrieval logic is already covered by
  `scripts/rag_query.py`; the new code is glue.

## Architecture

New directory at repo root, mirroring `mcp-feature-flags/`:

```
mcp-project-docs/
├── server.py              # entry point, stdio MCP server
├── requirements.txt       # mcp, ollama, qdrant-client, rank-bm25
└── README.md              # how to register alongside feature-flags
```

`scripts/rag_query.py` is unchanged. `server.py` imports `HybridRetriever`
from it and instantiates it once at module load.

## Tool surface

```
search_project_docs(query: str, top_k: int = 5) -> list[Chunk]
```

Each `Chunk` returned is exactly six fields, in this order:

| field             | source                                  |
|-------------------|------------------------------------------|
| `source_file`     | `chunk.metadata.source_file`             |
| `file_path`       | `chunk.metadata.file_path`               |
| `title`           | `chunk.metadata.title`                   |
| `parent_headings` | `chunk.metadata.parent_headings` (list)  |
| `score`           | RRF score from `HybridRetriever.search`  |
| `snippet`         | head-truncated `chunk.text`, ≤200 chars  |

Retrieval parameters fixed inside the server: `mode="hybrid"`, defaults
from `rag_query.py` (`RRF_K=60`, `PREFETCH_LIMIT=50`). No filters surfaced.

### Snippet generation

Helper `_make_snippet(text: str, max_len: int = 200) -> str`:

1. Replace any run of whitespace (incl. newlines) with a single space.
2. Strip.
3. If length ≤ `max_len`, return as is.
4. Otherwise, cut at last whitespace at or before `max_len - 1`, append "…".

Deterministic, no query-aware windowing (kept out of scope).

### Tool description

Follows the structure used by `get_feature_info` in `mcp-feature-flags/server.ts`:
**What / When to call / When NOT to call / Input / Output / Examples**.

Required content (verbatim phrasing where the user's prompt was specific):

- **When to call:** "Search information about the proshop_mern product —
  architecture, features, ADRs, runbooks, incidents, glossary, dev history.
  **You MUST use this FIRST when the user asks about product
  functionality.**"
- **When NOT to call:** "Current state of feature flags — use the
  `feature-flags` MCP `get_feature_info` for that. Not for general
  MERN/React/Mongoose questions — those belong to learning resources, not
  this corpus."
- **Examples:** at least three concrete `query` strings drawn from the
  domain (e.g. `"why MongoDB and not Postgres"`, `"how does the cart
  persist across reloads"`, `"runbook for PayPal webhook failure"`).

## Lifecycle

- Module import builds one `HybridRetriever` instance. This loads
  `docs/chunks.jsonl` and constructs the BM25Okapi index. Both are
  multi-second one-time costs that must not happen per tool call.
- `HybridRetriever` already holds a `QdrantClient` and an `ollama.Client`.
  Reuse them.
- The current `rag_query.search()` constructs a fresh `HybridRetriever` on
  every call — fine for CLI, wrong for a long-lived MCP server. The wrapper
  bypasses `search()` and calls the retriever method directly.

## Configuration (env vars, all optional)

| var                     | default                       |
|-------------------------|-------------------------------|
| `QDRANT_URL`            | `http://localhost:6333`       |
| `OLLAMA_HOST`           | `http://localhost:11434`      |
| `PROSHOP_COLLECTION`    | `proshop_chunks`              |
| `PROSHOP_CHUNKS_PATH`   | `docs/chunks.jsonl` (relative to repo root) |

Defaults match `rag_query.py`. Resolution of the chunks path is relative to
the repo root (computed from `__file__`), not CWD, so the server works no
matter where the MCP client launches it from.

## Error handling

Tool invocations never raise out of the handler. Errors are returned as
structured JSON in the MCP text content, matching the convention used by
Part 1 (`{ error: "...", ... }`):

| condition                          | response                                                                            |
|-----------------------------------|-------------------------------------------------------------------------------------|
| `top_k < 1` or `top_k > 50`        | `{ error: "INVALID_TOP_K", top_k, message }`                                        |
| Qdrant unreachable / refused       | `{ error: "QDRANT_UNAVAILABLE", message, hint: "ensure qdrant is running on $QDRANT_URL" }` |
| Ollama unreachable / refused       | `{ error: "OLLAMA_UNAVAILABLE", message, hint: "ensure ollama is running on $OLLAMA_HOST" }` |
| Embedding model missing            | `{ error: "EMBED_MODEL_UNAVAILABLE", model: "bge-m3", message }`                    |
| Empty `query` (whitespace-only)    | `{ error: "EMPTY_QUERY" }`                                                          |

`HybridRetriever` initialization failure (chunks file missing or unreadable)
fails fast at module import — the server cannot serve and should not start.

## Registration alongside Part 1

`README.md` documents an MCP client config snippet (e.g. Claude Code's
`.mcp.json`) registering both servers:

```jsonc
{
  "mcpServers": {
    "feature-flags": {
      "command": "node",
      "args": ["mcp-feature-flags/dist/server.js"]
    },
    "project-docs": {
      "command": "python",
      "args": ["mcp-project-docs/server.py"]
    }
  }
}
```

Plus a one-paragraph note: "Use `project-docs.search_project_docs` for
documentation/architecture questions; use `feature-flags.get_feature_info`
for runtime flag state. The two never overlap."

## Smoke check

`python mcp-project-docs/server.py --selftest "<query>"` bypasses the MCP
transport, runs the same retrieval call the tool would, and prints the
first hit (formatted like the existing `_format_hit` helper). Used to
verify Qdrant/Ollama wiring without launching an MCP client.

## Dependencies

`mcp-project-docs/requirements.txt`:

```
mcp>=1.0.0
ollama>=0.4.0
qdrant-client>=1.12.0
rank-bm25>=0.2.2
```

(`mcp` is the only new dep; the other three already live in
`requirements-rag.txt` for Part 2.)

## Risks / open questions

- **Cold start latency.** First request after server start pays both the
  chunks load (~MBs of JSONL) and the BM25 build. Acceptable for an MCP
  server (one-time). If it ever becomes painful, lazy-load behind first
  call instead of at import.
- **Chunks file drift.** If `docs/chunks.jsonl` is regenerated while the
  server is running, the server keeps serving the old index. Acceptable —
  rebuilding the corpus is a manual ops step; restart the server after.
- **Qdrant collection name mismatch.** If the collection is recreated under
  a different name, server returns `QDRANT_UNAVAILABLE`-shaped errors per
  query. Configurable via `PROSHOP_COLLECTION`.

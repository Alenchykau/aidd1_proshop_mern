# project-docs MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the Part 2 hybrid RAG (`scripts/rag_query.py`) in an MCP server exposing one tool `search_project_docs(query, top_k=5) → list[Chunk]`, ready to register alongside the existing Part 1 `feature-flags` MCP server.

**Architecture:** Single Python file `mcp-project-docs/server.py` using the `mcp` SDK's `FastMCP`. It imports `HybridRetriever` from `scripts/rag_query.py`, initializes it once at module import (loads `docs/chunks.jsonl`, builds BM25 index), exposes the tool via stdio, and ships a `--selftest` mode for smoke checks without an MCP client.

**Tech Stack:** Python 3.10+, `mcp` SDK, `ollama`, `qdrant-client`, `rank-bm25`. No new test framework — the underlying retrieval is already validated in Part 2; this layer is glue verified by smoke tests.

**Spec:** `docs/superpowers/specs/2026-05-05-mcp-project-docs-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `mcp-project-docs/server.py` | MCP server entry point: helpers, retriever singleton, `_search`, error classifier, FastMCP tool registration, `--selftest` CLI |
| `mcp-project-docs/requirements.txt` | Dependencies for this server only |
| `mcp-project-docs/README.md` | Prereqs, install, smoke check, registration snippet alongside `feature-flags` |

`scripts/rag_query.py` is **not** modified — the wrapper accesses `HybridRetriever` and its `_id_to_chunk` map directly to enrich hits with `parent_headings` / `file_path` (which the public `search()` return shape doesn't include).

---

## Task 1: Bootstrap directory & dependencies

**Files:**
- Create: `mcp-project-docs/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
mcp>=1.0.0
ollama>=0.4.0
qdrant-client>=1.12.0
rank-bm25>=0.2.2
```

- [ ] **Step 2: Install deps into the project's Python env**

Run: `pip install -r mcp-project-docs/requirements.txt`

Expected: install succeeds, no resolver conflict with `requirements-rag.txt`.

- [ ] **Step 3: Verify imports load**

Run:
```bash
python -c "import mcp.server.fastmcp, ollama, qdrant_client, rank_bm25; print('ok')"
```
Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
git add mcp-project-docs/requirements.txt
git commit -m "course: chore: add mcp-project-docs requirements"
```

---

## Task 2: Snippet helper + chunk formatter (with inline sanity checks)

**Files:**
- Create: `mcp-project-docs/server.py`

- [ ] **Step 1: Create server.py with helpers and a sanity main**

Initial content (will be extended in later tasks):

```python
"""MCP server exposing hybrid RAG search over the proshop_mern doc corpus.

This module wraps scripts/rag_query.HybridRetriever and exposes one tool,
search_project_docs, over the MCP stdio transport.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

CHUNKS_PATH = Path(
    os.environ.get("PROSHOP_CHUNKS_PATH", REPO_ROOT / "docs" / "chunks.jsonl")
)
COLLECTION = os.environ.get("PROSHOP_COLLECTION", "proshop_chunks")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

_WHITESPACE_RE = re.compile(r"\s+")
SNIPPET_MAX = 200


def _make_snippet(text: str, max_len: int = SNIPPET_MAX) -> str:
    collapsed = _WHITESPACE_RE.sub(" ", text or "").strip()
    if len(collapsed) <= max_len:
        return collapsed
    cut = collapsed.rfind(" ", 0, max_len - 1)
    if cut <= 0:
        cut = max_len - 1
    return collapsed[:cut] + "…"


def _format_chunk(score: float, chunk: dict) -> dict:
    m = chunk["metadata"]
    return {
        "source_file": m.get("source_file"),
        "file_path": m.get("file_path"),
        "title": m.get("title"),
        "parent_headings": m.get("parent_headings", []),
        "score": round(float(score), 6),
        "snippet": _make_snippet(chunk.get("text", "")),
    }


if __name__ == "__main__":
    # Sanity check, replaced by a proper CLI in Task 3.
    samples = [
        ("", 0),
        ("short text", len("short text")),
        ("a " * 200, SNIPPET_MAX),
    ]
    for text, expected_max in samples:
        s = _make_snippet(text)
        assert len(s) <= max(expected_max, SNIPPET_MAX), (text, s)
        print(repr(s))

    fake_chunk = {
        "text": "Hello\n\nworld   " + ("x" * 500),
        "metadata": {
            "source_file": "f.md",
            "file_path": "docs/f.md",
            "title": "T",
            "parent_headings": ["A", "B"],
        },
    }
    out = _format_chunk(0.1234567, fake_chunk)
    print(json.dumps(out, ensure_ascii=False))
    assert out["score"] == 0.123457
    assert out["snippet"].startswith("Hello world ")
    assert out["snippet"].endswith("…")
    assert out["parent_headings"] == ["A", "B"]
    print("ok")
```

- [ ] **Step 2: Run the sanity main**

Run: `python mcp-project-docs/server.py`

Expected (last line): `ok`. No `AssertionError`.

- [ ] **Step 3: Commit**

```bash
git add mcp-project-docs/server.py
git commit -m "course: feat: add snippet helper and chunk formatter for project-docs MCP"
```

---

## Task 3: Wire HybridRetriever singleton + `--selftest` CLI

**Files:**
- Modify: `mcp-project-docs/server.py` (replace the temporary `if __name__ == "__main__"` block; add imports and singleton)

- [ ] **Step 1: Add the path bootstrap and retriever singleton near the top of `server.py`**

Insert after the `OLLAMA_HOST` line, before `_WHITESPACE_RE`:

```python
# Make scripts/ importable so we can reuse HybridRetriever as-is.
sys.path.insert(0, str(REPO_ROOT))
from scripts.rag_query import HybridRetriever  # noqa: E402
```

- [ ] **Step 2: Add the singleton init below `_format_chunk`**

```python
# Module-level singleton — fail-fast at import if chunks file is missing or
# unreadable. Qdrant/Ollama are NOT touched here (clients are lazy);
# connection failures surface per-query and are classified in _search.
_retriever = HybridRetriever(
    chunks_path=CHUNKS_PATH,
    qdrant_url=QDRANT_URL,
    ollama_host=OLLAMA_HOST,
    collection=COLLECTION,
)
```

- [ ] **Step 3: Add the `_search` core function below the singleton**

```python
def _search(query: str, top_k: int = 5):
    if not query or not query.strip():
        return {"error": "EMPTY_QUERY"}
    if not isinstance(top_k, int) or top_k < 1 or top_k > 50:
        return {
            "error": "INVALID_TOP_K",
            "top_k": top_k,
            "message": "top_k must be an integer in [1, 50]",
        }

    hits = _retriever.search(
        query, top_k=top_k, mode="hybrid", group=None, source_file=None
    )
    out = []
    for h in hits:
        chunk = _retriever._id_to_chunk.get(h["id"])
        if chunk is None:
            continue
        out.append(_format_chunk(h["score"], chunk))
    return out
```

- [ ] **Step 4: Replace the temporary sanity main at the bottom of the file with the selftest CLI**

```python
def _selftest(query: str, top_k: int = 5) -> int:
    result = _search(query, top_k)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--selftest":
        q = sys.argv[2] if len(sys.argv) > 2 else ""
        k = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        sys.exit(_selftest(q, k))
    # MCP server entry is added in Task 5.
    print("error: server entry not wired yet (Task 5). Use --selftest for now.", file=sys.stderr)
    sys.exit(2)
```

- [ ] **Step 5: Verify import/init works (chunks file load, BM25 build)**

Prereq: `docs/chunks.jsonl` exists (it does — last commit `40d6089` left it in place).

Run:
```bash
python -c "import importlib.util, pathlib; spec=importlib.util.spec_from_file_location('s', 'mcp-project-docs/server.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print('chunks:', len(m._retriever._chunks))"
```
Expected: prints `chunks: <N>` where N is the number of lines in `docs/chunks.jsonl`. No exception.

- [ ] **Step 6: Run a real selftest (requires Qdrant + Ollama up with `bge-m3` pulled and `proshop_chunks` collection populated)**

Run:
```bash
python mcp-project-docs/server.py --selftest "why MongoDB and not Postgres" 3
```
Expected: a JSON array of up to 3 objects, each with keys `source_file`, `file_path`, `title`, `parent_headings`, `score`, `snippet`. Top hit `source_file` should be `adr-001-mongodb-vs-postgres.md`.

If Qdrant/Ollama are down, expect a traceback for now — error classification is added in Task 4.

- [ ] **Step 7: Commit**

```bash
git add mcp-project-docs/server.py
git commit -m "course: feat: wire HybridRetriever singleton and selftest CLI"
```

---

## Task 4: Error classification

**Files:**
- Modify: `mcp-project-docs/server.py` (wrap `_retriever.search` in `_search`, add `_classify_error` helper)

- [ ] **Step 1: Add the classifier helper above `_search`**

```python
def _classify_error(exc: BaseException) -> dict:
    """Map a retrieval exception to a structured MCP-friendly error dict."""
    msg = str(exc)
    cls = type(exc).__name__
    low = msg.lower()
    cls_low = cls.lower()

    is_conn = (
        "connecterror" in cls_low
        or "connectionrefused" in cls_low
        or "connection refused" in low
        or "failed to connect" in low
        or "name or service not known" in low
        or "max retries exceeded" in low
    )
    if is_conn:
        if "11434" in msg or "ollama" in low:
            return {
                "error": "OLLAMA_UNAVAILABLE",
                "message": msg,
                "hint": f"ensure ollama is running on {OLLAMA_HOST}",
            }
        return {
            "error": "QDRANT_UNAVAILABLE",
            "message": msg,
            "hint": f"ensure qdrant is running on {QDRANT_URL}",
        }

    if "model" in low and ("not found" in low or "does not exist" in low or "pull" in low):
        return {
            "error": "EMBED_MODEL_UNAVAILABLE",
            "model": "bge-m3",
            "message": msg,
            "hint": "run `ollama pull bge-m3`",
        }

    return {"error": "INTERNAL", "type": cls, "message": msg}
```

- [ ] **Step 2: Wrap the retriever call in `_search` so exceptions are caught**

Replace the body of `_search` after the validation block with:

```python
    try:
        hits = _retriever.search(
            query, top_k=top_k, mode="hybrid", group=None, source_file=None
        )
    except Exception as exc:
        return _classify_error(exc)

    out = []
    for h in hits:
        chunk = _retriever._id_to_chunk.get(h["id"])
        if chunk is None:
            continue
        out.append(_format_chunk(h["score"], chunk))
    return out
```

- [ ] **Step 3: Verify validation errors**

Run: `python mcp-project-docs/server.py --selftest ""`
Expected output:
```json
{
  "error": "EMPTY_QUERY"
}
```

Run: `python mcp-project-docs/server.py --selftest "anything" 999`
Expected output:
```json
{
  "error": "INVALID_TOP_K",
  "top_k": 999,
  "message": "top_k must be an integer in [1, 50]"
}
```

- [ ] **Step 4: Verify Qdrant-down classification**

Stop Qdrant (or set `QDRANT_URL=http://localhost:1` to force a refused connection) and run:
```bash
QDRANT_URL=http://localhost:1 python mcp-project-docs/server.py --selftest "test" 1
```
Expected: JSON object with `"error": "QDRANT_UNAVAILABLE"` and a `hint` mentioning `localhost:1`. No traceback.

(On Windows PowerShell the env-var prefix syntax is `$env:QDRANT_URL='http://localhost:1'; python mcp-project-docs/server.py --selftest "test" 1`.)

- [ ] **Step 5: Commit**

```bash
git add mcp-project-docs/server.py
git commit -m "course: feat: classify retriever errors into MCP-friendly responses"
```

---

## Task 5: Register the MCP tool with FastMCP and wire stdio entry

**Files:**
- Modify: `mcp-project-docs/server.py` (import FastMCP, define `TOOL_DESCRIPTION`, register tool, replace stub main with `mcp.run()`)

- [ ] **Step 1: Add the FastMCP import near the other top-level imports**

Add after the `HybridRetriever` import:

```python
from mcp.server.fastmcp import FastMCP  # noqa: E402
```

- [ ] **Step 2: Add the tool description constant above the `_retriever` singleton**

```python
TOOL_DESCRIPTION = """\
What: Hybrid (dense BGE-M3 + BM25 with Reciprocal Rank Fusion) retrieval \
over the proshop_mern documentation corpus — architecture, ADRs, features, \
runbooks, incidents, glossary, dev history. Returns top_k chunks with \
provenance metadata.

When to call: User asks about how the proshop_mern product works, why a \
decision was made, what a feature does, where something is defined in the \
docs, an incident or runbook lookup, or any "is there something about X in \
our docs?" question. You MUST use this FIRST when the user asks about \
product functionality.

When NOT to call: Current state of feature flags — use the feature-flags \
MCP get_feature_info / set_feature_state for that. General questions about \
React, MERN, Mongoose, JavaScript, etc. that are not about THIS product — \
those belong to language/framework knowledge, not this corpus. Do not call \
with empty queries.

Input: { query: string (free text, the user's question or keywords), \
top_k: integer in [1, 50] (default 5) }

Output on success: list[Chunk] where each Chunk has:
  - source_file:     filename of the source markdown
  - file_path:       repo-relative path to the source file
  - title:           heading the chunk lives under
  - parent_headings: list of breadcrumb headings (root -> leaf)
  - score:           hybrid relevance score (higher = better)
  - snippet:         first ~200 chars of chunk text

Output on error: { error: "EMPTY_QUERY" | "INVALID_TOP_K" | \
"QDRANT_UNAVAILABLE" | "OLLAMA_UNAVAILABLE" | "EMBED_MODEL_UNAVAILABLE" | \
"INTERNAL", message?, hint?, ... }

Examples:
  1) search_project_docs({ query: "why MongoDB and not Postgres", top_k: 3 })
  2) search_project_docs({ query: "how does the cart persist across reloads" })
  3) search_project_docs({ query: "PayPal webhook failure runbook", top_k: 5 })
"""
```

- [ ] **Step 3: Instantiate FastMCP and register the tool below `_search`**

```python
mcp = FastMCP("project-docs")


@mcp.tool(description=TOOL_DESCRIPTION)
def search_project_docs(query: str, top_k: int = 5):
    """See TOOL_DESCRIPTION for the full contract."""
    return _search(query, top_k)
```

- [ ] **Step 4: Replace the stub main block with the real entry**

Replace the existing `if __name__ == "__main__":` block with:

```python
if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--selftest":
        q = sys.argv[2] if len(sys.argv) > 2 else ""
        k = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        sys.exit(_selftest(q, k))
    mcp.run()  # stdio transport by default
```

- [ ] **Step 5: Verify the selftest still works**

Run: `python mcp-project-docs/server.py --selftest "why MongoDB and not Postgres" 3`
Expected: same JSON list as in Task 3 step 6.

- [ ] **Step 6: Verify the MCP server boots and lists the tool**

Run (sends two JSON-RPC frames over stdio: `initialize` then `tools/list`):

```bash
python -c "
import json, subprocess
p = subprocess.Popen(['python', 'mcp-project-docs/server.py'],
                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
def send(obj):
    p.stdin.write(json.dumps(obj) + '\n'); p.stdin.flush()
send({'jsonrpc':'2.0','id':1,'method':'initialize','params':{
    'protocolVersion':'2024-11-05','capabilities':{},
    'clientInfo':{'name':'smoke','version':'0'}}})
print('init:', p.stdout.readline().strip()[:120])
send({'jsonrpc':'2.0','method':'notifications/initialized','params':{}})
send({'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}})
line = p.stdout.readline()
print('tools:', 'search_project_docs' in line)
p.terminate()
"
```

Expected output:
```
init: {"jsonrpc":"2.0","id":1,"result":{...
tools: True
```

- [ ] **Step 7: Commit**

```bash
git add mcp-project-docs/server.py
git commit -m "course: feat: register search_project_docs MCP tool and stdio entry"
```

---

## Task 6: README with prereqs, smoke check, and registration snippet

**Files:**
- Create: `mcp-project-docs/README.md`

- [ ] **Step 1: Write README**

```markdown
# project-docs MCP server

Wraps the Part 2 hybrid RAG (dense BGE-M3 + BM25Okapi, fused with RRF) over
the proshop_mern documentation corpus and exposes it as a single MCP tool.

## Tool

`search_project_docs(query: str, top_k: int = 5) -> list[Chunk]`

Each `Chunk` has six fields: `source_file`, `file_path`, `title`,
`parent_headings`, `score`, `snippet` (~200 chars). See the
`TOOL_DESCRIPTION` constant in `server.py` for the description registered
with the MCP client.

## Prerequisites

- Python 3.10+
- Qdrant running at `$QDRANT_URL` (default `http://localhost:6333`) with
  the `proshop_chunks` collection populated — see `scripts/embed_chunks.py`
- Ollama running at `$OLLAMA_HOST` (default `http://localhost:11434`) with
  the `bge-m3` model pulled (`ollama pull bge-m3`)

## Install

    pip install -r mcp-project-docs/requirements.txt

## Smoke check

    python mcp-project-docs/server.py --selftest "why MongoDB and not Postgres" 3

Prints the JSON the tool would return. Use this to verify Qdrant/Ollama
wiring without launching an MCP client.

## Register alongside the feature-flags server

Both servers run side-by-side under one MCP client. Example `.mcp.json`:

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

Use `project-docs.search_project_docs` for documentation/architecture
questions; use `feature-flags.get_feature_info` for runtime flag state.
The two never overlap — cross-references are also embedded in each tool's
description.

## Environment

| var                    | default                       |
|------------------------|-------------------------------|
| `QDRANT_URL`           | `http://localhost:6333`       |
| `OLLAMA_HOST`          | `http://localhost:11434`      |
| `PROSHOP_COLLECTION`   | `proshop_chunks`              |
| `PROSHOP_CHUNKS_PATH`  | `<repo>/docs/chunks.jsonl`    |
```

- [ ] **Step 2: Verify renders cleanly** (open in editor or `glow`/`bat`; no broken code fences).

- [ ] **Step 3: Commit**

```bash
git add mcp-project-docs/README.md
git commit -m "course: docs: add project-docs MCP README and registration snippet"
```

---

## Final verification

- [ ] **All-up smoke**

With Qdrant + Ollama running:

```bash
python mcp-project-docs/server.py --selftest "PayPal webhook failure runbook"
```

Expected: top hit's `source_file` is one of the runbook markdown files under `docs/project-data/runbooks/`, `parent_headings` is non-empty, `snippet` is ≤ 200 chars and ends with `…` if the chunk text is longer.

- [ ] **Confirm spec coverage**

Walk through `docs/superpowers/specs/2026-05-05-mcp-project-docs-design.md` section by section and tick each requirement against a task above (architecture → Task 2/3/5, tool surface → Task 5, snippet → Task 2, lifecycle → Task 3, configuration → Task 2, error handling → Task 4, registration → Task 6, smoke check → Task 3 step 6 / final verification).

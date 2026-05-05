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

# Make scripts/ importable so we can reuse HybridRetriever as-is.
sys.path.insert(0, str(REPO_ROOT))
from scripts.rag_query import HybridRetriever  # noqa: E402

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


# Module-level singleton — fail-fast at import if chunks file is missing or
# unreadable. Qdrant/Ollama are NOT touched here (clients are lazy);
# connection failures surface per-query and are classified in _search.
_retriever = HybridRetriever(
    chunks_path=CHUNKS_PATH,
    qdrant_url=QDRANT_URL,
    ollama_host=OLLAMA_HOST,
    collection=COLLECTION,
)


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

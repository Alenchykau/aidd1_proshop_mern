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
    return collapsed[:cut + 1] + "…"


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

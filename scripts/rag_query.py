"""Query the proshop_chunks Qdrant collection via BGE-M3 embeddings,
optionally fused with BM25 keyword scoring (hybrid retrieval).

Usage:
  python scripts/rag_query.py "your question" [--top-k 5]
                                                [--mode hybrid|dense|bm25]
                                                [--group <name>]
                                                [--source-file <name>]
                                                [--with-text]

Available groups: top-level, adrs, api, features, incidents, runbooks, pages.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import ollama
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue
from rank_bm25 import BM25Okapi

EMBED_MODEL = "bge-m3"
DEFAULT_COLLECTION = "proshop_chunks"
DEFAULT_CHUNKS_PATH = Path("docs/chunks.jsonl")
RRF_K = 60                # Reciprocal Rank Fusion constant
PREFETCH_LIMIT = 50       # candidates per retriever before fusion

_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text) if len(t) > 1]


def _build_filter(group: str | None, source_file: str | None) -> Filter | None:
    must: list[FieldCondition] = []
    if group:
        must.append(FieldCondition(key="group", match=MatchValue(value=group)))
    if source_file:
        must.append(FieldCondition(key="source_file", match=MatchValue(value=source_file)))
    return Filter(must=must) if must else None


class HybridRetriever:
    """Loads chunks once, holds a BM25 index, and queries Qdrant for dense."""

    def __init__(self, chunks_path: Path, qdrant_url: str, ollama_host: str,
                 collection: str):
        self._oc = ollama.Client(host=ollama_host)
        self._qd = QdrantClient(url=qdrant_url)
        self._collection = collection
        self._chunks: list[dict[str, Any]] = [
            json.loads(l) for l in chunks_path.read_text(encoding="utf-8").splitlines()
            if l.strip()
        ]
        # BM25 index over title + summary + keywords + text
        self._tokens = [_tokenize(self._bm25_doc(c)) for c in self._chunks]
        self._bm25 = BM25Okapi(self._tokens)
        self._id_to_chunk = {c["id"]: c for c in self._chunks}

    @staticmethod
    def _bm25_doc(chunk: dict) -> str:
        m = chunk["metadata"]
        return " ".join([
            m.get("title", ""),
            m.get("summary", ""),
            " ".join(m.get("keywords", [])),
            chunk.get("text", ""),
        ])

    def _dense_ranks(self, query: str, flt: Filter | None) -> list[tuple[str, float]]:
        vec = self._oc.embeddings(model=EMBED_MODEL, prompt=query)["embedding"]
        hits = self._qd.query_points(
            collection_name=self._collection,
            query=vec,
            limit=PREFETCH_LIMIT,
            query_filter=flt,
            with_payload=["id"],
        ).points
        return [(h.payload["id"], float(h.score)) for h in hits]

    def _bm25_ranks(self, query: str, flt_predicate) -> list[tuple[str, float]]:
        q_tokens = _tokenize(query)
        if not q_tokens:
            return []
        scores = self._bm25.get_scores(q_tokens)
        ranked = sorted(
            ((self._chunks[i]["id"], float(scores[i])) for i in range(len(scores))
             if flt_predicate(self._chunks[i])),
            key=lambda x: x[1],
            reverse=True,
        )
        return ranked[:PREFETCH_LIMIT]

    def search(self, query: str, *, top_k: int, mode: str,
               group: str | None, source_file: str | None) -> list[dict[str, Any]]:
        flt = _build_filter(group, source_file)

        def predicate(c: dict) -> bool:
            if group and c["metadata"].get("group") != group:
                return False
            if source_file and c["metadata"].get("source_file") != source_file:
                return False
            return True

        dense = self._dense_ranks(query, flt) if mode in ("dense", "hybrid") else []
        bm25 = self._bm25_ranks(query, predicate) if mode in ("bm25", "hybrid") else []

        if mode == "dense":
            ordered = dense[:top_k]
            score_map = dict(dense)
        elif mode == "bm25":
            ordered = bm25[:top_k]
            score_map = dict(bm25)
        else:
            # Reciprocal Rank Fusion
            rrf: dict[str, float] = {}
            for rank, (cid, _) in enumerate(dense):
                rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
            for rank, (cid, _) in enumerate(bm25):
                rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
            ordered = sorted(rrf.items(), key=lambda x: x[1], reverse=True)[:top_k]
            score_map = rrf

        results: list[dict[str, Any]] = []
        for cid, _ in ordered:
            c = self._id_to_chunk.get(cid)
            if c is None:
                continue
            m = c["metadata"]
            results.append({
                "score": float(score_map.get(cid, 0.0)),
                "id": cid,
                "group": m.get("group"),
                "source_file": m.get("source_file"),
                "title": m.get("title"),
                "summary": m.get("summary"),
                "language": m.get("language"),
                "text": c.get("text"),
            })
        return results


def search(query: str, *, top_k: int = 5, mode: str = "hybrid",
           group: str | None = None, source_file: str | None = None,
           chunks_path: Path = DEFAULT_CHUNKS_PATH,
           collection: str = DEFAULT_COLLECTION,
           ollama_host: str = "http://localhost:11434",
           qdrant_url: str = "http://localhost:6333") -> list[dict[str, Any]]:
    r = HybridRetriever(chunks_path, qdrant_url, ollama_host, collection)
    return r.search(query, top_k=top_k, mode=mode, group=group, source_file=source_file)


def _format_hit(hit: dict[str, Any], show_text: bool) -> str:
    parts = [
        f"[{hit['score']:.4f}] {hit['id']}",
        f"  group:       {hit['group']}",
        f"  source_file: {hit['source_file']}",
        f"  title:       {hit['title']}",
        f"  summary:     {hit['summary']}",
    ]
    if show_text:
        snippet = hit["text"].replace("\n", " | ")[:300]
        parts.append(f"  text:        {snippet}")
    return "\n".join(parts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="rag_query")
    parser.add_argument("query")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--mode", choices=["hybrid", "dense", "bm25"], default="hybrid")
    parser.add_argument("--group", default=None)
    parser.add_argument("--source-file", default=None)
    parser.add_argument("--chunks", type=Path, default=DEFAULT_CHUNKS_PATH)
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--ollama-host", default="http://localhost:11434")
    parser.add_argument("--qdrant-url", default="http://localhost:6333")
    parser.add_argument("--with-text", action="store_true")
    args = parser.parse_args(argv)

    hits = search(
        args.query, top_k=args.top_k, mode=args.mode,
        group=args.group, source_file=args.source_file,
        chunks_path=args.chunks, collection=args.collection,
        ollama_host=args.ollama_host, qdrant_url=args.qdrant_url,
    )

    print(f">>> [{args.mode}] {args.query}")
    if args.group or args.source_file:
        flt = [f"{k}={v}" for k, v in [("group", args.group), ("source_file", args.source_file)] if v]
        print(f"    (filter: {', '.join(flt)})")
    print()
    for hit in hits:
        print(_format_hit(hit, args.with_text))
        print()
    if not hits:
        print("(no hits)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

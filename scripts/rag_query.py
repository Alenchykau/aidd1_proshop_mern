"""Query the proshop_chunks Qdrant collection via BGE-M3 embeddings.

Usage:
  python scripts/rag_query.py "your question" [--top-k 5]
                                                [--group <name>]
                                                [--source-file <name>]
                                                [--collection proshop_chunks]
                                                [--ollama-host ...]
                                                [--qdrant-url ...]

Available groups: top-level, adrs, api, features, incidents, runbooks, pages.
"""
from __future__ import annotations

import argparse
import sys
from typing import Any

import ollama
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue

EMBED_MODEL = "bge-m3"
DEFAULT_COLLECTION = "proshop_chunks"


def _build_filter(group: str | None, source_file: str | None) -> Filter | None:
    must: list[FieldCondition] = []
    if group:
        must.append(FieldCondition(key="group", match=MatchValue(value=group)))
    if source_file:
        must.append(FieldCondition(key="source_file", match=MatchValue(value=source_file)))
    return Filter(must=must) if must else None


def search(
    query: str,
    *,
    top_k: int = 5,
    group: str | None = None,
    source_file: str | None = None,
    collection: str = DEFAULT_COLLECTION,
    ollama_host: str = "http://localhost:11434",
    qdrant_url: str = "http://localhost:6333",
) -> list[dict[str, Any]]:
    oc = ollama.Client(host=ollama_host)
    qd = QdrantClient(url=qdrant_url)

    vec = oc.embeddings(model=EMBED_MODEL, prompt=query)["embedding"]
    flt = _build_filter(group, source_file)

    hits = qd.query_points(
        collection_name=collection,
        query=vec,
        limit=top_k,
        query_filter=flt,
        with_payload=True,
    ).points

    return [
        {
            "score": float(h.score),
            "id": h.payload["id"],
            "group": h.payload.get("group"),
            "source_file": h.payload.get("source_file"),
            "title": h.payload.get("title"),
            "summary": h.payload.get("summary"),
            "language": h.payload.get("language"),
            "text": h.payload.get("text"),
        }
        for h in hits
    ]


def _format_hit(hit: dict[str, Any], show_text: bool) -> str:
    parts = [
        f"[{hit['score']:.3f}] {hit['id']}",
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
    parser.add_argument("query", help="Natural-language query")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--group", default=None,
                        help="Pre-filter by dispatch group (e.g. incidents, adrs)")
    parser.add_argument("--source-file", default=None,
                        help="Pre-filter by source file name (e.g. cart.md)")
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--ollama-host", default="http://localhost:11434")
    parser.add_argument("--qdrant-url", default="http://localhost:6333")
    parser.add_argument("--with-text", action="store_true",
                        help="Include a 300-char text snippet per hit")
    args = parser.parse_args(argv)

    hits = search(
        args.query,
        top_k=args.top_k,
        group=args.group,
        source_file=args.source_file,
        collection=args.collection,
        ollama_host=args.ollama_host,
        qdrant_url=args.qdrant_url,
    )

    print(f">>> {args.query}")
    if args.group or args.source_file:
        flt = []
        if args.group:
            flt.append(f"group={args.group}")
        if args.source_file:
            flt.append(f"source_file={args.source_file}")
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

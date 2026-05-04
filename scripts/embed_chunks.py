"""Embed docs/chunks.jsonl with BGE-M3 via Ollama and upsert into Qdrant.

Usage:
  python scripts/embed_chunks.py [--in docs/chunks.jsonl]
                                 [--collection proshop_chunks]
                                 [--ollama-host http://localhost:11434]
                                 [--qdrant-url http://localhost:6333]
                                 [--limit N] [--recreate]

Re-runs are idempotent: point IDs are UUID5(chunk_id), so the same chunk
always maps to the same point. Pass --recreate to drop and recreate the
collection from scratch.
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

import ollama
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
from tqdm import tqdm

EMBED_MODEL = "bge-m3"
EMBED_DIM = 1024  # BGE-M3 dense
NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # constant; UUID5 seed
UPSERT_BATCH = 64


def _point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(NAMESPACE, chunk_id))


def _ensure_collection(qd: QdrantClient, name: str, recreate: bool) -> None:
    exists = qd.collection_exists(name)
    if recreate and exists:
        qd.delete_collection(name)
        exists = False
    if not exists:
        qd.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


def _embed_with_retry(oc, rec) -> list[float] | None:
    """Embed text with retries. Ollama's bge-m3 occasionally emits NaN for very
    short inputs; retry with progressively richer padding until non-NaN."""
    text = rec["text"]
    meta = rec["metadata"]
    title = meta.get("title", "")
    summary = meta.get("summary", "")
    keywords = " ".join(meta.get("keywords", []))
    attempts = [
        text,
        f"{text}\n\n{title}",
        f"{text}\n\n{summary} {keywords}",
    ]
    for prompt in attempts:
        try:
            resp = oc.embeddings(model=EMBED_MODEL, prompt=prompt)
            return list(resp["embedding"])
        except Exception:
            continue
    return None


def _iter_chunks(path: Path, limit: int | None):
    with path.open(encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            if limit is not None and i >= limit:
                break
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="embed_chunks")
    parser.add_argument("--in", dest="input", type=Path, default=Path("docs/chunks.jsonl"))
    parser.add_argument("--collection", default="proshop_chunks")
    parser.add_argument("--ollama-host", default="http://localhost:11434")
    parser.add_argument("--qdrant-url", default="http://localhost:6333")
    parser.add_argument("--limit", type=int, default=None,
                        help="Embed only the first N chunks (smoke test)")
    parser.add_argument("--recreate", action="store_true",
                        help="Drop collection before re-creating")
    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 2

    oc = ollama.Client(host=args.ollama_host)
    qd = QdrantClient(url=args.qdrant_url)

    _ensure_collection(qd, args.collection, args.recreate)

    chunks = list(_iter_chunks(args.input, args.limit))
    print(f"embedding {len(chunks)} chunks via {EMBED_MODEL} -> {args.collection}")

    batch: list[PointStruct] = []
    failures: list[tuple[str, str]] = []

    for rec in tqdm(chunks, unit="chunk"):
        vec = _embed_with_retry(oc, rec)
        if vec is None:
            failures.append((rec["id"], "NaN after retries"))
            continue

        payload = {"id": rec["id"], "text": rec["text"], **rec["metadata"]}
        batch.append(PointStruct(id=_point_id(rec["id"]), vector=vec, payload=payload))

        if len(batch) >= UPSERT_BATCH:
            qd.upsert(collection_name=args.collection, points=batch, wait=False)
            batch = []

    if batch:
        qd.upsert(collection_name=args.collection, points=batch, wait=True)

    info = qd.get_collection(args.collection)
    print(f"collection {args.collection}: points={info.points_count}")
    if failures:
        print(f"failures: {len(failures)}", file=sys.stderr)
        for cid, err in failures[:10]:
            print(f"  {cid}: {err}", file=sys.stderr)
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())

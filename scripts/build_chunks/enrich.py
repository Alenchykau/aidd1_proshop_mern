from __future__ import annotations

import json

from scripts.build_chunks.schema import Chunk

_PROMPT_TEMPLATE = """\
You are enriching pre-chunked documentation for a vector database.

Group: {group}
Number of chunks: {n}

For EACH chunk below, return one JSON object on a single line (JSONL) with these fields:
- "id": exact id from the input
- "summary": exactly one sentence, max 25 words, ends with .!?
- "keywords": 3-10 lowercase strings, no whitespace, max 30 chars each, domain-specific
- "language": one of "en", "ru", "mixed". Override the guess only if obviously wrong.

DO NOT modify the chunk text. DO NOT add fields beyond these four.

Chunks:
{chunks_block}

Respond with the JSONL only, no prose, no markdown fences.
"""


def build_subagent_prompt(chunks: list[Chunk], *, group: str) -> str:
    items = []
    for c in chunks:
        items.append(json.dumps({
            "id": c.id,
            "text": c.text,
            "title": c.metadata.title,
            "parent_headings": c.metadata.parent_headings,
            "language_guess": c.metadata.language,
        }, ensure_ascii=False))
    return _PROMPT_TEMPLATE.format(
        group=group, n=len(chunks), chunks_block="\n".join(items)
    )


def parse_enriched_output(chunks: list[Chunk], jsonl_text: str) -> list[Chunk]:
    by_id = {c.id: c for c in chunks}
    seen: set[str] = set()
    enriched: list[Chunk] = []
    for line in jsonl_text.splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        cid = obj["id"]
        if cid not in by_id:
            raise ValueError(f"unknown chunk id from subagent: {cid}")
        if cid in seen:
            raise ValueError(f"duplicate enriched entry for: {cid}")
        seen.add(cid)
        original = by_id[cid]
        new_meta = original.metadata.model_copy(update={
            "summary": obj["summary"],
            "keywords": obj["keywords"],
            "language": obj["language"],
        })
        enriched.append(Chunk(id=cid, text=original.text, metadata=new_meta))
    missing = set(by_id) - seen
    if missing:
        raise ValueError(f"subagent did not enrich: {sorted(missing)}")
    return enriched

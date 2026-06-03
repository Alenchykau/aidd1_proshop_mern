# Vector DB Chunking — Design

**Status:** Approved (brainstorming → ready for plan)
**Date:** 2026-05-03
**Owner:** alenchykau
**Related:** task M3 of the AI-driven development course (Qdrant local install + RAG over project documentation)

---

## Goal

Convert the documentation under `project-data/` (47 markdown files + one JSON) into a single `chunks.jsonl` artifact suitable for embedding with **BGE-M3** and indexing into a local Qdrant instance.

Out of scope of this spec: actual embedding, indexing into Qdrant, retrieval API. Those are downstream tasks in the same module.

## Inputs

`project-data/` (to be moved to `docs/project-data/`) — 47 markdown files plus `features.json`. Total source size ~365 KB. Approximate token volume (cl100k_base): 80-100K. File-size distribution is highly uneven:

- 6 long-form documents (architecture, best-practices, dev-history, glossary, features-analysis-ru, feature-flags-spec) — 18-42 KB each, deep H2/H3 hierarchy.
- 5 ADRs — canonical structure (Context / Decision / Consequences / Alternatives).
- 5 API docs — endpoint reference style.
- 7 feature docs — long-form (~13-26 KB).
- 3 incident reports.
- 6 runbooks.
- 15 page descriptions — tiny (~1.5-3 KB), uniform structure.
- `features.json` — 14 KB structured data, ~20 feature flags.

## Output

A single newline-delimited JSON file at **`docs/chunks.jsonl`**, committed to git. Estimated size 250-400 KB, ~180-220 records.

Each line is one chunk:

```json
{
  "id": "features/cart#0",
  "text": "# Shopping Cart Feature\n\n## State (Redux)\n\n…",
  "metadata": {
    "source_file": "cart.md",
    "file_path": "docs/project-data/features/cart.md",
    "title": "Shopping Cart Feature",
    "parent_headings": ["State (Redux)"],
    "keywords": ["cart", "redux", "localstorage", "addtocart", "cartitems"],
    "summary": "How the cart Redux slice stores items and persists them to localStorage across reloads.",
    "language": "en",
    "token_count": 412,
    "chunk_index": 0,
    "chunk_total": 4,
    "group": "features"
  }
}
```

## Token budget (cl100k_base via `tiktoken`)

| Symbol | Value | Meaning |
|---|---|---|
| `target` | 500 | Aim for this size when assembling chunks. |
| `max` | 700 | Soft ceiling. Try to avoid exceeding. |
| `hard_max` | 800 | Hard ceiling. Must split. |
| `min` | 100 | Soft floor. Below this, prefer merging with neighbour. |

`tiktoken cl100k_base` is used as a tokenization proxy for chunking decisions only. The downstream embedder (BGE-M3, XLM-RoBERTa tokenizer) re-tokenizes at index time. cl100k_base over-counts Russian text relative to XLM-R, so any chunk that fits in the budget here will fit comfortably in the BGE-M3 8192-token context window.

## Pipeline

```
docs/project-data/{group}/*.md
   │
   ▼  chunker.py (deterministic, no LLM)
[chunks without summary/keywords]
   │
   ▼  Agent(sonnet) × 7 groups in parallel
[chunks enriched with summary + keywords + language]
   │
   ▼  scripts/build_chunks.py merge + validate
docs/chunks.jsonl
```

The split between deterministic chunking (`chunker.py`) and LLM enrichment (subagents) is deliberate:

- Deterministic logic (parsing markdown, counting tokens, deciding section boundaries) does not need an LLM and is cheap to test.
- Re-running enrichment without re-parsing is possible if subagent output is malformed.
- LLM cost stays bounded: 7 sonnet calls instead of one-call-per-chunk.

## Repository layout

```
docs/project-data/        # source data, moved from project-data/ via git mv
docs/chunks.jsonl         # final artifact, committed
docs/superpowers/specs/   # this spec
scripts/
  build_chunks.py         # coordinator: parses, dispatches subagents, merges, validates
  build_chunks/
    __init__.py
    chunker.py            # markdown parsing + section assembly + paragraph fallback
    tokens.py             # tiktoken cl100k_base wrapper
    schema.py             # pydantic models (Chunk, Metadata) + validation
    enrich.py             # builds the prompt sent to each subagent
```

References from existing files:
- `README.md` — note that domain documentation lives under `docs/project-data/`.
- `report.md` — note the path to `docs/chunks.jsonl` and how it was built.

## Chunking algorithm (α)

Implemented in `scripts/build_chunks/chunker.py`.

**Parser.** `markdown-it-py`. AST-based, not regex. Must correctly handle: nested lists, fenced code blocks, tables, link references, frontmatter.

**Frontmatter handling.** If a file starts with a YAML frontmatter block, parse it. A `title:` field there overrides the H1-derived title. All other frontmatter keys are discarded (not embedded into chunk text).

**Preamble handling.** Content that appears between the H1 and the first H2 (a preamble — e.g. the deprecation notice in `architecture.md`) is treated as an implicit first section with `parent_headings = []`. If the preamble is empty or whitespace-only, it is skipped.

**Fallback when no H1.** If the file has no H1, `title` falls back to the filename without extension, title-cased and with hyphens/underscores converted to spaces (e.g. `feature-flag-toggle.md` → `Feature Flag Toggle`).

**Step 1 — section walk.** For each H2 section in the document:

```text
tokens = count(section.text including any subheadings)

if tokens ≤ max:
    emit_chunk(section, parent_headings=[H2.title])

elif section has H3 children:
    for each H3:
        if h3.tokens ≤ max:
            emit_chunk(h3, parent_headings=[H2.title, H3.title])
        else:
            split_by_paragraph(h3, parent=[H2, H3])

else:
    split_by_paragraph(section, parent=[H2])
```

**Step 2 — `split_by_paragraph`.** Used when a section exceeds `max` and either has no H3 children or its H3 child itself overflows.

- Greedily accumulate paragraphs into a chunk until the next paragraph would push past `max`.
- Close the chunk and start a new one.
- **Overlap:** the last sentence of the closed chunk is duplicated as the first sentence of the next chunk. Per the original prompt, overlap is applied only here — when a section is mechanically cut.
- Boundaries must not fall inside a fenced code block, table, or list item. If a candidate split lands inside one, retreat to the start of that block.
- A code block longer than `hard_max` on its own is split line-by-line with a 2-line overlap and a `# (continued)` comment marker added to the second chunk.

**Step 3 — post-process merge.** After emitting all chunks for a file, walk pairs of adjacent chunks. If both are below `min`, share the same parent_headings, and their combined token count is ≤ `target`, merge them into one chunk. This eliminates "stub" chunks like a 30-token `## Status` ADR section.

**Embedder context prefix.** The `text` of every chunk starts with a breadcrumbs prefix that gives BGE-M3 enough context to embed short chunks well:

```
# {h1_title}

## {h2_title}[ > {h3_title}]

{actual_chunk_content}
```

The prefix is included in `token_count` — it is not "free" tokens.

**Chunk ID.** `{relative_path_no_ext}#{seq}`, with `seq` starting at 0 within each file. Example: `runbooks/deploy#3`. Stable: re-running the chunker on an unchanged file produces identical IDs.

**Language detection.** Heuristic in `chunker.py`:

- count Cyrillic letters (Unicode category Cyrillic) and Latin letters in the chunk text;
- > 70% Cyrillic → `"ru"`, > 70% Latin → `"en"`, otherwise `"mixed"`.

The subagent is allowed to override this if obviously wrong (e.g. an EN narrative with a long SQL block).

## Special case — `features.json`

Not routed through the markdown parser. `chunker.py` renders one chunk per top-level feature key using a fixed template:

```
# Feature: {flag.name}

**Flag key:** {key}

{flag.description}

**Dependencies:** {flag.dependencies or "none"}
**Rollout strategy:** {flag.rollout_strategy}
```

Volatile fields (`status`, `traffic_percentage`, `targeted_segments`, `last_modified`) are written **only** to metadata, not into the embedded text. The semantically stable `description` is what gets indexed; current rollout state is fetched at retrieval time from the feature-flags MCP server (already in repo) when needed.

**ID for JSON-derived chunks.** The relpath rule `{relpath_no_ext}` would collapse `features.json` and the `features/` directory into the same prefix, causing collisions. To avoid this, JSON-derived chunks keep the extension in the ID: `features.json#{flag_key}`. `seq` is the flag key string (not an integer) so IDs stay human-readable: `features.json#search_v2`. The chunks are still assigned to the `top-level` dispatch group (since `features.json` lives at the top level of `project-data/`).

## Subagent dispatch (raskladka Y)

Seven Sonnet subagents in parallel. Each owns one group and one output file `chunks.{group}.jsonl`. The coordinator (`scripts/build_chunks.py`) waits for all, then concatenates + validates → `docs/chunks.jsonl`.

| Group | Files | Approx. source size |
|---|---|---|
| top-level | architecture, best-practices, dev-history, glossary, features-analysis-ru, feature-flags-spec, features.json | ~185 KB |
| adrs | 5 files | ~36 KB |
| api | 5 files | ~36 KB |
| features | 7 files | ~106 KB |
| incidents | 3 files | ~24 KB |
| runbooks | 6 files | ~59 KB |
| pages | 15 files | ~33 KB |

**Subagent input.** A JSON payload with one entry per chunk, already produced by `chunker.py`:

```json
[
  {
    "id": "features/cart#0",
    "text": "<chunk text with breadcrumbs prefix>",
    "metadata_partial": {
      "title": "Shopping Cart Feature",
      "parent_headings": ["State (Redux)"],
      "language_guess": "en"
    }
  },
  …
]
```

**Subagent task.** For each chunk, return:
- `summary` — exactly one sentence, ≤ 25 words, ending with `.`/`!`/`?`.
- `keywords` — 3-10 lowercase strings, no stopwords, each ≤ 30 chars. Domain terms preferred (`addToCart`, `JWT`, `multer`) over generic words.
- `language` — `"en" | "ru" | "mixed"`. Override `language_guess` only if obviously wrong.

The subagent must NOT modify `text`. The coordinator validates that text length is unchanged (token count ± 5% — see schema validation below).

**Subagent output.** A JSONL file of fully-formed chunks (text untouched, metadata complete). Written to a temp directory, picked up by the coordinator.

**Concurrency.** All seven subagents launched in a single message (parallel Agent calls). The coordinator blocks until all return.

## Metadata schema (`scripts/build_chunks/schema.py`)

Pydantic models. Validation is run by the coordinator on every chunk before writing `docs/chunks.jsonl`.

**Required for every chunk:**

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | str | chunker | `{relpath_no_ext}#{seq}`, unique across the file |
| `text` | str | chunker | breadcrumbs-prefixed |
| `metadata.source_file` | str | chunker | `basename(path)` |
| `metadata.file_path` | str | chunker | path from repo root, forward slashes |
| `metadata.title` | str | chunker | first H1 of the file, or `flag.name` for features |
| `metadata.parent_headings` | list[str] | chunker | empty if chunk == whole file |
| `metadata.keywords` | list[str] | subagent | 3-10 entries, lowercase, ≤ 30 chars each |
| `metadata.summary` | str | subagent | one sentence, ≤ 200 chars, terminal punctuation |
| `metadata.language` | str | chunker, subagent may override | one of `en`, `ru`, `mixed` |
| `metadata.token_count` | int | chunker | cl100k_base |
| `metadata.chunk_index` | int | chunker | 0-based within file |
| `metadata.chunk_total` | int | chunker | total chunks emitted from the file |
| `metadata.group` | str | chunker | one of the 7 dispatch groups |

**Additional fields for `features.json` chunks only:**

| Field | Type |
|---|---|
| `metadata.flag_key` | str |
| `metadata.flag_status` | str |
| `metadata.traffic_percentage` | int |
| `metadata.rollout_strategy` | str |
| `metadata.targeted_segments` | list[str] |

**Validation rules (fail fast, no silent skips):**

- All required fields present and non-null.
- `id` unique within the chunks of one file (and globally — the coordinator asserts global uniqueness on merge).
- `len(keywords) ∈ [3, 10]`; each lowercase, no whitespace inside, ≤ 30 chars.
- `summary` non-empty, ≤ 200 chars, last char is one of `.!?`.
- `token_count == count(text)` within ±5 % (catches subagent silently editing text).
- `language ∈ {"en", "ru", "mixed"}`.
- `0 ≤ chunk_index < chunk_total`.
- `parent_headings` is a (possibly empty) list of strings, no nulls.

On failure: the coordinator prints which chunk failed which rule and exits non-zero. `docs/chunks.jsonl` is rewritten only on full success.

## Volume estimate

- ~365 KB markdown + 14 KB JSON
- → ~80-100K cl100k_base tokens of source content
- → ~180-220 chunks at `target=500`
- → `docs/chunks.jsonl` final size 250-400 KB

## Out of scope

- Embedding generation (BGE-M3 inference).
- Indexing into Qdrant (collection schema, vector dimension, distance metric).
- Retrieval API / hybrid search.
- Re-chunking on file change (incremental rebuild) — current scope is one-shot full rebuild.

## References

- Course materials: `aidev-course-materials/M3/project-data/` (origin of the dataset before the move).
- BGE-M3 model card: `BAAI/bge-m3` on HuggingFace.
- Local Qdrant install — see commits `course: task3-step1` series and the install dir `D:\Soft\qdrant\`.
- Feature-flags MCP server: previous task in this module, used as the runtime source of truth for flag state.

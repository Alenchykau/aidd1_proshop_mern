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

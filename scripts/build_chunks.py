"""Coordinator CLI for the RAG chunking pipeline.

Subcommands:
  prepare   -- read docs/project-data/, deterministically chunk every file,
               write one input JSON per dispatch group to --out
  validate  -- read per-group enriched JSONL files, merge, validate against
               schema, write the final docs/chunks.jsonl
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Ensure repo root on sys.path so "scripts.build_chunks.*" imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.build_chunks.chunker import chunk_features_json, chunk_markdown
from scripts.build_chunks.groups import GROUPS, group_for
from scripts.build_chunks.schema import Chunk

DATA_ROOT = Path("docs/project-data")


def _discover_files() -> list[Path]:
    files: list[Path] = []
    for p in DATA_ROOT.rglob("*.md"):
        files.append(p)
    json_path = DATA_ROOT / "features.json"
    if json_path.exists():
        files.append(json_path)
    return sorted(files)


def _chunk_file(path: Path) -> list[Chunk]:
    group = group_for(path)
    if path.suffix == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        return chunk_features_json(payload, source_file=path.name,
                                   file_path=str(path).replace("\\", "/"),
                                   group=group)
    md = path.read_text(encoding="utf-8")
    return chunk_markdown(md, source_file=path.name,
                          file_path=str(path).replace("\\", "/"),
                          group=group)


def cmd_prepare(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    by_group: dict[str, list[Chunk]] = {g: [] for g in GROUPS}
    files = _discover_files()
    if not files:
        print(f"ERROR: no files found under {DATA_ROOT}", file=sys.stderr)
        return 2
    for p in files:
        chunks = _chunk_file(p)
        for c in chunks:
            by_group[c.metadata.group].append(c)
    for group, chunks in by_group.items():
        if not chunks:
            continue
        payload = {
            "group": group,
            "chunks": [
                {
                    "id": c.id,
                    "text": c.text,
                    "metadata_partial": {
                        "title": c.metadata.title,
                        "parent_headings": c.metadata.parent_headings,
                        "language_guess": c.metadata.language,
                    },
                }
                for c in chunks
            ],
        }
        (out_dir / f"{group}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    print(f"prepared {sum(len(v) for v in by_group.values())} chunks across "
          f"{sum(1 for v in by_group.values() if v)} groups -> {out_dir}")
    return 0


def cmd_validate(in_input: Path, in_enriched: Path, out: Path) -> int:
    from scripts.build_chunks.enrich import parse_enriched_output

    # Re-derive Chunk objects from source files so text + token_count are guaranteed
    # to match what was produced at prepare time (the chunker is deterministic).
    # Then merge in summary/keywords/language from the enriched per-group JSONLs.
    chunks_by_group: dict[str, list[Chunk]] = {g: [] for g in GROUPS}
    for p in _discover_files():
        for c in _chunk_file(p):
            chunks_by_group[c.metadata.group].append(c)

    # Verify every group with prepared input has a matching enriched file
    for input_file in sorted(in_input.glob("*.json")):
        group = input_file.stem
        if not (in_enriched / f"{group}.jsonl").exists():
            print(f"ERROR: missing enriched output for group {group}", file=sys.stderr)
            return 3

    final: list[Chunk] = []
    seen_ids: set[str] = set()
    for enriched_file in sorted(in_enriched.glob("*.jsonl")):
        group = enriched_file.stem
        group_chunks = chunks_by_group.get(group, [])
        try:
            updated = parse_enriched_output(group_chunks, enriched_file.read_text(encoding="utf-8"))
        except (ValueError, KeyError) as e:
            print(f"ERROR validating {enriched_file.name}: {e}", file=sys.stderr)
            return 4
        for c in updated:
            if c.id in seen_ids:
                print(f"ERROR: duplicate id across groups: {c.id}", file=sys.stderr)
                return 5
            seen_ids.add(c.id)
            final.append(c)

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for c in final:
            fh.write(json.dumps({"id": c.id, "text": c.text,
                                 "metadata": c.metadata.model_dump(exclude_none=True)},
                                ensure_ascii=False))
            fh.write("\n")
    print(f"wrote {len(final)} chunks -> {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="build_chunks")
    sub = parser.add_subparsers(dest="cmd", required=True)

    prep = sub.add_parser("prepare", help="Deterministic chunking; write per-group inputs")
    prep.add_argument("--out", type=Path, default=Path("tmp/chunks/input"))

    val = sub.add_parser("validate", help="Merge enriched outputs; write final JSONL")
    val.add_argument("--in-input", type=Path, default=Path("tmp/chunks/input"))
    val.add_argument("--in-enriched", type=Path, default=Path("tmp/chunks/enriched"))
    val.add_argument("--out", type=Path, default=Path("docs/chunks.jsonl"))

    args = parser.parse_args(argv)
    if args.cmd == "prepare":
        return cmd_prepare(args.out)
    if args.cmd == "validate":
        return cmd_validate(args.in_input, args.in_enriched, args.out)
    parser.error(f"unknown command {args.cmd}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

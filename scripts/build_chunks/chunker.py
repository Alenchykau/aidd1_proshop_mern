from __future__ import annotations

from pathlib import Path
from typing import Literal

from markdown_it import MarkdownIt

from scripts.build_chunks.schema import Chunk, Metadata
from scripts.build_chunks.tokens import count_tokens

TARGET = 500
MAX = 700
HARD_MAX = 800
MIN_TOKENS = 100

# Placeholder values for pre-enrichment chunks. Subagents replace these.
_PLACEHOLDER_SUMMARY = "Pending enrichment."
_PLACEHOLDER_KEYWORDS = ["pending", "enrichment", "placeholder"]


def _detect_language(text: str) -> Literal["en", "ru", "mixed"]:
    cyr = sum(1 for ch in text if "Ѐ" <= ch <= "ӿ")
    lat = sum(1 for ch in text if ("a" <= ch.lower() <= "z"))
    total = cyr + lat
    if total == 0:
        return "en"
    if cyr / total > 0.7:
        return "ru"
    if lat / total > 0.7:
        return "en"
    return "mixed"


def _id_for(file_path: str, seq: int | str) -> str:
    p = Path(file_path)
    rel = p.relative_to("docs/project-data") if "docs/project-data" in p.parts else Path(*p.parts[p.parts.index("project-data") + 1:])
    rel_no_ext = rel.with_suffix("")
    return f"{rel_no_ext.as_posix()}#{seq}"


def _split_h1_and_sections(md: str) -> tuple[str, list[tuple[str, str]]]:
    """
    Returns (h1_title, [(h2_title, h2_body), ...]).
    h2_body includes everything until the next H2 (including any H3+ content).
    Content between H1 and the first H2 is treated as a synthetic section
    with empty title (caller decides how to expose it).
    """
    h1_title = ""
    sections: list[tuple[str, str]] = []
    current_title = ""
    current_body: list[str] = []
    in_h2 = False
    saw_h1 = False
    for line in md.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("# ") and not saw_h1:
            h1_title = stripped[2:].strip()
            saw_h1 = True
            continue
        if stripped.startswith("## "):
            if in_h2 or current_body:
                sections.append((current_title, "".join(current_body).strip()))
            current_title = stripped[3:].strip()
            current_body = []
            in_h2 = True
            continue
        current_body.append(line)
    if current_body or in_h2:
        sections.append((current_title, "".join(current_body).strip()))

    # Drop preamble entry (title="") if its body is empty
    sections = [(t, b) for (t, b) in sections if t or b]
    return h1_title, sections


def chunk_markdown(
    md: str,
    *,
    source_file: str,
    file_path: str,
    group: str,
) -> list[Chunk]:
    h1_title, sections = _split_h1_and_sections(md)
    if not h1_title:
        h1_title = Path(source_file).stem.replace("-", " ").replace("_", " ").title()

    chunks: list[Chunk] = []
    pre_chunks: list[tuple[list[str], str]] = []  # (parent_headings, body)
    for h2_title, body in sections:
        parents = [h2_title] if h2_title else []
        pre_chunks.append((parents, body))

    if not pre_chunks:
        # No body at all — nothing to emit
        return []

    total = len(pre_chunks)
    for idx, (parents, body) in enumerate(pre_chunks):
        prefix = f"# {h1_title}\n\n"
        if parents:
            prefix += f"## {parents[0]}\n\n"
        text = prefix + body + ("\n" if not body.endswith("\n") else "")
        meta = Metadata(
            source_file=source_file,
            file_path=file_path,
            title=h1_title,
            parent_headings=parents,
            keywords=list(_PLACEHOLDER_KEYWORDS),
            summary=_PLACEHOLDER_SUMMARY,
            language=_detect_language(body),
            token_count=count_tokens(text),
            chunk_index=idx,
            chunk_total=total,
            group=group,
        )
        chunks.append(Chunk(id=_id_for(file_path, idx), text=text, metadata=meta))
    return chunks

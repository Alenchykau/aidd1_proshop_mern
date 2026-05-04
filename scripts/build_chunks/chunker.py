from __future__ import annotations

from dataclasses import dataclass, field
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


@dataclass
class _Section:
    title: str
    level: int  # 2 or 3
    body: str = ""
    children: list["_Section"] = field(default_factory=list)


def _parse_tree(md: str) -> tuple[str, list[_Section]]:
    """Returns (h1_title, list of H2 sections, each with optional H3 children)."""
    h1_title = ""
    h2_sections: list[_Section] = []
    current_h2: _Section | None = None
    current_h3: _Section | None = None
    saw_h1 = False
    buffer: list[str] = []

    def flush_buffer_to(target: _Section | None):
        nonlocal buffer
        if buffer and target is not None:
            target.body += "".join(buffer)
        buffer = []

    for line in md.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("# ") and not saw_h1:
            h1_title = stripped[2:].strip()
            saw_h1 = True
            continue
        if stripped.startswith("## "):
            flush_buffer_to(current_h3 or current_h2)
            current_h2 = _Section(title=stripped[3:].strip(), level=2)
            current_h3 = None
            h2_sections.append(current_h2)
            continue
        if stripped.startswith("### ") and current_h2 is not None:
            flush_buffer_to(current_h3 or current_h2)
            current_h3 = _Section(title=stripped[4:].strip(), level=3)
            current_h2.children.append(current_h3)
            continue
        buffer.append(line)
    flush_buffer_to(current_h3 or current_h2)
    for s in h2_sections:
        s.body = s.body.strip()
        for c in s.children:
            c.body = c.body.strip()
    return h1_title, h2_sections


def chunk_markdown(
    md: str,
    *,
    source_file: str,
    file_path: str,
    group: str,
) -> list[Chunk]:
    h1_title, sections = _parse_tree(md)
    if not h1_title:
        h1_title = Path(source_file).stem.replace("-", " ").replace("_", " ").title()

    pre_chunks: list[tuple[list[str], str]] = []
    if not sections:
        # No H2 — emit whole body as single chunk (still need to extract body before H1)
        body = "\n".join(line for line in md.splitlines() if not line.lstrip().startswith("# "))
        if body.strip():
            pre_chunks.append(([], body.strip()))
    else:
        for h2 in sections:
            full_body = h2.body
            if h2.children:
                full_body += "\n\n" + "\n\n".join(
                    f"### {c.title}\n\n{c.body}" for c in h2.children
                )
            tokens_for_full = count_tokens(_format_text(h1_title, [h2.title], full_body))
            if tokens_for_full <= TARGET or not h2.children:
                pre_chunks.append(([h2.title], full_body))
            else:
                # Split at H3 boundaries
                if h2.body.strip():
                    pre_chunks.append(([h2.title], h2.body.strip()))
                for child in h2.children:
                    pre_chunks.append(([h2.title, child.title], child.body))

    if not pre_chunks:
        return []

    chunks: list[Chunk] = []
    total = len(pre_chunks)
    for idx, (parents, body) in enumerate(pre_chunks):
        text = _format_text(h1_title, parents, body)
        meta = Metadata(
            source_file=source_file, file_path=file_path, title=h1_title,
            parent_headings=parents, keywords=list(_PLACEHOLDER_KEYWORDS),
            summary=_PLACEHOLDER_SUMMARY, language=_detect_language(body),
            token_count=count_tokens(text), chunk_index=idx, chunk_total=total,
            group=group,
        )
        chunks.append(Chunk(id=_id_for(file_path, idx), text=text, metadata=meta))
    return chunks


def _format_text(h1: str, parents: list[str], body: str) -> str:
    prefix = f"# {h1}\n\n"
    if parents:
        bc = " > ".join(parents)
        prefix += f"## {bc}\n\n"
    return prefix + body + ("\n" if not body.endswith("\n") else "")

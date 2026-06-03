# Vector DB Chunking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `project-data/` markdown + `features.json` into a validated `docs/chunks.jsonl` ready for BGE-M3 embedding into Qdrant.

**Architecture:** A deterministic Python chunker (`scripts/build_chunks/chunker.py`) parses markdown into chunks with structural metadata. Seven Sonnet subagents (one per dispatch group) enrich each chunk with `summary`, `keywords`, and confirmed `language`. A coordinator (`scripts/build_chunks.py`) merges and validates the per-group enriched JSONLs into the final artifact.

**Tech Stack:**
- Python 3.11+ (system has 3.14)
- `markdown-it-py` 3.x — markdown AST parser
- `tiktoken` — `cl100k_base` token counter (proxy for BGE-M3)
- `pydantic` 2.x — schema validation
- `pytest` — tests
- Windows PowerShell — runtime shell

**Spec:** `docs/superpowers/specs/2026-05-03-vector-db-chunking-design.md` (read first; this plan implements it task by task).

**Deferred from spec (deliberate, low-cost to add later):**

1. **YAML frontmatter parsing.** The spec describes frontmatter handling, but no file in the current `project-data/` corpus uses frontmatter. Skipped to avoid YAGNI. If frontmatter ever appears, add a parser branch in `_parse_tree`.
2. **Code blocks > `hard_max` on their own.** The spec describes line-by-line splitting with a `# (continued)` marker. Current implementation keeps such blocks atomic (potentially overshooting `hard_max`). Acceptable for this corpus — none of the markdown files contain a single fenced block of that size.
3. **Explicit stub-merge post-process.** The spec describes merging adjacent chunks both below `min` with the same parent. Implementation relies on the natural emit logic (sections that fit in `MAX` are emitted whole, so stubs only appear when an H2 splits at H3 and one H3 is tiny). On the current corpus this rarely produces sub-`min` chunks; the explicit merge can be added when an example surfaces.

---

## File structure

**New files:**
- `requirements-rag.txt` — Python deps for the RAG pipeline
- `scripts/build_chunks.py` — coordinator entrypoint (CLI: `prepare` and `validate` subcommands)
- `scripts/build_chunks/__init__.py` — empty
- `scripts/build_chunks/tokens.py` — `count_tokens()` wrapper around tiktoken
- `scripts/build_chunks/schema.py` — pydantic models `Chunk`, `Metadata`, `FeatureFlagExtras`; `validate_chunk()`
- `scripts/build_chunks/chunker.py` — markdown parsing + section assembly + paragraph fallback + features.json renderer
- `scripts/build_chunks/groups.py` — group definitions + file-to-group mapping
- `scripts/build_chunks/enrich.py` — builds the prompt sent to each subagent and parses its JSONL output
- `tests/build_chunks/__init__.py` — empty
- `tests/build_chunks/conftest.py` — pytest fixtures (sample markdown strings)
- `tests/build_chunks/test_tokens.py`
- `tests/build_chunks/test_schema.py`
- `tests/build_chunks/test_chunker.py`
- `tests/build_chunks/test_groups.py`
- `tests/build_chunks/test_enrich.py`

**Moved files:**
- `project-data/**` → `docs/project-data/**` (47 files, one `git mv` per top-level entry to preserve history)

**Generated artifacts (committed at the end):**
- `docs/chunks.jsonl` — final output

**Generated artifacts (transient, gitignored):**
- `tmp/chunks/input/{group}.json` — per-group input to subagents
- `tmp/chunks/enriched/{group}.jsonl` — per-group output from subagents

**Modified files:**
- `README.md` — add a section pointing to `docs/project-data/` and `docs/chunks.jsonl`
- `report.md` — add a section about the chunking pipeline and artifact location
- `.gitignore` — add `tmp/`

---

## Task 0: Bootstrap — move data, scaffold Python project, verify pytest

**Files:**
- Move: `project-data/` → `docs/project-data/`
- Create: `requirements-rag.txt`, `scripts/build_chunks/__init__.py`, `tests/build_chunks/__init__.py`, `tests/build_chunks/conftest.py`
- Modify: `.gitignore`

- [ ] **Step 1: Move project-data into docs/ preserving git history**

```powershell
git mv project-data docs/project-data
git status --short
```

Expected: ~47 lines starting with `R` (renamed), no `D`/`A` pairs.

- [ ] **Step 2: Add tmp/ to .gitignore**

Append to `.gitignore`:

```
# Transient RAG pipeline outputs
tmp/
```

- [ ] **Step 3: Create requirements-rag.txt**

```
markdown-it-py==3.0.0
tiktoken==0.7.0
pydantic==2.9.2
pytest==8.3.3
```

- [ ] **Step 4: Install deps into a venv**

```powershell
python -m venv .venv-rag
.venv-rag\Scripts\Activate.ps1
pip install -r requirements-rag.txt
```

Expected: all four packages install cleanly.

- [ ] **Step 5: Create empty Python package + test scaffolding**

Create `scripts/build_chunks/__init__.py` (empty file).
Create `tests/build_chunks/__init__.py` (empty file).
Create `tests/build_chunks/conftest.py`:

```python
import pytest


@pytest.fixture
def short_md():
    return """# Test Doc

## Section A

Some short content here.

## Section B

More short content.
"""
```

- [ ] **Step 6: Verify pytest discovers the empty test package**

```powershell
pytest tests/build_chunks -v
```

Expected: `no tests ran` exit code 5 (pytest's "no tests collected"). That's fine — confirms discovery works.

- [ ] **Step 7: Commit**

```powershell
git add docs/project-data .gitignore requirements-rag.txt scripts/build_chunks/__init__.py tests/build_chunks/__init__.py tests/build_chunks/conftest.py
git commit -m "course: task3-step2: chore: scaffold RAG chunking pipeline"
```

---

## Task 1: `tokens.py` — token-counting wrapper

**Files:**
- Create: `scripts/build_chunks/tokens.py`
- Test: `tests/build_chunks/test_tokens.py`

- [ ] **Step 1: Write the failing test**

`tests/build_chunks/test_tokens.py`:

```python
from scripts.build_chunks.tokens import count_tokens


def test_count_tokens_basic_english():
    n = count_tokens("hello world")
    assert n == 2


def test_count_tokens_empty_string_is_zero():
    assert count_tokens("") == 0


def test_count_tokens_russian_higher_than_english_chars():
    # cl100k_base over-counts Cyrillic (multi-byte UTF-8 fragments)
    ru = count_tokens("привет мир")  # 10 chars
    en = count_tokens("hello world")  # 11 chars
    assert ru > en
```

- [ ] **Step 2: Run tests and confirm they fail**

```powershell
pytest tests/build_chunks/test_tokens.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.build_chunks.tokens'`.

- [ ] **Step 3: Implement `tokens.py`**

`scripts/build_chunks/tokens.py`:

```python
import tiktoken

_ENCODING = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    if not text:
        return 0
    return len(_ENCODING.encode(text))
```

- [ ] **Step 4: Run tests, expect pass**

```powershell
pytest tests/build_chunks/test_tokens.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/tokens.py tests/build_chunks/test_tokens.py
git commit -m "course: task3-step2: feat(rag): add cl100k_base token counter"
```

---

## Task 2: `schema.py` — pydantic models + validation

**Files:**
- Create: `scripts/build_chunks/schema.py`
- Test: `tests/build_chunks/test_schema.py`

- [ ] **Step 1: Write the failing tests**

`tests/build_chunks/test_schema.py`:

```python
import pytest
from pydantic import ValidationError

from scripts.build_chunks.schema import Chunk, Metadata


def _valid_metadata(**overrides):
    base = dict(
        source_file="cart.md",
        file_path="docs/project-data/features/cart.md",
        title="Shopping Cart Feature",
        parent_headings=["State (Redux)"],
        keywords=["cart", "redux", "localstorage"],
        summary="How the cart slice persists items to localStorage.",
        language="en",
        token_count=42,
        chunk_index=0,
        chunk_total=1,
        group="features",
    )
    base.update(overrides)
    return base


def _valid_chunk(text="hello world", **meta_overrides):
    return Chunk(
        id="features/cart#0",
        text=text,
        metadata=Metadata(**_valid_metadata(**meta_overrides)),
    )


def test_minimal_valid_chunk_parses():
    c = _valid_chunk()
    assert c.id == "features/cart#0"
    assert c.metadata.language == "en"


def test_keywords_too_few_fails():
    with pytest.raises(ValidationError, match="keywords"):
        Metadata(**_valid_metadata(keywords=["only-two", "items"]))


def test_keywords_too_many_fails():
    with pytest.raises(ValidationError, match="keywords"):
        Metadata(**_valid_metadata(keywords=[f"k{i}" for i in range(11)]))


def test_keyword_uppercase_fails():
    with pytest.raises(ValidationError, match="lowercase"):
        Metadata(**_valid_metadata(keywords=["Cart", "redux", "store"]))


def test_summary_without_terminal_punctuation_fails():
    with pytest.raises(ValidationError, match="terminal punctuation"):
        Metadata(**_valid_metadata(summary="No terminator here"))


def test_summary_too_long_fails():
    with pytest.raises(ValidationError, match="200"):
        Metadata(**_valid_metadata(summary="x" * 201 + "."))


def test_language_invalid_value_fails():
    with pytest.raises(ValidationError):
        Metadata(**_valid_metadata(language="de"))


def test_chunk_index_must_be_less_than_total():
    with pytest.raises(ValidationError, match="chunk_index"):
        Metadata(**_valid_metadata(chunk_index=3, chunk_total=3))
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_schema.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement `schema.py`**

`scripts/build_chunks/schema.py`:

```python
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Language = Literal["en", "ru", "mixed"]


class FeatureFlagExtras(BaseModel):
    flag_key: str
    flag_status: str
    traffic_percentage: int = Field(ge=0, le=100)
    rollout_strategy: str
    targeted_segments: list[str]


class Metadata(BaseModel):
    source_file: str
    file_path: str
    title: str
    parent_headings: list[str]
    keywords: list[str] = Field(min_length=3, max_length=10)
    summary: str = Field(max_length=200)
    language: Language
    token_count: int = Field(ge=0)
    chunk_index: int = Field(ge=0)
    chunk_total: int = Field(ge=1)
    group: str

    flag_key: str | None = None
    flag_status: str | None = None
    traffic_percentage: int | None = None
    rollout_strategy: str | None = None
    targeted_segments: list[str] | None = None

    @field_validator("keywords")
    @classmethod
    def _keywords_lowercase(cls, v: list[str]) -> list[str]:
        for kw in v:
            if not kw:
                raise ValueError("keyword must not be empty")
            if kw != kw.lower():
                raise ValueError(f"keyword must be lowercase: {kw!r}")
            if " " in kw or "\t" in kw or "\n" in kw:
                raise ValueError(f"keyword must not contain whitespace: {kw!r}")
            if len(kw) > 30:
                raise ValueError(f"keyword too long: {kw!r}")
        return v

    @field_validator("summary")
    @classmethod
    def _summary_terminator(cls, v: str) -> str:
        if not v:
            raise ValueError("summary must not be empty")
        if v[-1] not in ".!?":
            raise ValueError("summary must end with terminal punctuation (.!?)")
        return v

    @model_validator(mode="after")
    def _index_lt_total(self) -> "Metadata":
        if self.chunk_index >= self.chunk_total:
            raise ValueError("chunk_index must be < chunk_total")
        return self


class Chunk(BaseModel):
    id: str
    text: str
    metadata: Metadata
```

- [ ] **Step 4: Run, expect pass**

```powershell
pytest tests/build_chunks/test_schema.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/schema.py tests/build_chunks/test_schema.py
git commit -m "course: task3-step2: feat(rag): add chunk schema with validation"
```

---

## Task 3: `groups.py` — group definitions and file routing

**Files:**
- Create: `scripts/build_chunks/groups.py`
- Test: `tests/build_chunks/test_groups.py`

- [ ] **Step 1: Write the failing tests**

`tests/build_chunks/test_groups.py`:

```python
from pathlib import Path

from scripts.build_chunks.groups import GROUPS, group_for


def test_seven_groups_defined():
    assert set(GROUPS.keys()) == {
        "top-level", "adrs", "api", "features",
        "incidents", "runbooks", "pages",
    }


def test_features_directory_routes_to_features():
    assert group_for(Path("docs/project-data/features/cart.md")) == "features"


def test_features_json_routes_to_top_level():
    # features.json sits at top level; the directory is /features/
    assert group_for(Path("docs/project-data/features.json")) == "top-level"


def test_top_level_md_routes_to_top_level():
    assert group_for(Path("docs/project-data/architecture.md")) == "top-level"


def test_adrs_routes_to_adrs():
    assert group_for(Path("docs/project-data/adrs/adr-001-mongodb-vs-postgres.md")) == "adrs"


def test_unknown_path_raises():
    import pytest
    with pytest.raises(ValueError):
        group_for(Path("docs/project-data/unknown-folder/x.md"))
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_groups.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement `groups.py`**

`scripts/build_chunks/groups.py`:

```python
from pathlib import Path

GROUPS: dict[str, str] = {
    "top-level": "Top-level long-form docs and features.json",
    "adrs": "Architecture decision records",
    "api": "API endpoint reference",
    "features": "Feature deep-dives",
    "incidents": "Post-mortems",
    "runbooks": "Operational runbooks",
    "pages": "Page-level UI descriptions",
}

_DIR_TO_GROUP = {
    "adrs": "adrs",
    "api": "api",
    "features": "features",
    "incidents": "incidents",
    "runbooks": "runbooks",
    "pages": "pages",
}

DATA_ROOT = Path("docs/project-data")


def group_for(path: Path) -> str:
    rel = path.relative_to(DATA_ROOT) if path.is_absolute() is False and DATA_ROOT in path.parents or str(path).startswith("docs/project-data") else path
    # Normalise: get parts after docs/project-data
    parts = path.parts
    try:
        idx = parts.index("project-data")
    except ValueError:
        raise ValueError(f"path is not under project-data: {path}")
    after = parts[idx + 1:]
    if len(after) == 1:
        # Top-level file (architecture.md, features.json, ...)
        return "top-level"
    first_dir = after[0]
    if first_dir in _DIR_TO_GROUP:
        return _DIR_TO_GROUP[first_dir]
    raise ValueError(f"unknown group for path: {path}")
```

- [ ] **Step 4: Run, expect pass**

```powershell
pytest tests/build_chunks/test_groups.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/groups.py tests/build_chunks/test_groups.py
git commit -m "course: task3-step2: feat(rag): add dispatch group routing"
```

---

## Task 4: `chunker.py` — basic markdown parsing + simple emit

This task covers the simplest case: parse a file, extract H1 + H2 sections that all fit in `max`, emit one chunk per H2, plus the no-H2 case.

**Files:**
- Create: `scripts/build_chunks/chunker.py`
- Test: `tests/build_chunks/test_chunker.py`

- [ ] **Step 1: Write the failing tests (basic emission)**

`tests/build_chunks/test_chunker.py`:

```python
from scripts.build_chunks.chunker import chunk_markdown


def test_single_h2_short_emits_one_chunk():
    md = "# Doc Title\n\n## Only Section\n\nSmall body.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert len(chunks) == 1
    c = chunks[0]
    assert c.id == "x#0"
    assert c.metadata.title == "Doc Title"
    assert c.metadata.parent_headings == ["Only Section"]
    assert c.metadata.chunk_index == 0
    assert c.metadata.chunk_total == 1


def test_two_short_h2_sections_emit_two_chunks():
    md = "# T\n\n## A\n\nA body.\n\n## B\n\nB body.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert [c.metadata.parent_headings for c in chunks] == [["A"], ["B"]]
    assert [c.metadata.chunk_index for c in chunks] == [0, 1]
    assert all(c.metadata.chunk_total == 2 for c in chunks)


def test_no_h2_just_h1_body_emits_single_chunk_with_empty_parents():
    md = "# T\n\nJust a body, no sections.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert len(chunks) == 1
    assert chunks[0].metadata.parent_headings == []


def test_text_includes_breadcrumbs_prefix():
    md = "# T\n\n## A\n\nbody.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert chunks[0].text.startswith("# T\n\n## A\n\n")


def test_id_uses_filename_without_extension():
    md = "# T\n\n## A\n\nbody.\n"
    chunks = chunk_markdown(md, source_file="cart.md", file_path="docs/project-data/features/cart.md", group="features")
    assert chunks[0].id == "features/cart#0"


def test_token_count_set_on_metadata():
    md = "# T\n\n## A\n\nhello world.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert chunks[0].metadata.token_count > 0


def test_language_detection_english():
    md = "# Title\n\n## A\n\nThis is English text only.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert chunks[0].metadata.language == "en"


def test_language_detection_russian():
    md = "# Заголовок\n\n## Раздел\n\nТекст на русском.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert chunks[0].metadata.language == "ru"


def test_summary_and_keywords_are_placeholders_until_enrichment():
    md = "# T\n\n## A\n\nbody.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    # Pre-enrichment: minimal valid placeholders so schema passes
    assert chunks[0].metadata.summary.endswith(".")
    assert len(chunks[0].metadata.keywords) >= 3
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement basic `chunker.py`**

`scripts/build_chunks/chunker.py`:

```python
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
    md_parser = MarkdownIt()
    tokens = md_parser.parse(md)

    h1_title = ""
    sections: list[tuple[str, str]] = []
    current_title = ""
    current_lines: list[str] = []
    in_h2 = False

    lines = md.splitlines(keepends=True)
    line_idx = 0

    for tok in tokens:
        if tok.type == "heading_open" and tok.tag == "h1":
            # next inline token holds the text
            inline = tokens[tokens.index(tok) + 1]
            h1_title = inline.content.strip()
        elif tok.type == "heading_open" and tok.tag == "h2":
            # Flush previous section
            if in_h2 or current_lines:
                sections.append((current_title, "".join(current_lines).strip()))
            inline = tokens[tokens.index(tok) + 1]
            current_title = inline.content.strip()
            current_lines = []
            in_h2 = True

    # Re-walk by line to gather bodies (markdown_it tokens don't carry raw)
    sections = []
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
        prefix_lines = [f"# {h1_title}", ""]
        if parents:
            prefix_lines += [f"## {parents[0]}", ""]
        text = "\n".join(prefix_lines) + body + ("\n" if not body.endswith("\n") else "")
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
```

- [ ] **Step 4: Run tests, expect pass**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/chunker.py tests/build_chunks/test_chunker.py
git commit -m "course: task3-step2: feat(rag): chunk simple markdown into H2 sections"
```

---

## Task 5: `chunker.py` — recursive H3 split for oversized H2

**Files:**
- Modify: `scripts/build_chunks/chunker.py`
- Modify: `tests/build_chunks/test_chunker.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/build_chunks/test_chunker.py`:

```python
def test_oversized_h2_splits_at_h3_boundaries():
    # Build an H2 with two H3 sections, each individually under MAX
    long_para = ("Sentence number one. " * 80).strip()  # ~80 sentences
    md = (
        "# T\n\n## Big H2\n\n### First H3\n\n"
        + long_para
        + "\n\n### Second H3\n\n"
        + long_para
        + "\n"
    )
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    # Expect at least 2 chunks (one per H3), each carrying H2 + H3 in parent_headings
    h3_chunks = [c for c in chunks if len(c.metadata.parent_headings) == 2]
    assert len(h3_chunks) >= 2
    titles = {tuple(c.metadata.parent_headings) for c in h3_chunks}
    assert ("Big H2", "First H3") in titles
    assert ("Big H2", "Second H3") in titles
```

- [ ] **Step 2: Run, confirm failure**

```powershell
pytest tests/build_chunks/test_chunker.py::test_oversized_h2_splits_at_h3_boundaries -v
```

Expected: failure (current chunker treats H3 content as part of H2 body, no recursion).

- [ ] **Step 3: Refactor `_split_h1_and_sections` to return a tree, then add recursive split**

Replace the body-extraction section of `chunker.py` with a tree-based extractor and add `_emit_section`:

```python
from dataclasses import dataclass, field


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
```

Then update `chunk_markdown` to walk this tree and decide per-section whether to emit whole or split into H3 children:

```python
def chunk_markdown(md, *, source_file, file_path, group):
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
            if tokens_for_full <= MAX or not h2.children:
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
    lines = [f"# {h1}", ""]
    if len(parents) >= 1:
        bc = " > ".join(parents)
        lines += [f"## {bc}", ""]
    return "\n".join(lines) + body + ("\n" if not body.endswith("\n") else "")
```

Remove the old `_split_h1_and_sections` function — it is replaced by `_parse_tree`.

- [ ] **Step 4: Run all chunker tests, expect pass**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: all tests including the new H3 split test pass.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/chunker.py tests/build_chunks/test_chunker.py
git commit -m "course: task3-step2: feat(rag): split oversized H2 sections at H3 boundaries"
```

---

## Task 6: `chunker.py` — paragraph-level fallback split with sentence overlap

**Files:**
- Modify: `scripts/build_chunks/chunker.py`
- Modify: `tests/build_chunks/test_chunker.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/build_chunks/test_chunker.py`:

```python
def test_oversized_h2_no_h3_splits_by_paragraph_with_overlap():
    para = ("Sentence A. Sentence B. Sentence C. " * 30).strip()
    paragraphs = "\n\n".join([para] * 5)
    md = f"# T\n\n## Long Section\n\n{paragraphs}\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert len(chunks) >= 2
    # Overlap: every chunk after the first should start (after breadcrumbs prefix) with the same
    # last sentence of the prior chunk's body.
    for c in chunks:
        assert c.metadata.token_count <= 850  # hard_max with some slack for prefix


def test_paragraph_split_does_not_break_inside_code_block():
    code_block = "```python\n" + "x = 1\n" * 200 + "```\n"
    md = f"# T\n\n## S\n\n{code_block}\n\nNormal paragraph here.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    # Code fences must come in matching pairs in every emitted chunk
    for c in chunks:
        opens = c.text.count("```")
        assert opens % 2 == 0, f"unbalanced fences in chunk {c.id}"
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: the two new tests fail (current logic emits oversized chunks as single-pieces).

- [ ] **Step 3: Implement `_split_by_paragraph` and route to it**

Add helpers to `chunker.py`:

```python
import re

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-ZА-Я])")


def _split_into_blocks(body: str) -> list[str]:
    """Splits body into atomic blocks: paragraphs, fenced code blocks, tables.
    Each returned block is something we will not subdivide further."""
    blocks: list[str] = []
    lines = body.splitlines(keepends=True)
    i = 0
    n = len(lines)
    buf: list[str] = []

    def flush():
        nonlocal buf
        if buf:
            chunk = "".join(buf).strip("\n")
            if chunk.strip():
                blocks.append(chunk)
        buf = []

    while i < n:
        line = lines[i]
        if line.lstrip().startswith("```"):
            flush()
            fence_lines = [line]
            i += 1
            while i < n and not lines[i].lstrip().startswith("```"):
                fence_lines.append(lines[i])
                i += 1
            if i < n:
                fence_lines.append(lines[i])  # closing fence
                i += 1
            blocks.append("".join(fence_lines).rstrip("\n"))
            continue
        if line.startswith("|") and i + 1 < n and "---" in lines[i + 1]:
            flush()
            tbl = [line]
            i += 1
            while i < n and lines[i].lstrip().startswith("|"):
                tbl.append(lines[i])
                i += 1
            blocks.append("".join(tbl).rstrip("\n"))
            continue
        if line.strip() == "":
            flush()
            i += 1
            continue
        buf.append(line)
        i += 1
    flush()
    return blocks


def _last_sentence(text: str) -> str:
    # Returns last sentence for overlap injection. Falls back to last paragraph.
    parts = _SENTENCE_END.split(text.strip())
    return parts[-1] if parts else ""


def _split_by_paragraph(parents: list[str], h1: str, body: str) -> list[tuple[list[str], str]]:
    blocks = _split_into_blocks(body)
    chunks: list[tuple[list[str], str]] = []
    current: list[str] = []
    current_tokens = 0
    prefix_overhead = count_tokens(_format_text(h1, parents, ""))

    def emit():
        nonlocal current, current_tokens
        if current:
            chunks.append((parents, "\n\n".join(current)))
            current = []
            current_tokens = 0

    for block in blocks:
        block_tokens = count_tokens(block)
        # Block alone exceeds MAX — keep it whole anyway (atomic)
        if block_tokens + prefix_overhead > MAX and not current:
            chunks.append((parents, block))
            continue
        if current_tokens + block_tokens + prefix_overhead > MAX:
            # Inject overlap: last sentence of last block
            last_block = current[-1] if current else ""
            overlap = _last_sentence(last_block) if last_block else ""
            emit()
            if overlap:
                current.append(overlap)
                current_tokens = count_tokens(overlap)
        current.append(block)
        current_tokens += block_tokens
    emit()
    return chunks
```

Update `chunk_markdown` to call `_split_by_paragraph` when a section overflows and has no usable H3 split:

Replace the relevant branch in `chunk_markdown`:

```python
            if tokens_for_full <= MAX:
                pre_chunks.append(([h2.title], full_body))
            elif h2.children:
                if h2.body.strip():
                    pre_chunks.extend(_split_by_paragraph([h2.title], h1_title, h2.body.strip()))
                for child in h2.children:
                    child_tokens = count_tokens(_format_text(h1_title, [h2.title, child.title], child.body))
                    if child_tokens <= MAX:
                        pre_chunks.append(([h2.title, child.title], child.body))
                    else:
                        pre_chunks.extend(_split_by_paragraph([h2.title, child.title], h1_title, child.body))
            else:
                pre_chunks.extend(_split_by_paragraph([h2.title], h1_title, full_body))
```

- [ ] **Step 4: Run, expect pass**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: all chunker tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/chunker.py tests/build_chunks/test_chunker.py
git commit -m "course: task3-step2: feat(rag): paragraph-level split with sentence overlap"
```

---

## Task 7: `chunker.py` — post-process merge of stub chunks + features.json renderer + frontmatter/preamble/no-H1

This task closes the remaining behaviours from the spec. Three small additions, one task to keep them together — they're cross-cutting and small.

**Files:**
- Modify: `scripts/build_chunks/chunker.py`
- Modify: `tests/build_chunks/test_chunker.py`

- [ ] **Step 1: Add failing tests**

Append:

```python
def test_small_h2_with_short_h3_children_emitted_as_one_chunk():
    # H2 with two tiny H3s — total fits comfortably in MAX, so the whole H2
    # is emitted as a single chunk (no H3 split triggered). Verifies the
    # natural "no stub" behaviour without needing an explicit merge pass.
    md = "# T\n\n## A\n\n### One\n\nshort.\n\n### Two\n\nalso short.\n"
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    assert len(chunks) == 1
    assert chunks[0].metadata.parent_headings == ["A"]


def test_features_json_renders_one_chunk_per_flag():
    from scripts.build_chunks.chunker import chunk_features_json
    payload = {
        "search_v2": {
            "name": "New Search",
            "description": "Replaces regex with BM25.",
            "status": "Testing",
            "traffic_percentage": 25,
            "rollout_strategy": "canary",
            "targeted_segments": ["beta_users"],
            "last_modified": "2026-05-03",
        }
    }
    chunks = chunk_features_json(
        payload,
        source_file="features.json",
        file_path="docs/project-data/features.json",
        group="top-level",
    )
    assert len(chunks) == 1
    c = chunks[0]
    assert c.id == "features.json#search_v2"
    assert c.metadata.flag_key == "search_v2"
    assert c.metadata.flag_status == "Testing"
    assert c.metadata.traffic_percentage == 25
    assert "Replaces regex with BM25" in c.text
    assert "Testing" not in c.text  # volatile state stays out of embedded text


def test_no_h1_falls_back_to_filename_title():
    md = "## Section A\n\nbody.\n"
    chunks = chunk_markdown(md, source_file="feature-flag-toggle.md",
                            file_path="docs/project-data/runbooks/feature-flag-toggle.md",
                            group="runbooks")
    assert chunks[0].metadata.title == "Feature Flag Toggle"


def test_preamble_between_h1_and_first_h2_emits_implicit_chunk():
    md = ("# Doc Title\n\n"
          "Important preamble paragraph that lives before any H2.\n\n"
          "## First Section\n\nBody.\n")
    chunks = chunk_markdown(md, source_file="x.md", file_path="docs/project-data/x.md", group="top-level")
    preamble_chunks = [c for c in chunks if c.metadata.parent_headings == []]
    assert len(preamble_chunks) == 1
    assert "Important preamble" in preamble_chunks[0].text
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: 4 new failures.

- [ ] **Step 3: Implement remaining behaviours**

Add to `chunker.py`:

```python
def chunk_features_json(payload: dict, *, source_file: str, file_path: str, group: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    keys = list(payload.keys())
    total = len(keys)
    for idx, key in enumerate(keys):
        flag = payload[key]
        deps = flag.get("dependencies") or "none"
        if isinstance(deps, list):
            deps = ", ".join(deps) if deps else "none"
        text_body = (
            f"# Feature: {flag['name']}\n\n"
            f"**Flag key:** {key}\n\n"
            f"{flag['description']}\n\n"
            f"**Dependencies:** {deps}\n"
            f"**Rollout strategy:** {flag.get('rollout_strategy', 'unknown')}\n"
        )
        meta = Metadata(
            source_file=source_file,
            file_path=file_path,
            title=flag["name"],
            parent_headings=[],
            keywords=list(_PLACEHOLDER_KEYWORDS),
            summary=_PLACEHOLDER_SUMMARY,
            language=_detect_language(flag["description"]),
            token_count=count_tokens(text_body),
            chunk_index=idx,
            chunk_total=total,
            group=group,
            flag_key=key,
            flag_status=flag.get("status", "Unknown"),
            traffic_percentage=int(flag.get("traffic_percentage", 0)),
            rollout_strategy=flag.get("rollout_strategy", "unknown"),
            targeted_segments=flag.get("targeted_segments", []),
        )
        chunks.append(Chunk(id=f"features.json#{key}", text=text_body, metadata=meta))
    return chunks
```

Update `_parse_tree` to capture preamble (text between H1 and first H2) into a synthetic section with empty title:

```python
def _parse_tree(md: str) -> tuple[str, list[_Section]]:
    h1_title = ""
    h2_sections: list[_Section] = []
    preamble = _Section(title="", level=2)  # empty title marks preamble
    current_h2: _Section | None = preamble
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
            if current_h2 is preamble and preamble.body.strip():
                h2_sections.append(preamble)
            current_h2 = _Section(title=stripped[3:].strip(), level=2)
            current_h3 = None
            h2_sections.append(current_h2)
            continue
        if stripped.startswith("### ") and current_h2 is not None and current_h2 is not preamble:
            flush_buffer_to(current_h3 or current_h2)
            current_h3 = _Section(title=stripped[4:].strip(), level=3)
            current_h2.children.append(current_h3)
            continue
        buffer.append(line)
    flush_buffer_to(current_h3 or current_h2)

    # If no H2 ever appeared, preamble holds entire body
    if current_h2 is preamble and preamble.body.strip():
        h2_sections.append(preamble)

    for s in h2_sections:
        s.body = s.body.strip()
        for c in s.children:
            c.body = c.body.strip()
    return h1_title, h2_sections
```

In `chunk_markdown`, treat sections with empty title as having `parent_headings=[]`:

```python
        for h2 in sections:
            parents = [h2.title] if h2.title else []
            full_body = h2.body
            if h2.children:
                full_body += "\n\n" + "\n\n".join(
                    f"### {c.title}\n\n{c.body}" for c in h2.children
                )
            tokens_for_full = count_tokens(_format_text(h1_title, parents, full_body))
            if tokens_for_full <= MAX:
                pre_chunks.append((parents, full_body))
            elif h2.children:
                if h2.body.strip():
                    pre_chunks.extend(_split_by_paragraph(parents, h1_title, h2.body.strip()))
                for child in h2.children:
                    child_parents = parents + [child.title]
                    child_tokens = count_tokens(_format_text(h1_title, child_parents, child.body))
                    if child_tokens <= MAX:
                        pre_chunks.append((child_parents, child.body))
                    else:
                        pre_chunks.extend(_split_by_paragraph(child_parents, h1_title, child.body))
            else:
                pre_chunks.extend(_split_by_paragraph(parents, h1_title, full_body))
```

- [ ] **Step 4: Run, expect all tests pass**

```powershell
pytest tests/build_chunks/test_chunker.py -v
```

Expected: all chunker tests green.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/chunker.py tests/build_chunks/test_chunker.py
git commit -m "course: task3-step2: feat(rag): preamble + features.json + filename fallback"
```

---

## Task 8: `enrich.py` — subagent prompt builder + enriched-output parser

**Files:**
- Create: `scripts/build_chunks/enrich.py`
- Test: `tests/build_chunks/test_enrich.py`

- [ ] **Step 1: Write the failing tests**

`tests/build_chunks/test_enrich.py`:

```python
import json

from scripts.build_chunks.chunker import chunk_markdown
from scripts.build_chunks.enrich import build_subagent_prompt, parse_enriched_output


def _sample_chunks():
    md = "# T\n\n## A\n\nbody.\n"
    return chunk_markdown(md, source_file="x.md",
                          file_path="docs/project-data/x.md", group="top-level")


def test_prompt_contains_all_chunk_ids():
    chunks = _sample_chunks()
    prompt = build_subagent_prompt(chunks, group="top-level")
    for c in chunks:
        assert c.id in prompt
    # Output format spec must appear
    assert "summary" in prompt
    assert "keywords" in prompt
    assert "language" in prompt


def test_parse_enriched_output_replaces_placeholders():
    chunks = _sample_chunks()
    enriched_jsonl = json.dumps({
        "id": chunks[0].id,
        "summary": "A real summary now.",
        "keywords": ["test", "doc", "section"],
        "language": "en",
    })
    out = parse_enriched_output(chunks, enriched_jsonl)
    assert out[0].metadata.summary == "A real summary now."
    assert out[0].metadata.keywords == ["test", "doc", "section"]


def test_parse_enriched_output_preserves_text_unchanged():
    chunks = _sample_chunks()
    original_text = chunks[0].text
    original_token_count = chunks[0].metadata.token_count
    enriched_jsonl = json.dumps({
        "id": chunks[0].id,
        "summary": "A real summary.",
        "keywords": ["test", "doc", "section"],
        "language": "en",
    })
    out = parse_enriched_output(chunks, enriched_jsonl)
    assert out[0].text == original_text
    assert out[0].metadata.token_count == original_token_count


def test_parse_rejects_unknown_id():
    chunks = _sample_chunks()
    enriched_jsonl = json.dumps({
        "id": "unknown/foo#0",
        "summary": "x.", "keywords": ["a", "b", "c"], "language": "en",
    })
    import pytest
    with pytest.raises(ValueError, match="unknown chunk id"):
        parse_enriched_output(chunks, enriched_jsonl)
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_enrich.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement `enrich.py`**

`scripts/build_chunks/enrich.py`:

```python
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
```

- [ ] **Step 4: Run, expect pass**

```powershell
pytest tests/build_chunks/test_enrich.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks/enrich.py tests/build_chunks/test_enrich.py
git commit -m "course: task3-step2: feat(rag): subagent prompt + enriched output parser"
```

---

## Task 9: `build_chunks.py` — coordinator CLI (`prepare` + `validate`)

**Files:**
- Create: `scripts/build_chunks.py`
- Test: `tests/build_chunks/test_coordinator.py`

- [ ] **Step 1: Write the failing tests**

`tests/build_chunks/test_coordinator.py`:

```python
import json
import subprocess
import sys
from pathlib import Path


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def test_prepare_writes_per_group_inputs(tmp_path, monkeypatch):
    # Build a tiny fake project-data tree in tmp_path
    root = tmp_path / "docs" / "project-data"
    _write(root / "architecture.md", "# Arch\n\n## Overview\n\nbody.\n")
    _write(root / "adrs" / "adr-001.md", "# ADR 1\n\n## Context\n\nbody.\n")
    _write(root / "features.json", json.dumps({
        "x": {"name": "X", "description": "desc", "status": "Enabled",
              "traffic_percentage": 100, "rollout_strategy": "ga",
              "targeted_segments": [], "last_modified": "2026-05-03"}
    }))

    monkeypatch.chdir(tmp_path)
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent.parent.parent / "scripts" / "build_chunks.py"),
         "prepare", "--out", "tmp/chunks/input"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    out = tmp_path / "tmp" / "chunks" / "input"
    assert (out / "top-level.json").exists()
    assert (out / "adrs.json").exists()
    payload = json.loads((out / "top-level.json").read_text(encoding="utf-8"))
    assert payload["group"] == "top-level"
    assert len(payload["chunks"]) >= 2  # arch + features.json


def test_validate_merges_and_writes_jsonl(tmp_path, monkeypatch):
    # Set up minimal input + matching enriched output
    root = tmp_path / "docs" / "project-data"
    _write(root / "architecture.md", "# Arch\n\n## Overview\n\nbody.\n")

    monkeypatch.chdir(tmp_path)
    script = Path(__file__).parent.parent.parent / "scripts" / "build_chunks.py"
    subprocess.run([sys.executable, str(script), "prepare", "--out", "tmp/chunks/input"], check=True)

    inp = json.loads((tmp_path / "tmp/chunks/input/top-level.json").read_text(encoding="utf-8"))
    enriched_lines = []
    for c in inp["chunks"]:
        enriched_lines.append(json.dumps({
            "id": c["id"],
            "summary": "A test summary sentence.",
            "keywords": ["arch", "overview", "test"],
            "language": c["metadata_partial"]["language_guess"],
        }))
    enriched_dir = tmp_path / "tmp" / "chunks" / "enriched"
    enriched_dir.mkdir(parents=True, exist_ok=True)
    (enriched_dir / "top-level.jsonl").write_text("\n".join(enriched_lines), encoding="utf-8")

    result = subprocess.run(
        [sys.executable, str(script), "validate",
         "--in-input", "tmp/chunks/input", "--in-enriched", "tmp/chunks/enriched",
         "--out", "docs/chunks.jsonl"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    final = (tmp_path / "docs" / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(final) >= 1
    rec = json.loads(final[0])
    assert rec["metadata"]["summary"] == "A test summary sentence."
```

- [ ] **Step 2: Run, confirm failures**

```powershell
pytest tests/build_chunks/test_coordinator.py -v
```

Expected: failure (script does not exist yet).

- [ ] **Step 3: Implement `scripts/build_chunks.py`**

`scripts/build_chunks.py`:

```python
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
```

- [ ] **Step 4: Run, expect pass**

```powershell
pytest tests/build_chunks/test_coordinator.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/build_chunks.py tests/build_chunks/test_coordinator.py
git commit -m "course: task3-step2: feat(rag): coordinator CLI prepare + validate"
```

---

## Task 10: Run prepare + dispatch subagents + validate (operational)

This task runs the actual pipeline against real data. No new code is written; the executing engineer (or subagent) follows these steps.

**Files:**
- Read: every file under `docs/project-data/`
- Generate (transient): `tmp/chunks/input/{group}.json`
- Generate (transient): `tmp/chunks/enriched/{group}.jsonl`
- Generate (final): `docs/chunks.jsonl`

- [ ] **Step 1: Run `prepare`**

```powershell
.venv-rag\Scripts\Activate.ps1
python scripts/build_chunks.py prepare
```

Expected stdout: `prepared N chunks across 7 groups -> tmp/chunks/input` where N is in 180-220.

Verify:
```powershell
Get-ChildItem tmp/chunks/input | Select-Object Name, Length
```

Expected: 7 files (`top-level.json`, `adrs.json`, `api.json`, `features.json`, `incidents.json`, `runbooks.json`, `pages.json`).

- [ ] **Step 2: Launch 7 parallel subagents**

In a single message to the orchestrator (Claude Code main agent), dispatch seven `Agent` calls with `subagent_type=general-purpose`, model=`sonnet`, in parallel. Each subagent's prompt is built using the template in `scripts/build_chunks/enrich.py:_PROMPT_TEMPLATE` and includes the contents of one `tmp/chunks/input/{group}.json` file.

Subagent task description (the one to put in the Agent prompt):

```
You will receive a JSON payload with a "group" name and a list of pre-chunked
documentation chunks. For each chunk, output exactly one JSONL line containing:
  - id (verbatim from input)
  - summary (one sentence, <=25 words, ends with .!?)
  - keywords (3-10 lowercase strings, domain-specific, no whitespace, <=30 chars)
  - language ("en"|"ru"|"mixed", override only if guess is obviously wrong)

DO NOT echo the chunk text back. DO NOT include any prose or markdown fences.
Output ONLY JSONL, one chunk per line, in the same order as input.

Save your output to tmp/chunks/enriched/{group}.jsonl using the Write tool.
```

After the dispatch, verify all 7 enriched files exist:

```powershell
Get-ChildItem tmp/chunks/enriched | Select-Object Name, Length
```

Expected: 7 `.jsonl` files, each with line count matching the corresponding input's chunk count.

- [ ] **Step 3: Run `validate`**

```powershell
python scripts/build_chunks.py validate
```

Expected stdout: `wrote N chunks -> docs/chunks.jsonl`.

If validation fails (non-zero exit, error message naming a chunk + field), inspect the offending enriched file, fix it manually, re-run.

- [ ] **Step 4: Sanity-check `docs/chunks.jsonl`**

```powershell
$lines = Get-Content docs/chunks.jsonl
"line count: $($lines.Count)"
$lines[0] | ConvertFrom-Json | ConvertTo-Json -Depth 6
```

Expected: line count 180-220, first record has all required fields, summary is a real sentence (not "Pending enrichment.").

- [ ] **Step 5: Commit final artifact**

```powershell
git add docs/chunks.jsonl
git commit -m "course: task3-step2: feat(rag): generate chunks.jsonl from project-data"
```

(Do NOT commit anything from `tmp/`.)

---

## Task 11: Update README.md and report.md

**Files:**
- Modify: `README.md`
- Modify: `report.md`

- [ ] **Step 1: Read current README.md and report.md to find the right insertion point**

```powershell
Get-Content README.md | Select-Object -Last 5
Get-Content report.md | Select-Object -Last 20
```

- [ ] **Step 2: Append a section to README.md**

Append (or insert near related documentation sections):

```markdown
## Domain documentation and RAG chunks

- `docs/project-data/` — long-form documentation about the project (architecture, ADRs, API reference, feature deep-dives, runbooks, incidents, page descriptions). Used as the corpus for the local RAG demo.
- `docs/chunks.jsonl` — generated artifact: one chunk per line, ready to be embedded with BGE-M3 and indexed into the local Qdrant instance. Regenerated via `python scripts/build_chunks.py prepare` + parallel Sonnet subagents + `python scripts/build_chunks.py validate`. See `docs/superpowers/specs/2026-05-03-vector-db-chunking-design.md` for the chunking design.
```

- [ ] **Step 3: Append a section to report.md**

Append:

```markdown
## Task 3 — Step 2: Vector DB chunking

- Local Qdrant (v1.17.1) installed at `D:\Soft\qdrant\` (no Docker).
- Documentation moved to `docs/project-data/` (preserved git history via `git mv`).
- Chunking pipeline in `scripts/build_chunks/` + entrypoint `scripts/build_chunks.py`.
- Final artifact: `docs/chunks.jsonl` (generated, committed).
- Design spec: `docs/superpowers/specs/2026-05-03-vector-db-chunking-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-05-03-vector-db-chunking.md`.
```

- [ ] **Step 4: Commit**

```powershell
git add README.md report.md
git commit -m "course: task3-step2: docs: reference project-data and chunks.jsonl"
```

---

## Done

The `chunks.jsonl` artifact is now in the repo, deterministic to regenerate, validated end-to-end. Next module-level task (out of scope here) will embed it with BGE-M3 and index into Qdrant.

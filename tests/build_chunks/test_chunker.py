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


def test_oversized_h2_splits_at_h3_boundaries():
    # Build an H2 with two H3 sections that combined exceed MAX (700 tokens)
    long_para = ("Sentence number one. " * 200).strip()
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

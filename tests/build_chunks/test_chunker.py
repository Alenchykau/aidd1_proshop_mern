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

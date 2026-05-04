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

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

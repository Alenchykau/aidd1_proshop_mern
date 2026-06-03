"""Tests for scripts/rag_query.py (M6 Stage 4 — hybrid RAG retrieval).

Network is mocked out: ollama.Client / QdrantClient are constructed lazily in
HybridRetriever.__init__ but never contacted in these tests. The dense path is
exercised via monkeypatching `_dense_ranks`; the BM25 path runs fully offline
on a small in-tree corpus.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.rag_query import (
    HybridRetriever,
    PREFETCH_LIMIT,
    RRF_K,
    _build_filter,
    _tokenize,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _chunk(cid, title, summary, keywords, text,
           group="features", source_file="cart.md", language="en"):
    return {
        "id": cid,
        "text": text,
        "metadata": {
            "title": title,
            "summary": summary,
            "keywords": keywords,
            "group": group,
            "source_file": source_file,
            "language": language,
        },
    }


@pytest.fixture
def corpus():
    """A small realistic corpus mirroring proshop docs: cart, paypal, mongo, runbook."""
    return [
        _chunk(
            cid="features/cart#0",
            title="Cart Feature",
            summary="Shopping cart stored in localStorage, persisted across reloads.",
            keywords=["cart", "localStorage", "checkout", "redux"],
            text=(
                "The cart is a Redux slice persisted to localStorage. "
                "Items survive reload but are wiped by data:destroy."
            ),
            group="features",
            source_file="cart.md",
        ),
        _chunk(
            cid="features/paypal#0",
            title="PayPal Integration",
            summary="PayPal client id fetched at runtime from /api/config/paypal.",
            keywords=["paypal", "payment", "checkout", "client-id"],
            text=(
                "The PayPal client id is not a REACT_APP_* var. "
                "The frontend fetches it at runtime from /api/config/paypal."
            ),
            group="features",
            source_file="paypal.md",
        ),
        _chunk(
            cid="adrs/mongo#0",
            title="MongoDB Connection Strategy",
            summary="Single Mongoose connection at startup; no extra clients.",
            keywords=["mongodb", "mongoose", "connection", "startup"],
            text=(
                "MongoDB connection is established once at startup by config/db.js. "
                "Mongoose 5.10 requires useCreateIndex and useNewUrlParser."
            ),
            group="adrs",
            source_file="mongo.md",
        ),
        _chunk(
            cid="runbooks/seeding#0",
            title="Database Seeding Runbook",
            summary="Use data:import and data:destroy to seed or wipe MongoDB.",
            keywords=["seed", "mongodb", "runbook", "destroy"],
            text=(
                "Run npm run data:import to populate the database. "
                "Run npm run data:destroy to wipe it. localStorage is not cleared."
            ),
            group="runbooks",
            source_file="seeding.md",
        ),
        _chunk(
            cid="features/search#0",
            title="Product Search",
            summary="Keyword search across product titles and descriptions.",
            keywords=["search", "products", "query"],
            text="Product search uses a simple regex match over title and description.",
            group="features",
            source_file="search.md",
        ),
    ]


@pytest.fixture
def chunks_file(tmp_path: Path, corpus):
    p = tmp_path / "chunks.jsonl"
    p.write_text(
        "\n".join(json.dumps(c, ensure_ascii=False) for c in corpus) + "\n",
        encoding="utf-8",
    )
    return p


@pytest.fixture
def retriever(chunks_file):
    return HybridRetriever(
        chunks_path=chunks_file,
        qdrant_url="http://localhost:6333",
        ollama_host="http://localhost:11434",
        collection="test_collection",
    )


# ---------------------------------------------------------------------------
# _tokenize
# ---------------------------------------------------------------------------


def test_tokenize_lowercases_and_splits_on_punctuation():
    assert _tokenize("Hello, World! Cart-Items.") == ["hello", "world", "cart", "items"]


def test_tokenize_drops_tokens_of_length_one_or_less():
    # "a", "I", single digits and standalone punctuation all disappear.
    assert _tokenize("a I am 1 the cart") == ["am", "the", "cart"]


def test_tokenize_unicode_preserves_cyrillic_words():
    # \w+ with re.UNICODE matches Cyrillic word chars; lowercased.
    # The 1-char "и" must be dropped by the len>1 filter.
    assert _tokenize("Корзина и MongoDB") == ["корзина", "mongodb"]


def test_tokenize_empty_string_returns_empty_list():
    assert _tokenize("") == []


def test_tokenize_only_short_tokens_returns_empty_list():
    # All-1-char query — used by _bm25_ranks edge case (#3 / #10 in spec).
    assert _tokenize("a I x ! ?") == []


# ---------------------------------------------------------------------------
# _build_filter
# ---------------------------------------------------------------------------


def test_build_filter_returns_none_when_both_args_none():
    assert _build_filter(None, None) is None


def test_build_filter_returns_none_for_empty_strings():
    # Empty strings are falsy — same path as None.
    assert _build_filter("", "") is None


def test_build_filter_with_only_group_has_one_condition():
    flt = _build_filter("features", None)
    assert flt is not None
    assert len(flt.must) == 1
    cond = flt.must[0]
    assert cond.key == "group"
    assert cond.match.value == "features"


def test_build_filter_with_group_and_source_file_has_two_conditions():
    flt = _build_filter("runbooks", "seeding.md")
    assert flt is not None
    assert len(flt.must) == 2
    keys = [c.key for c in flt.must]
    values = [c.match.value for c in flt.must]
    assert keys == ["group", "source_file"]
    assert values == ["runbooks", "seeding.md"]


# ---------------------------------------------------------------------------
# HybridRetriever._bm25_ranks
# ---------------------------------------------------------------------------


def test_bm25_ranks_returns_paypal_chunk_first_for_paypal_query(retriever):
    ranks = retriever._bm25_ranks("paypal client id config endpoint", lambda c: True)
    assert len(ranks) > 0
    top_id, top_score = ranks[0]
    assert top_id == "features/paypal#0"
    assert top_score > 0.0


def test_bm25_ranks_ranks_mongo_chunk_above_cart_for_mongo_query(retriever):
    ranks = retriever._bm25_ranks("mongodb connection mongoose startup", lambda c: True)
    ids_in_order = [cid for cid, _ in ranks]
    assert "adrs/mongo#0" in ids_in_order
    assert "features/cart#0" in ids_in_order
    assert ids_in_order.index("adrs/mongo#0") < ids_in_order.index("features/cart#0")


def test_bm25_ranks_empty_tokens_returns_empty_list(retriever):
    # All-1-char query — _tokenize drops everything → []
    assert retriever._bm25_ranks("a I x", lambda c: True) == []


def test_bm25_ranks_predicate_filters_out_non_matching_group(retriever):
    # Only let chunks in the "adrs" group survive; cart/paypal/runbooks/search drop.
    only_adrs = lambda c: c["metadata"].get("group") == "adrs"
    ranks = retriever._bm25_ranks("mongodb cart paypal seeding", only_adrs)
    returned_ids = {cid for cid, _ in ranks}
    assert returned_ids == {"adrs/mongo#0"}


def test_bm25_ranks_predicate_filters_by_source_file(retriever):
    only_cart_md = lambda c: c["metadata"].get("source_file") == "cart.md"
    ranks = retriever._bm25_ranks("cart checkout redux", only_cart_md)
    assert [cid for cid, _ in ranks] == ["features/cart#0"]


def test_bm25_ranks_caps_at_prefetch_limit(retriever):
    # Sanity: corpus is small, but the cap is honored.
    ranks = retriever._bm25_ranks("cart paypal mongodb search seeding", lambda c: True)
    assert len(ranks) <= PREFETCH_LIMIT


# ---------------------------------------------------------------------------
# HybridRetriever.search — bm25 mode (offline)
# ---------------------------------------------------------------------------


def test_search_bm25_mode_respects_top_k(retriever):
    hits = retriever.search(
        "cart paypal mongodb search seeding",
        top_k=2, mode="bm25", group=None, source_file=None,
    )
    assert len(hits) == 2


def test_search_bm25_mode_returns_expected_fields_with_real_values(retriever):
    hits = retriever.search(
        "paypal client id", top_k=1, mode="bm25", group=None, source_file=None,
    )
    assert len(hits) == 1
    hit = hits[0]
    assert hit["id"] == "features/paypal#0"
    assert hit["title"] == "PayPal Integration"
    assert hit["group"] == "features"
    assert hit["source_file"] == "paypal.md"
    assert hit["language"] == "en"
    assert hit["score"] > 0.0
    assert "PayPal client id" in hit["text"]
    assert hit["summary"].startswith("PayPal client id fetched")


def test_search_bm25_mode_with_group_filter_excludes_other_groups(retriever):
    hits = retriever.search(
        "mongodb seeding cart", top_k=5, mode="bm25",
        group="runbooks", source_file=None,
    )
    assert len(hits) >= 1
    assert all(h["group"] == "runbooks" for h in hits)
    assert {h["id"] for h in hits} == {"runbooks/seeding#0"}


def test_search_bm25_mode_with_single_char_query_returns_empty(retriever):
    # Spec edge case #3 / #10: query of all 1-char tokens → no results.
    hits = retriever.search("a I x", top_k=5, mode="bm25", group=None, source_file=None)
    assert hits == []


# ---------------------------------------------------------------------------
# HybridRetriever.search — dense mode (monkeypatched, no network)
# ---------------------------------------------------------------------------


def test_search_dense_mode_uses_dense_order(retriever, monkeypatch):
    # Force dense to return paypal-first, mongo-second.
    fake_dense = [
        ("features/paypal#0", 0.95),
        ("adrs/mongo#0", 0.80),
        ("features/cart#0", 0.50),
    ]
    monkeypatch.setattr(retriever, "_dense_ranks", lambda q, flt: fake_dense)

    hits = retriever.search(
        "anything", top_k=3, mode="dense", group=None, source_file=None,
    )
    assert [h["id"] for h in hits] == [
        "features/paypal#0",
        "adrs/mongo#0",
        "features/cart#0",
    ]
    # Scores in dense mode are the raw dense scores.
    assert hits[0]["score"] == pytest.approx(0.95)
    assert hits[1]["score"] == pytest.approx(0.80)


def test_search_dense_mode_caps_at_top_k(retriever, monkeypatch):
    fake_dense = [
        ("features/paypal#0", 0.95),
        ("adrs/mongo#0", 0.80),
        ("features/cart#0", 0.50),
        ("features/search#0", 0.40),
    ]
    monkeypatch.setattr(retriever, "_dense_ranks", lambda q, flt: fake_dense)
    hits = retriever.search("q", top_k=2, mode="dense", group=None, source_file=None)
    assert len(hits) == 2
    assert [h["id"] for h in hits] == ["features/paypal#0", "adrs/mongo#0"]


def test_search_dense_mode_skips_hits_missing_from_local_chunks(retriever, monkeypatch):
    # Spec edge case #6 / #4: Qdrant returns an id that's not in chunks.jsonl
    # — it must be silently skipped, not crash.
    fake_dense = [
        ("ghost/unknown#999", 0.99),       # drift: not in local chunks
        ("features/paypal#0", 0.95),
        ("another/ghost#42", 0.90),        # drift
        ("adrs/mongo#0", 0.80),
    ]
    monkeypatch.setattr(retriever, "_dense_ranks", lambda q, flt: fake_dense)
    hits = retriever.search("q", top_k=4, mode="dense", group=None, source_file=None)
    # Only the two known ids survive — top_k slicing happens BEFORE the
    # missing-id filter, so we get at most 4, and exactly the 2 known ones.
    returned_ids = [h["id"] for h in hits]
    assert returned_ids == ["features/paypal#0", "adrs/mongo#0"]
    assert all("ghost" not in cid for cid in returned_ids)


# ---------------------------------------------------------------------------
# HybridRetriever.search — hybrid mode (RRF, monkeypatched dense)
# ---------------------------------------------------------------------------


def test_search_hybrid_rrf_promotes_chunk_present_in_both_retrievers(retriever, monkeypatch):
    # Control BOTH retriever inputs so the RRF outcome is unambiguous.
    # (Note: the real `_bm25_ranks` ranks the WHOLE corpus, so a dense-only
    #  chunk can still pick up a BM25 rank and tie — we stub it out here to
    #  isolate the "present in both retrievers gets promoted" property.)
    # dense: mongo@0, paypal@1 ;  bm25: paypal@0, cart@1
    monkeypatch.setattr(
        retriever, "_dense_ranks",
        lambda q, flt: [("adrs/mongo#0", 0.99), ("features/paypal#0", 0.50)],
    )
    monkeypatch.setattr(
        retriever, "_bm25_ranks",
        lambda q, pred: [("features/paypal#0", 3.0), ("features/cart#0", 1.0)],
    )

    hits = retriever.search("q", top_k=5, mode="hybrid", group=None, source_file=None)
    ids = [h["id"] for h in hits]
    # paypal in BOTH lists: RRF = 1/(60+2) + 1/(60+1) ≈ 0.03252
    # mongo dense-only: 1/(60+1) ≈ 0.01639 ; cart bm25-only: 1/(60+2) ≈ 0.01613
    assert ids[0] == "features/paypal#0"
    assert ids.index("features/paypal#0") < ids.index("adrs/mongo#0")
    assert ids.index("features/paypal#0") < ids.index("features/cart#0")


def test_search_hybrid_respects_top_k(retriever, monkeypatch):
    fake_dense = [
        ("adrs/mongo#0", 0.9),
        ("features/paypal#0", 0.8),
        ("features/cart#0", 0.7),
        ("runbooks/seeding#0", 0.6),
        ("features/search#0", 0.5),
    ]
    monkeypatch.setattr(retriever, "_dense_ranks", lambda q, flt: fake_dense)
    hits = retriever.search(
        "cart paypal mongodb", top_k=3, mode="hybrid",
        group=None, source_file=None,
    )
    assert len(hits) == 3


def test_search_hybrid_score_uses_rrf_not_raw_scores(retriever, monkeypatch):
    # Spec edge case #10: RRF uses rank weights only.
    # Make dense rank paypal #1 (very small raw score) and bm25 also rank paypal #1.
    # Expected RRF for paypal = 2 * 1/(K+1) — a small number, NOT 0.001.
    fake_dense = [("features/paypal#0", 0.001)]
    monkeypatch.setattr(retriever, "_dense_ranks", lambda q, flt: fake_dense)
    hits = retriever.search(
        "paypal client id config", top_k=1, mode="hybrid",
        group=None, source_file=None,
    )
    assert hits[0]["id"] == "features/paypal#0"
    expected_rrf = 2.0 / (RRF_K + 1)  # rank 0 in both lists
    assert hits[0]["score"] == pytest.approx(expected_rrf, rel=1e-6)


def test_search_hybrid_when_dense_empty_falls_back_to_bm25(retriever, monkeypatch):
    # Spec edge case #9: one retriever empty → other still ranks.
    monkeypatch.setattr(retriever, "_dense_ranks", lambda q, flt: [])
    hits = retriever.search(
        "mongodb mongoose connection startup", top_k=2, mode="hybrid",
        group=None, source_file=None,
    )
    assert len(hits) >= 1
    assert hits[0]["id"] == "adrs/mongo#0"


def test_search_hybrid_does_not_call_dense_when_mode_is_bm25(retriever, monkeypatch):
    # Guard rail: mode="bm25" must NOT touch _dense_ranks (no network at all).
    def boom(q, flt):  # pragma: no cover — must not be invoked
        raise AssertionError("_dense_ranks must not be called in bm25 mode")

    monkeypatch.setattr(retriever, "_dense_ranks", boom)
    hits = retriever.search(
        "cart redux localStorage", top_k=1, mode="bm25",
        group=None, source_file=None,
    )
    assert hits[0]["id"] == "features/cart#0"

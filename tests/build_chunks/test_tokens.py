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

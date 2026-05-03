import pytest


@pytest.fixture
def short_md():
    return """# Test Doc

## Section A

Some short content here.

## Section B

More short content.
"""

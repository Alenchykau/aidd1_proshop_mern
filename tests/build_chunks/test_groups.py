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

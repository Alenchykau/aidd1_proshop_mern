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


def group_for(path: Path) -> str:
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

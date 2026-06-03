#!/usr/bin/env python3
"""Keep project-index.json's filesystem_tree + last_updated in sync with the repo.

Annotations (subprojects, hard_rules, ai_routing, etc.) are NEVER touched —
only `filesystem_tree` and `last_updated` are rewritten, and only when the tree
actually changed structurally.

Usage:
  python .claude/scripts/update_project_index.py          # manual run
  python .claude/scripts/update_project_index.py --hook    # PostToolUse hook run
                                                           # (reads hook JSON on stdin)

Stdlib only (Python 3.8+). Works on Windows + POSIX.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Windows consoles default to a non-UTF codec (cp1251/cp1252) and choke on the
# ✅ in our status lines. Force UTF-8 on the streams we print to.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

REPO = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2])
PINDEX = REPO / "project-index.json"
MAX_DEPTH = 4

# Directories never walked / never listed (noise or generated).
EXCLUDE_DIRS = {
    ".git", "node_modules", "dist", "build", "coverage", "uploads",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".cache",
    ".venv", "venv", ".venv-rag", ".next", ".turbo",
    # repo-local runtime / scratch / tooling state (not source)
    ".superpowers", "claude_sessions", "n8n-data", "tmp", ".idea", ".vscode",
}

# Critical subtrees for this fork. A hook fired on a file OUTSIDE these (and the
# root) skips the rebuild — cheap early-out. Adapt to your fork's layout.
WATCH_PATHS = (
    "backend/",
    "frontend/src/",
    "mcp-feature-flags/",
    "mcp-project-docs/",
    "scripts/",
    "backend/features.json",
)


def build_tree(root: Path) -> dict:
    """depth-limited {dir -> sorted[entries]} map; dirs get a trailing '/'."""
    tree: dict[str, list[str]] = {}
    root = root.resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        rel = Path(dirpath).resolve().relative_to(root)
        depth = 0 if rel == Path(".") else len(rel.parts)
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        if depth >= MAX_DEPTH:
            dirnames[:] = []
        key = "." if rel == Path(".") else rel.as_posix()
        tree[key] = sorted([d + "/" for d in dirnames]) + sorted(filenames)
    return tree


def _hook_context() -> tuple[str, str]:
    """Parse PostToolUse JSON from stdin (best-effort). Returns (tool, file_path)."""
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        return ("", "")
    tool = payload.get("tool_name", "")
    file_path = (payload.get("tool_input") or {}).get("file_path", "")
    return (tool, file_path)


def _is_watched(file_path: str) -> bool:
    if not file_path:
        return True  # unknown -> don't skip
    try:
        rel = Path(file_path).resolve().relative_to(REPO).as_posix()
    except Exception:
        rel = file_path.replace("\\", "/")
    return any(rel == w or rel.startswith(w) for w in WATCH_PATHS)


def main() -> int:
    is_hook = "--hook" in sys.argv
    label = "hook" if is_hook else "manual"

    if is_hook:
        tool, file_path = _hook_context()
        if not _is_watched(file_path):
            print(f"[update-index {label}] ignored ({file_path or 'unknown'} not in WATCH_PATHS)")
            return 0
        if tool or file_path:
            print(f"[update-index {label}] triggered by {tool or '?'} on {file_path or '?'}")

    if not PINDEX.exists():
        print(f"[update-index {label}] project-index.json not found at {PINDEX}", file=sys.stderr)
        return 1

    idx = json.loads(PINDEX.read_text(encoding="utf-8"))
    new_tree = build_tree(REPO)

    if idx.get("filesystem_tree") == new_tree:
        print(f"[update-index {label}] no structural change, last_updated NOT bumped")
        return 0

    idx["filesystem_tree"] = new_tree
    idx["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    PINDEX.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[update-index {label}] ✅ updated project-index.json (tree + last_updated)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import json
import subprocess
import sys
from pathlib import Path


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def test_prepare_writes_per_group_inputs(tmp_path, monkeypatch):
    # Build a tiny fake project-data tree in tmp_path
    root = tmp_path / "docs" / "project-data"
    _write(root / "architecture.md", "# Arch\n\n## Overview\n\nbody.\n")
    _write(root / "adrs" / "adr-001.md", "# ADR 1\n\n## Context\n\nbody.\n")
    _write(root / "features.json", json.dumps({
        "x": {"name": "X", "description": "desc", "status": "Enabled",
              "traffic_percentage": 100, "rollout_strategy": "ga",
              "targeted_segments": [], "last_modified": "2026-05-03"}
    }))

    monkeypatch.chdir(tmp_path)
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent.parent.parent / "scripts" / "build_chunks.py"),
         "prepare", "--out", "tmp/chunks/input"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    out = tmp_path / "tmp" / "chunks" / "input"
    assert (out / "top-level.json").exists()
    assert (out / "adrs.json").exists()
    payload = json.loads((out / "top-level.json").read_text(encoding="utf-8"))
    assert payload["group"] == "top-level"
    assert len(payload["chunks"]) >= 2  # arch + features.json


def test_validate_merges_and_writes_jsonl(tmp_path, monkeypatch):
    # Set up minimal input + matching enriched output
    root = tmp_path / "docs" / "project-data"
    _write(root / "architecture.md", "# Arch\n\n## Overview\n\nbody.\n")

    monkeypatch.chdir(tmp_path)
    script = Path(__file__).parent.parent.parent / "scripts" / "build_chunks.py"
    subprocess.run([sys.executable, str(script), "prepare", "--out", "tmp/chunks/input"], check=True)

    inp = json.loads((tmp_path / "tmp/chunks/input/top-level.json").read_text(encoding="utf-8"))
    enriched_lines = []
    for c in inp["chunks"]:
        enriched_lines.append(json.dumps({
            "id": c["id"],
            "summary": "A test summary sentence.",
            "keywords": ["arch", "overview", "test"],
            "language": c["metadata_partial"]["language_guess"],
        }))
    enriched_dir = tmp_path / "tmp" / "chunks" / "enriched"
    enriched_dir.mkdir(parents=True, exist_ok=True)
    (enriched_dir / "top-level.jsonl").write_text("\n".join(enriched_lines), encoding="utf-8")

    result = subprocess.run(
        [sys.executable, str(script), "validate",
         "--in-input", "tmp/chunks/input", "--in-enriched", "tmp/chunks/enriched",
         "--out", "docs/chunks.jsonl"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    final = (tmp_path / "docs" / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(final) >= 1
    rec = json.loads(final[0])
    assert rec["metadata"]["summary"] == "A test summary sentence."

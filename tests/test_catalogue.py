import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import build  # noqa: E402
from catalogue import load_catalogue, to_json_document  # noqa: E402

BENCH = """
id = "demo"
name = "Demo"
description = "Demo benchmark"
created = "2024-01-02"
updated = ""
repo_url = "https://example.org/demo"
[support]
engine = ["Snowflake"]
"""


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return path


def make(tmp_path, tasks="", harbor=None, bench=BENCH):
    write(tmp_path / "b" / "demo.toml", bench)
    write(tmp_path / "t" / "demo.toml", 'benchmark_id = "demo"\n' + tasks)
    hdir = tmp_path / "h"
    hdir.mkdir()
    for rel_path, text in (harbor or {}).items():
        write(hdir / rel_path, text)
    return load_catalogue(tmp_path / "b", tmp_path / "t", [hdir])


def test_repository_data_is_valid():
    cat = load_catalogue()
    assert cat.errors == []
    assert len(cat.benchmarks) == len(list((ROOT / "data" / "benchmarks").glob("*.toml")))
    assert {"da-code", "datascibench", "infiagent-dabench", "scienceagentbench", "intercode-sql", "spider"} <= {b["id"] for b in cat.benchmarks}
    assert all(t["verification"] != "illustrative" for t in cat.tasks if t["verification"] == "verified")


def test_generated_json_is_up_to_date(tmp_path):
    out = tmp_path / "catalogue.json"
    assert build.main(["--out", str(out)]) == 0
    committed = ROOT / "data" / "generated" / "catalogue.json"
    assert json.loads(out.read_text()) == json.loads(committed.read_text()), "run: uv run python scripts/build.py"


def test_blank_dates_and_urls_become_null(tmp_path):
    cat = make(tmp_path)
    assert cat.errors == []
    bench = cat.benchmarks[0]
    assert bench["created"] == "2024-01-02"
    assert bench["updated"] is None
    assert bench["paper_url"] is None
    assert bench["support"]["engine"] == ["Snowflake"]


def test_bad_dates_rejected(tmp_path):
    cat = make(tmp_path, bench=BENCH.replace("2024-01-02", "2024-13-40"))
    assert any("not a real date" in e for e in cat.errors)
    cat = make(tmp_path / "x", bench=BENCH.replace("2024-01-02", "Jan 2024"))
    assert any("YYYY-MM-DD" in e for e in cat.errors)


def test_multi_valued_and_string_fields_normalize_to_lists(tmp_path):
    cat = make(tmp_path, """
[[tasks]]
task_id = "t1"
verification = "illustrative"
engine = "DuckDB"
output_formats = ["CSV", "Parquet", "CSV"]
""")
    assert cat.errors == []
    cfg = cat.tasks[0]["configurations"][0]
    assert cfg["engine"] == ["DuckDB"]
    assert cfg["output_formats"] == ["CSV", "Parquet"]
    assert cfg["catalogue"] == []


def test_configurations_inherit_and_override(tmp_path):
    cat = make(tmp_path, """
[[tasks]]
task_id = "t1"
verification = "illustrative"
language = ["SQL"]
[[tasks.configurations]]
engine = ["DuckDB"]
[[tasks.configurations]]
engine = ["Snowflake"]
verification = "inferred"
""")
    assert cat.errors == []
    a, b = cat.tasks[0]["configurations"]
    assert a["engine"] == ["DuckDB"] and b["engine"] == ["Snowflake"]
    assert a["language"] == b["language"] == ["SQL"]
    assert a["verification"] == "illustrative" and b["verification"] == "inferred"


def test_invalid_values_rejected(tmp_path):
    cat = make(tmp_path, """
[[tasks]]
task_id = "t1"
verification = "probably"
interaction_method = ["telepathy"]
colour = "red"
""")
    joined = "\n".join(cat.errors)
    assert "verification must be one of" in joined
    assert "interaction_method 'telepathy'" in joined
    assert "unknown key 'colour'" in joined


def test_verified_task_requires_evidence(tmp_path):
    cat = make(tmp_path, '[[tasks]]\ntask_id = "t1"\nverification = "verified"\n')
    assert any("need a source_url or evidence_url" in e for e in cat.errors)


def test_vocabulary_conflicts_flagged(tmp_path):
    cat = make(tmp_path, """
[[tasks]]
task_id = "t1"
engine = ["DuckDB"]
[[tasks]]
task_id = "t2"
engine = ["duckdb"]
""")
    assert any("conflicts with 'DuckDB'" in e for e in cat.errors)


def test_unknown_benchmark_and_duplicates(tmp_path):
    cat = make(tmp_path, '[[tasks]]\ntask_id = "t1"\n[[tasks]]\ntask_id = "t1"\n',
               harbor={"x/task.toml": '[metadata.technology]\nbenchmark_id = "nope"\n'})
    joined = "\n".join(cat.errors)
    assert "duplicate task 'demo/t1'" in joined
    assert "unknown benchmark_id 'nope'" in joined


def test_harbor_task_normalizes_like_standalone(tmp_path):
    harbor_toml = """
version = "1.0"
[task]
name = "org/my-task"
[metadata]
difficulty = "hard"
tags = ["dbt"]
[metadata.technology]
benchmark_id = "demo"
verification = "verified"
source_url = "https://example.org/task"
engine = ["Snowflake"]
catalogue = ["Snowflake native"]
"""
    cat = make(tmp_path, harbor={
        "my-task/task.toml": harbor_toml,
        "plain/task.toml": '[metadata]\ndifficulty = "easy"\n',  # no technology table: skipped
    })
    assert cat.errors == []
    assert len(cat.tasks) == 1
    task = cat.tasks[0]
    assert task["task_id"] == "my-task"  # defaults to directory name
    assert task["origin"] == "harbor"
    assert task["configurations"][0]["catalogue"] == ["Snowflake native"]
    doc = to_json_document(cat)
    assert doc["stats"]["by_verification"]["verified"] == 1
    assert set(doc["tasks"][0]) == {
        "benchmark_id", "origin", "source_file", "task_id", "name", "source_url", "evidence_url",
        "verification", "notes", "configurations", *doc["fields"]["technology"], "inferred_fields",
    }

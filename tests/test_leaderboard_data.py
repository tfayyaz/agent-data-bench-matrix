"""Research provenance and data integrity checks for the engine registry."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from catalogue import load_catalogue, load_leaderboard


def test_research_data_is_valid_and_source_backed():
    cat = load_catalogue()
    assert not cat.errors
    assert len(cat.leaderboard['engines']) == 46
    assert len(cat.leaderboard['tools']) == 16
    assert {'o11y-bench', 'orca-bench', 'sregym', 'itbench-sre'} <= {b['id'] for b in cat.benchmarks}
    assert cat.leaderboard['reviewed_on'] == '2026-10-24'
    kinds = {e['kind'] for e in cat.leaderboard['evidence']}
    assert {'runtime', 'environment', 'planned'} <= kinds
    assert {'agentbench-db', 'dataagentbench', 'dec-bench', 'pipelinebench'} <= {b['id'] for b in cat.benchmarks}


def test_rejects_unregistered_research_references_and_unpinned_sources(tmp_path):
    path = tmp_path / 'leaderboard.toml'
    path.write_text('''reviewed_on = "2026-10-24"
scope = "Test"
[[evidence]]
engine = "Missing engine"
benchmark_id = "missing-benchmark"
kind = "runtime"
evidence_url = "https://github.com/a/b/blob/main/run.py"
reviewed_on = "2026-10-24"
notes = "Test"
''')
    errors = []
    load_leaderboard(path, set(), errors)
    assert any('unknown engine' in e for e in errors)
    assert any('unknown benchmark_id' in e for e in errors)
    assert any('pinned commit' in e for e in errors)


def test_rejects_engine_alias_collisions(tmp_path):
    path = tmp_path / 'leaderboard.toml'
    path.write_text('''reviewed_on = "2026-10-24"
scope = "Test"
[[engines]]
name = "First"
category = "SQL"
license = "MIT"
license_scope = "Core"
source_url = "https://example.org/first"
aliases = ["same"]
[[engines]]
name = "Second"
category = "SQL"
license = "MIT"
license_scope = "Core"
source_url = "https://example.org/second"
aliases = ["SAME"]
''')
    errors = []
    load_leaderboard(path, set(), errors)
    assert any('alias' in e and 'conflicts' in e for e in errors)


def test_tool_references_require_registered_tools_and_pinned_citations(tmp_path):
    path = tmp_path / 'leaderboard.toml'
    path.write_text('''reviewed_on = "2026-10-24"
scope = "Tool validation"
[[tool_evidence]]
tool = "Missing tool"
benchmark_id = "demo"
kind = "runtime"
evidence_url = "https://github.com/a/b/blob/main/run.py"
reviewed_on = "2026-10-24"
notes = "Test"
''')
    errors = []
    load_leaderboard(path, {'demo'}, errors)
    assert any('unknown tool' in e for e in errors)
    assert any('pinned commit' in e for e in errors)

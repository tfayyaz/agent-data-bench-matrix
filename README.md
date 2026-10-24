# Agent Data Benchmark Matrix

**Live site:** https://tfayyaz.github.io/agent-data-bench-matrix/

A small static catalogue that maps data-related AI agent benchmarks to the technologies their tasks actually use: execution engines, client applications, catalogues, storage and table formats. Every value in the matrices comes from task-level TOML metadata in this repository, and each one links back to the TOML record and to the upstream evidence.

The site is plain HTML, CSS and JavaScript with [Tabulator](https://tabulator.info/) (MIT, vendored in `vendor/tabulator/`). There is no backend.

## Views

| View | Rows | Columns | Cell values |
|---|---|---|---|
| A · Benchmark × Engine (default) | Benchmarks | Execution engines | Distinct *catalogue / underlying storage* combinations, with task counts |
| B · Benchmark × Client | Benchmarks | Client applications | Engines, with task counts |
| C · Benchmark × Table format | Benchmarks | Table formats | Engines, with task counts |
| D · Task explorer | One row per task configuration | All metadata fields | — |

Each view supports search, sorting, filtering by benchmark, column and verification status, and CSV download. Click a matrix cell to see its tasks with all their fields, evidence links and the TOML file they came from. Click a benchmark name to see its metadata. The view is kept in the URL (`#view=client`, `#view=table_format`, `#view=tasks`).

**Counting rules.** A cell counts *distinct tasks*. A task with several output formats, clients or configurations still counts once in a cell. A `◦ benchmark-level` cell means the benchmark claims support for that technology (in `[support]`) but no task-level record exists yet. This keeps claimed support separate from verified usage.

## Benchmarks covered

| Benchmark | Repository | Tasks recorded |
|---|---|---|
| Spider 2.0 | https://github.com/xlang-ai/Spider2 | `bq011` (BigQuery), `sf_bq011` (Snowflake), `local002` (SQLite), `playbook001` (DuckDB + dbt) |
| Spider2-V | https://github.com/xlang-ai/Spider2-V | BigQuery web console task, Airflow web UI task |
| BIRD | https://github.com/bird-bench/mini_dev | Mini-Dev SQLite question 1471 |
| BIRD-Interact | https://github.com/bird-bench/BIRD-Interact | `alien_1` (a-Interact), `alien_3` (c-Interact) |
| data-eng-bench | https://github.com/Snowflake-Labs/data-eng-bench | `cohort-retention-matrix` (Harbor task; DuckDB and Snowflake configurations) |
| DSBench | https://github.com/LiqiangJing/DSBench | one data analysis task and one data modeling task (inferred) |
| DABStep | https://huggingface.co/datasets/adyen/DABstep | task `1712` |
| DSAgentBench | https://github.com/vis-nlp/DSAgentBench | `ds001` (pandas + CSV in VS Code) |
| ADE-bench | https://github.com/dbt-labs/ade-bench | `airbnb001` (four DuckDB/Snowflake × dbt/dbt Fusion variants) |
| ELT-Bench++ | https://github.com/uiuc-kang-lab/ELT-Bench | `snowflake/address` (Airbyte → Snowflake) |

This is a deliberately small, hand-checked sample. It is not an index of every task.

## Technology dimensions

All technology fields hold lists, because many tasks use more than one value.

| Field | Meaning | Examples |
|---|---|---|
| `client_application` | What the agent drives | BigQuery Console, VS Code, dbt CLI, Snowflake Python connector |
| `interaction_method` | How it drives it (fixed vocabulary) | `CLI`, `MCP`, `API`, `browser GUI`, `desktop GUI`, `notebook`, `SQL driver`, `unknown` |
| `language` | Core language the agent writes | SQL, Python, Jinja, `none` for pure GUI tasks |
| `engine` | Execution engine or server | BigQuery, Snowflake, DuckDB, SQLite, PostgreSQL, Pandas |
| `managed_service` | Hosted service, if any | Google BigQuery, Snowflake, `none` |
| `table_format` | Table format | Iceberg, Delta, Hudi, DuckLake, `Engine-native`, `none` |
| `source_formats` | Data artifacts the task reads | CSV, JSONL, PostgreSQL tables |
| `output_formats` | Artifacts the task produces | dbt model tables, SQL, TXT |
| `storage_format` | Physical storage, where known | DuckDB database file, SQLite database file, Local CSV file |
| `catalogue` | Metadata catalogue | BigQuery native, Unity Catalog, Polaris, Glue, `none` |

Data artifacts are kept separate from physical storage. For example, a task that exports CSV from BigQuery lists `CSV` under `output_formats`, but that says nothing about how BigQuery stores its tables. An empty list means **unknown** and is shown as "Unknown". `none` means the dimension does not apply.

## Verification status

| Status | Meaning |
|---|---|
| `verified` | The task ID and its core technology (engine/data source) were checked against the task's own files at a pinned commit or dataset revision. Individual fields that come from benchmark-level docs are listed in `inferred_fields` and badged "inferred" in the UI. |
| `inferred` | The task exists, but its technology fields come from benchmark-level documentation, not the task's own files. |
| `illustrative` | Example only, not verified. Excluded from the matrices by default and from verified counts. |
| `unknown` | Not yet checked. |

By default the site shows `verified` and `inferred` records. Use the Status filter to include the others.

## Metadata schema

### Benchmark: `data/benchmarks/<id>.toml`

```toml
id = "spider2"                      # must match the file name
name = "Spider 2.0"
description = "…"
created = "2024-11-12"              # YYYY-MM-DD, or "" if unknown. Never guess.
created_source = "arXiv 2411.07763 v1 submission"
updated = "2026-08-12"
updated_source = "Latest commit on main (cafb867)"
repo_url = "https://github.com/xlang-ai/Spider2"
paper_url = "https://arxiv.org/abs/2411.07763"
website_url = "https://spider2-sql.github.io"
dataset_url = ""
last_verified = "2026-10-23"
notes = ""

[support]                           # benchmark-level claims, separate from task usage
engine = ["BigQuery", "Snowflake", "SQLite", "DuckDB"]
client_application = ["dbt CLI"]
table_format = []
language = ["SQL", "Python"]
evidence_url = "https://…"
notes = ""
```

### Task, standalone annotation: `data/tasks/<benchmark_id>.toml`

Use this for benchmarks that are not Harbor tasks.

```toml
benchmark_id = "ade-bench"

[[tasks]]
task_id = "airbnb001"
name = "Fix outdated dbt_utils.surrogate_key compile error"
source_url = "https://github.com/…/task.yaml"     # the task itself
evidence_url = "https://github.com/…"             # what supports the technology claims
verification = "verified"
interaction_method = ["CLI"]
language = ["SQL", "Jinja", "YAML"]
table_format = ["Engine-native"]
notes = "…"

# Optional: one table per concrete technology setup. Unset fields inherit from the task.
[[tasks.configurations]]
label = "DuckDB · dbt Core"
client_application = ["dbt CLI"]
engine = ["DuckDB"]
storage_format = ["DuckDB database file"]
catalogue = ["DuckDB native"]
inferred_fields = ["catalogue"]

[[tasks.configurations]]
label = "Snowflake · dbt Core"
engine = ["Snowflake"]
catalogue = ["Snowflake native"]
```

Configurations exist so that a task which can run on DuckDB *or* Snowflake does not cross-multiply catalogues and storage formats. A configuration may also set its own `verification`, `evidence_url` and `notes`.

### Task, Harbor-native: `task.toml` with `[metadata.technology]`

[Harbor](https://github.com/harbor-framework/harbor) leaves `[metadata]` free-form, so the same fields go under `[metadata.technology]` without changing Harbor's schema. `task_id` defaults to the task directory name, and `benchmark_id` is required. Tasks without a `[metadata.technology]` table are skipped. See [`data/harbor/data-eng-bench/cohort-retention-matrix/task.toml`](data/harbor/data-eng-bench/cohort-retention-matrix/task.toml):

```toml
[metadata]
difficulty = "hard"
category = "database"

[metadata.technology]
benchmark_id = "data-eng-bench"
verification = "verified"
source_url = "https://github.com/…"
interaction_method = ["CLI"]

[[metadata.technology.configurations]]
label = "DuckDB"
engine = ["DuckDB"]
```

Both sources are normalized into the same JSON schema in `data/generated/catalogue.json`. The site only reads this file.

## Adding a benchmark

1. Create `data/benchmarks/<id>.toml`. Use lowercase `[a-z0-9._-]` for the id.
2. Take dates from primary sources (arXiv v1, GitHub API `created_at`, latest commit) and record them in `created_source` / `updated_source`. Leave a date `""` rather than estimating it.
3. Put claimed technologies under `[support]` with an `evidence_url`.
4. Rebuild (see below).

## Adding a task

1. Open the task's own files upstream and use a permalink pinned to a commit SHA for `source_url`.
2. Add a `[[tasks]]` entry to `data/tasks/<benchmark_id>.toml`, or a `[metadata.technology]` table to a Harbor `task.toml` under `data/harbor/`.
3. Fill only what you can support with evidence. Leave other fields out (unknown). List fields that come from benchmark-level docs in `inferred_fields`.
4. Reuse existing spellings (`DuckDB`, not `duckdb`). Validation rejects case or spacing variants of values already in use.

## Running locally

Requires [uv](https://docs.astral.sh/uv/) and, for the JS tests, Node 18 or newer.

```bash
uv sync                                  # creates .venv with pytest
uv run python scripts/validate.py        # validate TOML
uv run python scripts/build.py           # regenerate data/generated/catalogue.json
uv run pytest                            # Python tests (schema, normalization, Harbor parsing)
node --test tests/*.test.js              # pivot logic tests
uv run python -m http.server 8000        # then open http://localhost:8000/
```

To include an external Harbor dataset checkout, run `uv run python scripts/build.py --harbor-dir /path/to/dataset`. Every `task.toml` with a `[metadata.technology]` table is included.

The generated JSON is committed. CI rebuilds it and fails if the committed copy is stale, so run `scripts/build.py` after editing TOML.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`. It:

1. validates the TOML
2. regenerates the JSON and checks it is up to date
3. runs the Python and JS tests
4. publishes `index.html`, `css/`, `js/`, `vendor/` and `data/` to GitHub Pages using the official `configure-pages`, `upload-pages-artifact` and `deploy-pages` actions

Pull requests run the build and test steps but do not deploy. Pages must use **Settings → Pages → Source: GitHub Actions**. All asset paths are relative, so the site works under `/agent-data-bench-matrix/`.

## Layout

```text
index.html, css/, js/          static site (js/matrix.js = generic pivot logic, js/app.js = UI)
vendor/tabulator/              Tabulator 6.3.1 (MIT)
data/benchmarks/*.toml         benchmark metadata
data/tasks/*.toml              standalone task annotations
data/harbor/**/task.toml       Harbor-native tasks with [metadata.technology]
data/generated/catalogue.json  normalized output consumed by the site
scripts/catalogue.py           loading, validation and normalization
scripts/validate.py, build.py  CLIs
tests/                         pytest + node:test
```

## Expanded catalogue and interface

The catalogue also includes **DA-Code, DataSciBench, InfiAgent-DABench,
ScienceAgentBench, InterCode (SQL), and Spider 1.0**. These six entries are based
on their upstream READMEs, linked in each TOML record. They are benchmark-level
entries awaiting representative task annotations; they do not increase verified
task counts. Unknown dates and task technologies remain unfilled.

The interface includes a responsive overview, view tabs, and an **All benchmarks**
directory with source/evidence details. Existing matrix filters, task exploration,
URL view selection, and CSV export remain available. Verification status filters
apply to task configurations; the directory displays benchmark metadata.

Technology pictograms are original, bundled inline SVGs in `js/icons.js`, with
fallbacks for all engines, formats and catalogues. See [icon credits](docs/icons.md)
for provenance and licensing. No third-party icon service is used.

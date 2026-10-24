# Open-source engine coverage leaderboard

Research snapshot: **2026-10-24**.

The leaderboard measures **documented benchmark coverage**, not engine performance,
model accuracy, execution frequency, or worldwide popularity. The catalogue now
contains 37 benchmarks and 23 sampled task records. There are 46 scoped OSS engine
entries and 16 OSS tools. Only engines with qualifying evidence receive a rank.

## Counting policy

- The score is the number of **distinct benchmark IDs** associated with an engine.
- A benchmark counts once even if it has several dialects, variants, task
  configurations, clients, or citations for the same engine.
- **Task-backed** means at least one verified or inferred task annotation names
  the engine. **Support-only** means documentation or an agent runtime/reference
  implementation establishes support but no task annotation exists for that pair.
  These two counts partition total benchmark coverage; they are not added twice.
- A **verified task** requires a verified configuration whose engine is not in
  `inferred_fields`. Task IDs are deduplicated across configurations. A task
  represented as both inferred and verified counts once as verified.
- “Verified” means a task requirement, starter, or source file was inspected. It
  does **not** mean an agent was run, nor that every submission uses that engine.
- Dependencies installed in an image, evaluator-only imports, and future roadmap
  mentions are research leads, **not counted coverage**.
- In “Verified tasks only” mode, benchmark coverage is recomputed using verified
  task records alone. Benchmark selection also recomputes coverage and rank.
  Search/category filtering retains the ranks of that selected evidence universe.
- Equal coverage receives the same competition rank; names sort alphabetically
  within a tie. Engine aliases are canonicalized. Proprietary/managed engines
  remain in the general matrix but are excluded from this OSS leaderboard.
- Named benchmarks may share upstream data (for example, BIRD, FDABench and
  TAG-Bench). Distinct benchmark coverage does not imply independent datasets.

## Sources and reproducibility

Source data is stored in `data/benchmarks/*.toml`, `data/tasks/*.toml`, and
`data/leaderboard.toml`. `scripts/build.py` validates these records and emits the
single `data/generated/catalogue.json` consumed by the website. Scores are computed
from that JSON; no ranking numbers are hand-entered. CSV export includes the
counts, benchmark names, and every qualifying source URL for the filtered rows.

The registry stores engine categories, a license label, a distribution scope and
an upstream source link. The label applies to that scoped core/community source,
not automatically to enterprise extensions or hosted services. For example,
TimescaleDB is limited to its Apache-licensed core; Elasticsearch is limited to
code available under the AGPL option, excluding Elastic-License-only x-pack code.
License boundaries for these six edition-sensitive additions were checked against
upstream license files: TimescaleDB, QuestDB, InfluxDB 3 Core, TDengine Community,
RisingWave and Elasticsearch. Their registry links preserve the reviewed revision.

New research evidence links are pinned to commit SHAs and have review dates and
notes explaining exactly what was established. Earlier catalogue support claims
retain their existing evidence links and are never promoted to verified tasks.
Click an engine or “Inspect all evidence” to see all citations and uncounted leads.

## Benchmarks added or revisited

The upstream repositories reviewed for this extension include:

| Benchmark | Repository | Qualifying evidence or research limit |
|---|---|---|
| AgentBench · DB | https://github.com/THUDM/AgentBench | README deploys DBBench using MySQL 8 |
| BIRD-Critic | https://github.com/bird-bench/BIRD-CRITIC-1 | README documents PostgreSQL, MySQL and the SQLite release; proprietary dialects excluded from OSS ranking |
| LiveSQLBench | https://github.com/bird-bench/livesqlbench | README documents PostgreSQL/SQLite variants and agent/CLI harnesses |
| MLAgentBench | https://github.com/snap-stanford/MLAgentBench | `house-price/env/train.py` reads CSV and operates on pandas DataFrames |
| KramaBench | https://github.com/mitdbg/Kramabench | Example system under test loads CSV inputs with pandas; this is supported baseline coverage |
| PipelineBench | https://github.com/joakimarvidsson/pipelinebench | Two inspected task starters use DuckDB and pandas; installed Polars and roadmap Spark are excluded |
| DEC Bench | https://github.com/514-labs/agent-evals | README documents PostgreSQL and ClickHouse scenario infrastructure |
| BLADE | https://github.com/behavioral-data/BLADE | Notebook execution supplies pandas DataFrames to agent-generated transformations |
| InsightBench | https://github.com/ServiceNow/insight-bench | Agent analysis tools operate on pandas DataFrames |
| FDABench | https://github.com/fdabench/FDAbench | README documents SQLite and cloud database sources |
| DAB | https://github.com/ucbepic/DataAgentBench | Dataset table documents DuckDB, PostgreSQL and SQLite per domain; installed pandas alone is not credited |
| TAG-Bench | https://github.com/TAG-Research/TAG-Bench | Reference pipelines use pandas; text-to-SQL baseline executes SQLite |
| MLE-bench | https://github.com/openai/mle-bench | Relevant agent benchmark, but evaluator pandas imports alone are not credited |
| InfiAgent-DABench | https://github.com/InfiAgent/InfiAgent | Development task 64 explicitly requires pandas `mean()` and `std()` |
| DA-Code | https://github.com/yiyihum/da-code | SQL execution template connects to SQLite and uses pandas to retrieve results |
| InterCode · SQL | https://github.com/princeton-nlp/intercode | SQL environment connects with `mysql.connector`; previously missing engine support corrected |

Existing task evidence and documented engine support in Spider 1.0/2.0,
Spider2-V, BIRD, BIRD-Interact, data-eng-bench, DSBench, DABStep, DSAgentBench,
ADE-bench, ELT-Bench++ and DataSciBench remain part of the catalogue. Installing
pandas in ScienceAgentBench's base image does not on its own earn coverage credit.

## Search scope and limitations

Discovery combined the existing catalogue, upstream benchmark READMEs, repository
and code search, and the benchmark section of
https://github.com/SJTU-DMTai/Awesome-Data-Agent-Papers . That reading list was used
for discovery; engine claims were checked against primary repositories instead.
Queries covered interactive SQL, analysis, scientific workflows, machine learning
and data engineering, including searches for Polars, Spark, Flink, Trino,
DataFusion, ClickHouse and Milvus in agent/benchmark contexts. Generic throughput
benchmarks, agent framework compatibility lists, and non-LLM simulation “agents”
were not treated as agent benchmark coverage.

This is a **curated, reproducible research snapshot**, not a claim to have found
every public or private agent benchmark. “No qualifying evidence” means none in
the reviewed catalogue/selection, not proof of absence. Some relevant benchmarks
lack public task files or allow arbitrary libraries, so their actual runtime
engines remain unknown. The current task sample is small and uneven: verified
counts should not be interpreted as full benchmark task totals. Adding a new
pinned, qualifying source can change the ranking without any engine improving.

SDKs (Beam), compatibility layers (FerretDB), proprietary services and unreviewed
license scopes (Memgraph) are explained in the view's exclusions. These are
classification boundaries, not statements about benchmark quality.

## Mobile presentation

The same ranked records render as desktop rows and mobile cards. Every card keeps
the rank, engine/category/license, benchmark count, evidence breakdown, verified
and inferred task counts, benchmark names, and citation links. No data columns are
hidden on small screens and the view tabs wrap. Vertical scrolling is expected;
horizontal scrolling is unnecessary. Coverage-gap entries and methodology also
wrap within the viewport.

## Observability and SRE extension

Reviewed on **2026-10-24**. The catalogue now contains **37 benchmarks, 23 sampled
tasks, 46 scoped query/compute engines and 16 OSS tools**. This extension preserves
the evidence from the original data-engine leaderboard.

The **OSS tools** view (`#view=tools`) ranks a separate inventory. Grafana, Jaeger,
OpenTelemetry collectors/operators, Kubernetes, kubectl, Helm, Chaos Mesh, Istio,
Harbor and IPython are not relabeled as database engines. Their categories explain
whether they provide an agent interface, collection, deployment, operational CLI,
fault injection, evaluation harness or analysis runtime. Tools are sourced from
`[[tools]]` and `[[tool_evidence]]` in `data/leaderboard.toml`; task-level tool lists
are optional metadata under `tools`.

| Benchmark | Primary repository | Stack evidence and limits |
|---|---|---|
| o11y-bench | https://github.com/grafana/o11y-bench | Real Grafana/Prometheus/Loki/Tempo sidecar, default mcp-grafana interface and Harbor harness. Three pinned task specifications establish PromQL, LogQL and TraceQL backend usage. Default interface/harness fields remain explicitly inferred from benchmark-wide docs. |
| ORCA-bench | https://github.com/ORCA-bench/ORCA-bench | OpenTelemetry Demo snapshots; Prometheus metrics, Jaeger tracing backed by OpenSearch, Grafana inspection, OpenTelemetry Collector and Harbor tasks. Workload services such as PostgreSQL are not automatically counted as engines queried by the agent. |
| Agent RCA Bench | https://github.com/GreptimeTeam/agent-rca-bench | Native Prometheus/Loki/Tempo APIs compared against GreptimeDB SQL/PromQL. `RUNNING.md` specifies digest-pinned native backend images; these are not inferred merely from protocol names. The project is vendor-maintained and its README discloses that relationship. |
| AIOpsLab | https://github.com/microsoft/AIOpsLab | Live Kubernetes deployment with Helm/kubectl, Prometheus telemetry wrapper and direct Jaeger TraceAPI calls. |
| SREGym | https://github.com/SREGym/SREGym | Dedicated Prometheus and Jaeger MCP tools. README explicitly says bundled astronomy-shop OpenSearch/Grafana are not queried, and bundled Jaeger is replaced. Unused bundles do not earn coverage credit; the dedicated Jaeger service does. |
| ITBench · SRE | https://github.com/itbench-hub/ITBench | Paired with pinned `ITBench-Scenarios/sre/docs/tools.md`: Prometheus, ClickHouse/OpenSearch storage, Jaeger, OpenTelemetry collectors/operators, Prometheus Operator, Istio and conditionally Chaos Mesh. Tracing can be disabled by scenario configuration, and chaos tooling is installed only when enabled. These are benchmark-level supported roles, not universal task requirements. |
| Cloud-OpsBench | https://github.com/LLM4Ops/Cloud-OpsBench | OSS diagnostic toolkit replays cached Kubernetes resource/log/configuration responses. No live cluster is required. This does not earn live Kubernetes or Prometheus engine credit. |
| OpenRCA | https://github.com/microsoft/OpenRCA | Agent executor specifies pandas DataFrame analysis; the sandbox worker constructs IPython InteractiveShell, supplies pandas in its namespace and executes generated cells. Names of historical MySQL/Redis incident components in CSV telemetry are not evidence that the agent executes those engines. |

Every newly added research citation is pinned to a reviewed commit. Role notes and
excluded leads can be inspected from the leaderboard and benchmark detail panels.
The benchmark directory combines sourced support, task annotations and qualifying
research records to show both backend and tool stacks. Environment-only and
planned evidence stays out of those stack badges and coverage counts.

The `tools` and `engine` fields have independent inference flags. A task verified
for Prometheus usage does not establish verified Grafana/Harbor usage when those
tools were inferred from benchmark-wide docs. The verified-only filter respects
that distinction in both leaderboards.

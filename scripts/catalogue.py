"""Load, validate and normalize benchmark/task TOML metadata.

Two task sources are supported and normalized into one schema:

* Standalone annotations: ``data/tasks/<benchmark_id>.toml`` with a top-level
  ``benchmark_id`` and a ``[[tasks]]`` array.
* Harbor-native tasks: ``<harbor_root>/**/task.toml`` with the same fields under
  ``[metadata.technology]``. Harbor's own keys are left untouched.
"""

from __future__ import annotations

import datetime as dt
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_VERSION = 1

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")

VERIFICATION = ("verified", "inferred", "illustrative", "unknown")

INTERACTION_METHODS = (
    "CLI",
    "MCP",
    "API",
    "browser GUI",
    "desktop GUI",
    "notebook",
    "SQL driver",
    "unknown",
)

BENCHMARK_DATE_FIELDS = ("created", "updated", "last_verified")
BENCHMARK_URL_FIELDS = ("repo_url", "paper_url", "website_url", "dataset_url")
BENCHMARK_STR_FIELDS = (
    "id",
    "name",
    "description",
    "created_source",
    "updated_source",
    "notes",
)
SUPPORT_FIELDS = ("engine", "client_application", "table_format", "language")

# Multi-valued technology fields. Every one is normalized to a list of strings.
TECH_LIST_FIELDS = (
    "client_application",
    "interaction_method",
    "language",
    "engine",
    "managed_service",
    "table_format",
    "source_formats",
    "output_formats",
    "storage_format",
    "catalogue",
)
TASK_STR_FIELDS = ("task_id", "name", "source_url", "evidence_url", "verification", "notes")
TASK_LIST_FIELDS = TECH_LIST_FIELDS + ("inferred_fields",)
TASK_KEYS = set(TASK_STR_FIELDS) | set(TASK_LIST_FIELDS) | {"configurations"}
CONFIG_KEYS = {"label", "notes", "verification", "evidence_url"} | set(TASK_LIST_FIELDS)


class ValidationError(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("\n".join(errors))
        self.errors = errors


@dataclass
class Catalogue:
    benchmarks: list[dict] = field(default_factory=list)
    tasks: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def _blank_to_none(value):
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _as_list(value, where: str, key: str, errors: list[str]) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        errors.append(f"{where}: '{key}' must be a string or list of strings")
        return []
    out: list[str] = []
    for v in value:
        v = v.strip()
        if v and v not in out:
            out.append(v)
    return out


def _check_date(value, where: str, key: str, errors: list[str]):
    value = _blank_to_none(value)
    if value is None:
        return None
    if isinstance(value, dt.date) and not isinstance(value, dt.datetime):
        return value.isoformat()
    if not isinstance(value, str) or not DATE_RE.match(value):
        errors.append(f"{where}: '{key}' must be YYYY-MM-DD or blank, got {value!r}")
        return None
    try:
        dt.date.fromisoformat(value)
    except ValueError:
        errors.append(f"{where}: '{key}' is not a real date: {value!r}")
        return None
    return value


def _check_url(value, where: str, key: str, errors: list[str]):
    value = _blank_to_none(value)
    if value is None:
        return None
    if not isinstance(value, str) or not value.startswith("https://"):
        errors.append(f"{where}: '{key}' must be an https:// URL, got {value!r}")
        return None
    return value


def _read_toml(path: Path, errors: list[str]) -> dict | None:
    try:
        with path.open("rb") as fh:
            return tomllib.load(fh)
    except tomllib.TOMLDecodeError as exc:
        errors.append(f"{rel(path)}: invalid TOML: {exc}")
        return None


def load_benchmark(path: Path, errors: list[str]) -> dict | None:
    data = _read_toml(path, errors)
    if data is None:
        return None
    where = rel(path)
    known = set(BENCHMARK_STR_FIELDS) | set(BENCHMARK_DATE_FIELDS) | set(BENCHMARK_URL_FIELDS) | {"support"}
    for key in data:
        if key not in known:
            errors.append(f"{where}: unknown key '{key}'")

    bench: dict = {}
    for key in BENCHMARK_STR_FIELDS:
        value = _blank_to_none(data.get(key))
        if value is not None and not isinstance(value, str):
            errors.append(f"{where}: '{key}' must be a string")
            value = None
        bench[key] = value
    for key in BENCHMARK_DATE_FIELDS:
        bench[key] = _check_date(data.get(key), where, key, errors)
    for key in BENCHMARK_URL_FIELDS:
        bench[key] = _check_url(data.get(key), where, key, errors)

    for key in ("id", "name", "description"):
        if not bench[key]:
            errors.append(f"{where}: missing required '{key}'")
    if bench["id"] and not ID_RE.match(bench["id"]):
        errors.append(f"{where}: id '{bench['id']}' must be lowercase [a-z0-9._-]")
    if bench["id"] and path.stem != bench["id"]:
        errors.append(f"{where}: file name must match id '{bench['id']}'")

    support_raw = data.get("support") or {}
    support: dict = {}
    for key in support_raw:
        if key not in set(SUPPORT_FIELDS) | {"evidence_url", "notes"}:
            errors.append(f"{where}: unknown key 'support.{key}'")
    for key in SUPPORT_FIELDS:
        support[key] = _as_list(support_raw.get(key), where, f"support.{key}", errors)
    support["evidence_url"] = _check_url(support_raw.get("evidence_url"), where, "support.evidence_url", errors)
    support["notes"] = _blank_to_none(support_raw.get("notes"))
    bench["support"] = support
    bench["source_file"] = where
    return bench


def _normalize_fields(raw: dict, where: str, errors: list[str], allowed: set[str]) -> dict:
    for key in raw:
        if key not in allowed:
            errors.append(f"{where}: unknown key '{key}'")
    out: dict = {}
    for key in TASK_LIST_FIELDS:
        if key in raw:
            out[key] = _as_list(raw.get(key), where, key, errors)
    return out


def normalize_task(raw: dict, benchmark_id: str, where: str, origin: str, errors: list[str]) -> dict | None:
    """Normalize one task (standalone or Harbor) into the shared schema.

    Each task gets one or more ``configurations``: a configuration is one concrete
    technology setup (e.g. the same dbt task run on DuckDB *or* Snowflake). Fields
    set on a configuration override the task-level value; unset fields inherit.
    """
    base = _normalize_fields(raw, where, errors, TASK_KEYS)
    task: dict = {"benchmark_id": benchmark_id, "origin": origin, "source_file": where}
    for key in TASK_STR_FIELDS:
        value = _blank_to_none(raw.get(key))
        if value is not None and not isinstance(value, str):
            errors.append(f"{where}: '{key}' must be a string")
            value = None
        task[key] = value
    for key in ("source_url", "evidence_url"):
        task[key] = _check_url(task[key], where, key, errors)

    if not task["task_id"]:
        errors.append(f"{where}: missing required 'task_id'")
        return None
    where = f"{where} [{task['task_id']}]"
    task["verification"] = task["verification"] or "unknown"
    if task["verification"] not in VERIFICATION:
        errors.append(f"{where}: verification must be one of {VERIFICATION}, got {task['verification']!r}")
    if task["verification"] == "verified" and not (task["source_url"] or task["evidence_url"]):
        errors.append(f"{where}: verified tasks need a source_url or evidence_url")

    for key in TASK_LIST_FIELDS:
        task[key] = base.get(key, [])

    raw_configs = raw.get("configurations") or [{}]
    if not isinstance(raw_configs, list):
        errors.append(f"{where}: 'configurations' must be an array of tables")
        raw_configs = [{}]
    configs = []
    for i, rc in enumerate(raw_configs):
        cwhere = f"{where} configuration {i + 1}"
        if not isinstance(rc, dict):
            errors.append(f"{cwhere}: must be a table")
            continue
        overrides = _normalize_fields(rc, cwhere, errors, CONFIG_KEYS)
        cfg = {"label": _blank_to_none(rc.get("label")), "notes": _blank_to_none(rc.get("notes"))}
        for key in TASK_LIST_FIELDS:
            cfg[key] = overrides.get(key, task[key])
        cfg["verification"] = _blank_to_none(rc.get("verification")) or task["verification"]
        if cfg["verification"] not in VERIFICATION:
            errors.append(f"{cwhere}: invalid verification {cfg['verification']!r}")
        cfg["evidence_url"] = _check_url(rc.get("evidence_url"), cwhere, "evidence_url", errors) or task["evidence_url"]
        for method in cfg["interaction_method"]:
            if method not in INTERACTION_METHODS:
                errors.append(f"{cwhere}: interaction_method {method!r} not in {INTERACTION_METHODS}")
        for key in cfg["inferred_fields"]:
            if key not in TECH_LIST_FIELDS:
                errors.append(f"{cwhere}: inferred_fields entry {key!r} is not a technology field")
        configs.append(cfg)
    task["configurations"] = configs
    return task


def load_standalone_tasks(path: Path, errors: list[str]) -> list[dict]:
    data = _read_toml(path, errors)
    if data is None:
        return []
    where = rel(path)
    for key in data:
        if key not in ("benchmark_id", "tasks"):
            errors.append(f"{where}: unknown top-level key '{key}'")
    benchmark_id = data.get("benchmark_id")
    if not benchmark_id:
        errors.append(f"{where}: missing top-level 'benchmark_id'")
        return []
    tasks = []
    for raw in data.get("tasks", []):
        task = normalize_task(raw, benchmark_id, where, "standalone", errors)
        if task:
            tasks.append(task)
    return tasks


def load_harbor_task(path: Path, errors: list[str]) -> dict | None:
    """Read ``[metadata.technology]`` from a Harbor ``task.toml``.

    ``task_id`` defaults to the task directory name; ``benchmark_id`` is required.
    Tasks without a ``[metadata.technology]`` table are skipped silently so that a
    whole Harbor dataset can be pointed at without annotating every task.
    """
    data = _read_toml(path, errors)
    if data is None:
        return None
    tech = (data.get("metadata") or {}).get("technology")
    if tech is None:
        return None
    where = rel(path)
    tech = dict(tech)
    benchmark_id = tech.pop("benchmark_id", None)
    if not benchmark_id:
        errors.append(f"{where}: [metadata.technology] needs 'benchmark_id'")
        return None
    tech.setdefault("task_id", path.parent.name)
    return normalize_task(tech, benchmark_id, where, "harbor", errors)


def _check_vocabulary(tasks: list[dict], errors: list[str]) -> None:
    """Flag values that differ only by case/spacing (e.g. 'duckdb' vs 'DuckDB')."""
    for key in TECH_LIST_FIELDS:
        seen: dict[str, str] = {}
        for task in tasks:
            for cfg in task["configurations"]:
                for value in cfg[key]:
                    norm = re.sub(r"[\s_-]+", "", value.lower())
                    if norm in seen and seen[norm] != value:
                        errors.append(
                            f"{task['source_file']} [{task['task_id']}]: '{key}' value {value!r} "
                            f"conflicts with {seen[norm]!r}; use one spelling"
                        )
                    seen.setdefault(norm, value)


def load_catalogue(
    benchmarks_dir: Path = ROOT / "data" / "benchmarks",
    tasks_dir: Path = ROOT / "data" / "tasks",
    harbor_dirs: list[Path] | None = None,
) -> Catalogue:
    if harbor_dirs is None:
        harbor_dirs = [ROOT / "data" / "harbor"]
    cat = Catalogue()
    errors = cat.errors

    for path in sorted(benchmarks_dir.glob("*.toml")):
        bench = load_benchmark(path, errors)
        if bench:
            cat.benchmarks.append(bench)
    ids = [b["id"] for b in cat.benchmarks]
    for dup in {i for i in ids if ids.count(i) > 1}:
        errors.append(f"duplicate benchmark id '{dup}'")

    for path in sorted(tasks_dir.glob("*.toml")):
        cat.tasks.extend(load_standalone_tasks(path, errors))
    for hdir in harbor_dirs:
        for path in sorted(hdir.rglob("task.toml")):
            task = load_harbor_task(path, errors)
            if task:
                cat.tasks.append(task)

    known = set(ids)
    seen = set()
    for task in cat.tasks:
        key = (task["benchmark_id"], task["task_id"])
        if task["benchmark_id"] not in known:
            errors.append(f"{task['source_file']} [{task['task_id']}]: unknown benchmark_id '{task['benchmark_id']}'")
        if key in seen:
            errors.append(f"{task['source_file']}: duplicate task '{task['benchmark_id']}/{task['task_id']}'")
        seen.add(key)
    _check_vocabulary(cat.tasks, errors)
    return cat


def to_json_document(cat: Catalogue) -> dict:
    counts = {status: 0 for status in VERIFICATION}
    for task in cat.tasks:
        counts[task["verification"]] = counts.get(task["verification"], 0) + 1
    tasks = sorted(cat.tasks, key=lambda t: (t["benchmark_id"], t["task_id"]))
    return {
        "schema_version": SCHEMA_VERSION,
        "fields": {
            "technology": list(TECH_LIST_FIELDS),
            "verification": list(VERIFICATION),
            "interaction_method": list(INTERACTION_METHODS),
        },
        "stats": {
            "benchmarks": len(cat.benchmarks),
            "tasks": len(tasks),
            "configurations": sum(len(t["configurations"]) for t in tasks),
            "by_verification": counts,
        },
        "benchmarks": sorted(cat.benchmarks, key=lambda b: b["name"].lower()),
        "tasks": tasks,
    }

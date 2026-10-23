// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/matrix.js");

const cfg = (o) => Object.assign({
  engine: [], client_application: [], table_format: [], catalogue: [], storage_format: [],
  verification: "verified", inferred_fields: [],
}, o);

const benchmarks = [
  { id: "a", name: "A", support: { engine: ["Snowflake", "MySQL"] } },
  { id: "b", name: "B", support: { engine: [] } },
];
const tasks = [
  // One task, two output formats and two clients: still one task in a cell.
  { benchmark_id: "a", task_id: "t1", configurations: [cfg({ engine: ["DuckDB"], client_application: ["dbt CLI", "Terminal"], catalogue: ["DuckDB native"], storage_format: ["DuckDB database file"], output_formats: ["CSV", "Parquet"] })] },
  // Same task in two configurations on the same engine: counted once.
  { benchmark_id: "a", task_id: "t2", configurations: [
    cfg({ engine: ["DuckDB"], catalogue: ["DuckDB native"], storage_format: ["DuckDB database file"] }),
    cfg({ engine: ["DuckDB"], catalogue: ["DuckDB native"], storage_format: ["DuckDB database file"] }),
    cfg({ engine: ["Snowflake"], catalogue: ["Snowflake native"] }),
  ] },
  { benchmark_id: "b", task_id: "t3", configurations: [cfg({ engine: [], verification: "illustrative" })] },
];

test("engine pivot aggregates distinct catalogue/storage combinations", () => {
  const configs = M.flattenConfigurations(tasks);
  const { columns, rows } = M.pivot(benchmarks, configs, M.VIEWS.engine);
  assert.deepEqual(columns, ["DuckDB", "Snowflake", "MySQL", "Unknown"]);
  const a = rows[0].cells;
  assert.equal(a.DuckDB.count, 2);
  assert.deepEqual(a.DuckDB.values, [{ label: "DuckDB native / DuckDB database file", count: 2 }]);
  assert.equal(a.Snowflake.text, "Snowflake native / Unknown (1)");
  assert.equal(a.Snowflake.supported, true);
});

test("benchmark-level support is distinct from task-level usage", () => {
  const { rows } = M.pivot(benchmarks, M.flattenConfigurations(tasks), M.VIEWS.engine);
  assert.equal(rows[0].cells.MySQL.count, 0);
  assert.equal(rows[0].cells.MySQL.supported, true);
  assert.equal(rows[1].cells.MySQL.supported, false);
  assert.equal(rows[1].cells.DuckDB.count, 0); // empty cell
});

test("multi-valued column field counts the task in each column once", () => {
  const { rows } = M.pivot(benchmarks, M.flattenConfigurations(tasks), M.VIEWS.client);
  assert.equal(rows[0].cells["dbt CLI"].count, 1);
  assert.equal(rows[0].cells.Terminal.count, 1);
  assert.equal(rows[0].cells.Unknown.count, 1); // t2 has no client
});

test("status filter keeps illustrative tasks out by default", () => {
  const configs = M.filterConfigurations(M.flattenConfigurations(tasks), { statuses: ["verified", "inferred"] });
  assert.ok(configs.every((c) => c.cfg.verification !== "illustrative"));
  const { rows } = M.pivot(benchmarks, configs, M.VIEWS.engine);
  assert.equal(rows[1].cells.Unknown, undefined); // column disappears when its only task is filtered out
});

test("search matches all terms case-insensitively", () => {
  assert.ok(M.matches("Spider 2.0 Snowflake native", "snowflake spider"));
  assert.ok(!M.matches("Spider 2.0", "bird"));
  assert.ok(M.matches("anything", ""));
});

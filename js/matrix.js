/*
 * Generic pivot logic shared by every summary view.
 * Pure functions, no DOM: loaded as a classic browser script (window.Matrix)
 * and via require() in the Node tests.
 */
(function (root) {
  "use strict";

  var UNKNOWN = "Unknown";

  function joinOrUnknown(values) {
    return values && values.length ? values.join(" + ") : UNKNOWN;
  }

  // Each pivot view: which configuration field becomes the dynamic columns,
  // how a configuration is summarised inside a cell, and which benchmark-level
  // `support` list marks a column as claimed by the benchmark.
  var VIEWS = {
    engine: {
      label: "Benchmark × Engine",
      columnField: "engine",
      columnTitle: "Execution engine",
      valueTitle: "Catalogue / storage",
      supportField: "engine",
      cellValue: function (cfg) {
        return joinOrUnknown(cfg.catalogue) + " / " + joinOrUnknown(cfg.storage_format);
      },
    },
    client: {
      label: "Benchmark × Client",
      columnField: "client_application",
      columnTitle: "Client application",
      valueTitle: "Engine",
      supportField: "client_application",
      cellValue: function (cfg) {
        return joinOrUnknown(cfg.engine);
      },
    },
    table_format: {
      label: "Benchmark × Table format",
      columnField: "table_format",
      columnTitle: "Table format",
      valueTitle: "Engine",
      supportField: "table_format",
      cellValue: function (cfg) {
        return joinOrUnknown(cfg.engine);
      },
    },
  };

  /** Flatten tasks into one record per task configuration. */
  function flattenConfigurations(tasks) {
    var out = [];
    tasks.forEach(function (task) {
      task.configurations.forEach(function (cfg, i) {
        out.push({
          key: task.benchmark_id + "/" + task.task_id + "#" + i,
          taskKey: task.benchmark_id + "/" + task.task_id,
          index: i,
          task: task,
          cfg: cfg,
        });
      });
    });
    return out;
  }

  function filterConfigurations(configs, opts) {
    opts = opts || {};
    return configs.filter(function (c) {
      if (opts.statuses && opts.statuses.indexOf(c.cfg.verification) === -1) return false;
      if (opts.benchmarks && opts.benchmarks.indexOf(c.task.benchmark_id) === -1) return false;
      return true;
    });
  }

  function columnValues(cfg, field) {
    var values = cfg[field] || [];
    return values.length ? values : [UNKNOWN];
  }

  /**
   * Pivot benchmarks (rows) against the distinct values of view.columnField.
   *
   * Cell counts are distinct tasks, never configurations × values: a task with
   * two output formats or two clients is still one task in a cell, and each
   * value label inside a cell counts distinct tasks as well.
   */
  function pivot(benchmarks, configs, view) {
    var cells = {}; // benchmarkId -> column -> cell
    var columnBenchmarks = {}; // column -> Set(benchmarkId) with task evidence
    var supportColumns = {}; // column -> Set(benchmarkId) claimed at benchmark level

    configs.forEach(function (c) {
      var bid = c.task.benchmark_id;
      var label = view.cellValue(c.cfg);
      columnValues(c.cfg, view.columnField).forEach(function (col) {
        var row = (cells[bid] = cells[bid] || {});
        var cell = (row[col] = row[col] || {
          taskKeys: new Set(),
          values: new Map(),
          configKeys: [],
          statuses: new Set(),
        });
        cell.taskKeys.add(c.taskKey);
        if (!cell.values.has(label)) cell.values.set(label, new Set());
        cell.values.get(label).add(c.taskKey);
        cell.configKeys.push(c.key);
        cell.statuses.add(c.cfg.verification);
        (columnBenchmarks[col] = columnBenchmarks[col] || new Set()).add(bid);
      });
    });

    benchmarks.forEach(function (b) {
      var claimed = (b.support && b.support[view.supportField]) || [];
      claimed.forEach(function (col) {
        (supportColumns[col] = supportColumns[col] || new Set()).add(b.id);
      });
    });

    var allColumns = new Set(Object.keys(columnBenchmarks).concat(Object.keys(supportColumns)));
    var columns = Array.from(allColumns).sort(function (a, b) {
      if (a === UNKNOWN) return 1;
      if (b === UNKNOWN) return -1;
      var na = columnBenchmarks[a] ? columnBenchmarks[a].size : 0;
      var nb = columnBenchmarks[b] ? columnBenchmarks[b].size : 0;
      if (na !== nb) return nb - na;
      return a.localeCompare(b);
    });

    var rows = benchmarks.map(function (b) {
      var row = { benchmark: b, cells: {} };
      columns.forEach(function (col) {
        var cell = cells[b.id] && cells[b.id][col];
        var supported = !!(supportColumns[col] && supportColumns[col].has(b.id));
        row.cells[col] = summariseCell(cell, supported);
      });
      return row;
    });
    return { columns: columns, rows: rows };
  }

  function summariseCell(cell, supported) {
    if (!cell) {
      return { count: 0, values: [], configKeys: [], statuses: [], supported: supported, text: supported ? "benchmark-level support" : "" };
    }
    var values = Array.from(cell.values.entries())
      .map(function (e) { return { label: e[0], count: e[1].size }; })
      .sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label); });
    return {
      count: cell.taskKeys.size,
      values: values,
      configKeys: cell.configKeys,
      statuses: Array.from(cell.statuses).sort(),
      supported: supported,
      text: values.map(function (v) { return v.label + " (" + v.count + ")"; }).join("; "),
    };
  }

  /** Free-text match used by the search box. */
  function matches(text, query) {
    if (!query) return true;
    text = String(text || "").toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every(function (term) { return text.indexOf(term) !== -1; });
  }

  var api = {
    UNKNOWN: UNKNOWN,
    VIEWS: VIEWS,
    joinOrUnknown: joinOrUnknown,
    flattenConfigurations: flattenConfigurations,
    filterConfigurations: filterConfigurations,
    pivot: pivot,
    matches: matches,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Matrix = api;
})(this);

/* Pure, source-backed engine coverage ranking. No model or speed scores. */
(function (root) {
  "use strict";
  function build(doc, options) {
    options = options || {};
    var research = doc.leaderboard || {};
    var toolMode = options.subject === "tools";
    var subjectKey = toolMode ? "tool" : "engine";
    var technologyField = toolMode ? "tools" : "engine";
    var engines = research[toolMode ? "tools" : "engines"] || [];
    var aliases = new Map();
    engines.forEach(function (engine) {
      [engine.name].concat(engine.aliases || []).forEach(function (name) {
        aliases.set(name.toLowerCase().trim(), engine.name);
      });
    });
    var selected = options.benchmarkIds ? new Set(options.benchmarkIds) : null;
    var benchmarks = new Map((doc.benchmarks || []).map(function (b) { return [b.id, b]; }));
    var rows = new Map(engines.map(function (e) { return [e.name, { engine: e, pairs: new Map(), leads: [] }]; }));
    function rowFor(name) {
      return rows.get(aliases.get(String(name).toLowerCase().trim()));
    }
    function add(name, benchmarkId, source) {
      var row = rowFor(name), benchmark = benchmarks.get(benchmarkId);
      if (!row || !benchmark || (selected && !selected.has(benchmarkId)) || !source.url) return;
      if (options.mode === "verified" && source.kind !== "verified-task") return;
      if (!row.pairs.has(benchmarkId)) row.pairs.set(benchmarkId, { benchmark: benchmark, sources: [] });
      var pair = row.pairs.get(benchmarkId);
      if (!pair.sources.some(function (s) { return s.kind === source.kind && s.url === source.url && s.taskKey === source.taskKey; })) {
        pair.sources.push(source);
      }
    }
    (doc.benchmarks || []).forEach(function (b) {
      ((b.support || {})[technologyField] || []).forEach(function (name) {
        add(name, b.id, { kind: "documentation", url: b.support.evidence_url, notes: b.support.notes || "Benchmark-level support claim." });
      });
    });
    (research[toolMode ? "tool_evidence" : "evidence"] || []).forEach(function (e) {
      if (e.kind === "environment" || e.kind === "planned") {
        var row = rowFor(e[subjectKey]);
        if (row && benchmarks.has(e.benchmark_id) && (!selected || selected.has(e.benchmark_id))) row.leads.push(e);
      } else {
        add(e[subjectKey], e.benchmark_id, { kind: e.kind, url: e.evidence_url, notes: e.notes });
      }
    });
    (doc.tasks || []).forEach(function (task) {
      (task.configurations || []).forEach(function (cfg) {
        if (cfg.verification !== "verified" && cfg.verification !== "inferred") return;
        var verified = cfg.verification === "verified" && (cfg.inferred_fields || []).indexOf(technologyField) === -1;
        (cfg[technologyField] || []).forEach(function (name) {
          add(name, task.benchmark_id, {
            kind: verified ? "verified-task" : "inferred-task",
            url: cfg.evidence_url || task.evidence_url || task.source_url,
            taskKey: task.benchmark_id + "/" + task.task_id,
            taskId: task.task_id,
            notes: cfg.notes || task.notes || "Task metadata annotation.",
          });
        });
      });
    });
    var result = Array.from(rows.values()).map(function (row) {
      var verifiedTasks = new Set(), inferredTasks = new Set();
      row.benchmarks = Array.from(row.pairs.values()).sort(function (a, b) { return a.benchmark.name.localeCompare(b.benchmark.name); });
      delete row.pairs;
      row.taskBenchmarks = 0;
      row.benchmarks.forEach(function (pair) {
        pair.taskBacked = pair.sources.some(function (s) { return s.kind === "verified-task" || s.kind === "inferred-task"; });
        if (pair.taskBacked) row.taskBenchmarks += 1;
        pair.sources.forEach(function (s) {
          if (s.kind === "verified-task") verifiedTasks.add(s.taskKey);
          if (s.kind === "inferred-task") inferredTasks.add(s.taskKey);
        });
        pair.sources.sort(function (a, b) {
          var weight = { "verified-task": 0, "inferred-task": 1, runtime: 2, documentation: 3 };
          return weight[a.kind] - weight[b.kind] || a.url.localeCompare(b.url);
        });
      });
      verifiedTasks.forEach(function (k) { inferredTasks.delete(k); });
      row.coverage = row.benchmarks.length;
      row.supportOnly = row.coverage - row.taskBenchmarks;
      row.verifiedTasks = verifiedTasks.size;
      row.inferredTasks = inferredTasks.size;
      return row;
    });
    result.sort(function (a, b) { return b.coverage - a.coverage || a.engine.name.localeCompare(b.engine.name); });
    var lastCoverage = -1, rank = null;
    result.forEach(function (row, index) {
      if (row.coverage && row.coverage !== lastCoverage) { rank = index + 1; lastCoverage = row.coverage; }
      row.rank = row.coverage ? rank : null;
    });
    return result;
  }
  function csv(rows, subject) {
    var fields = ["Rank", subject === "tools" ? "Tool" : "Engine", "Category", "License", "Benchmarks", "Task-backed benchmarks", "Support-only benchmarks", "Verified tasks", "Inferred tasks", "Benchmark names", "Sources"];
    var lines = rows.map(function (r) {
      return [r.rank || "", r.engine.name, r.engine.category, r.engine.license, r.coverage, r.taskBenchmarks, r.supportOnly, r.verifiedTasks, r.inferredTasks,
        r.benchmarks.map(function (p) { return p.benchmark.name; }).join("; "),
        r.benchmarks.map(function (p) { return p.sources.map(function (s) { return p.benchmark.name + " [" + s.kind + "]: " + s.url; }).join("; "); }).join("; ")];
    });
    return [fields].concat(lines).map(function (line) {
      return line.map(function (value) {
        var text = String(value);
        if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");
  }
  var api = { build: build, csv: csv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Leaderboard = api;
})(this);

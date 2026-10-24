/* UI wiring: filters, Tabulator tables and the detail panel. */
(function () {
  "use strict";

  var M = window.Matrix;
  var D = window.Data;
  var I = window.Icons;
  function techValues(values, field) { return (values.length ? values : ["Unknown"]).map(function(v){return I.label(v, field);}).join(" "); }
  function techNode(values, field) { var node = el("span"); node.innerHTML = techValues(values, field); return node; }
  var TECH = Object.keys(D.FIELD_LABELS);
  var STATUSES = ["verified", "inferred", "illustrative", "unknown"];

  var state = {
    doc: null,
    configs: [],
    configByKey: {},
    benchById: {},
    view: "engine",
    query: "",
    benchmarks: null, // Set of selected benchmark ids
    statuses: new Set(["verified", "inferred"]),
    hiddenColumns: {}, // view -> Set of hidden column names
  };
  var table = null;

  var $ = function (id) { return document.getElementById(id); };
  // Frozen columns would fill a phone screen, so only freeze on wider viewports.
  var freeze = function () { return window.innerWidth > 720; };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "className") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function link(href, text) {
    return href ? el("a", { href: href, target: "_blank", rel: "noopener", text: text || href }) : null;
  }

  function badge(status) {
    return el("span", { className: "badge " + status, text: status });
  }

  function hidden(view) {
    return (state.hiddenColumns[view] = state.hiddenColumns[view] || new Set());
  }

  // ---------- filters ----------

  function checkboxList(container, items, isChecked, onChange) {
    var body = container.querySelector(".dropdown-body");
    body.innerHTML = "";
    var actions = el("div", { className: "dropdown-actions" }, [
      el("button", { type: "button", "data-act": "all", text: "All" }),
      el("button", { type: "button", "data-act": "none", text: "None" }),
    ]);
    body.appendChild(actions);
    items.forEach(function (item) {
      var input = el("input", { type: "checkbox", value: item.value });
      input.checked = isChecked(item.value);
      body.appendChild(el("label", { className: "check" }, [input, " " + item.label]));
    });
    body.onchange = function () {
      var checked = Array.from(body.querySelectorAll("input:checked")).map(function (i) { return i.value; });
      onChange(checked);
    };
    actions.onclick = function (e) {
      var act = e.target.getAttribute("data-act");
      if (!act) return;
      body.querySelectorAll("input").forEach(function (i) { i.checked = act === "all"; });
      body.onchange();
    };
    var count = container.querySelector(".count");
    var n = items.filter(function (i) { return isChecked(i.value); }).length;
    count.textContent = n === items.length ? "(all)" : "(" + n + "/" + items.length + ")";
  }

  function renderBenchmarkFilter() {
    var items = state.doc.benchmarks.map(function (b) { return { value: b.id, label: b.name }; });
    checkboxList($("benchmark-filter"), items, function (v) { return state.benchmarks.has(v); }, function (checked) {
      state.benchmarks = new Set(checked);
      render();
    });
  }

  function renderStatusFilter() {
    var counts = state.doc.stats.by_verification;
    var items = STATUSES.map(function (s) { return { value: s, label: s + " (" + (counts[s] || 0) + " tasks)" }; });
    checkboxList($("status-filter"), items, function (v) { return state.statuses.has(v); }, function (checked) {
      state.statuses = new Set(checked);
      render();
    });
  }

  function renderColumnFilter(columns, title) {
    var box = $("column-filter");
    box.querySelector(".label").textContent = title;
    var hide = hidden(state.view);
    checkboxList(box, columns.map(function (c) { return { value: c.value, label: c.label }; }),
      function (v) { return !hide.has(v); },
      function (checked) {
        var keep = new Set(checked);
        state.hiddenColumns[state.view] = new Set(columns.map(function (c) { return c.value; }).filter(function (v) { return !keep.has(v); }));
        render();
      });
  }

  // ---------- matrix views ----------

  function currentConfigs() {
    return M.filterConfigurations(state.configs, {
      statuses: Array.from(state.statuses),
      benchmarks: Array.from(state.benchmarks),
    });
  }

  function cellFormatter(cell) {
    var data = cell.getValue() == null ? null : cell.getRow().getData()._cells[cell.getField()];
    if (!data) return "";
    if (!data.count) {
      return data.supported
        ? '<span class="support-mark" title="Claimed at benchmark level; no task-level records yet">◦ benchmark-level</span>'
        : '<span class="empty">—</span>';
    }
    var html = data.values.map(function (v) {
      return '<div class="val"><span>' + v.label.split(" / ").map(function(part){return part.split(" + ").map(function(value){return I.label(value);}).join('<span class="cell-separator">+</span>');}).join('<span class="cell-separator">/</span>') + '</span> <span class="n">' + v.count + "</span></div>";
    }).join("");
    var flags = data.statuses.filter(function (s) { return s !== "verified"; });
    if (flags.length) html += '<div class="flags">' + flags.map(function (s) { return '<span class="dot ' + s + '" title="' + s + ' task(s) in this cell"></span>'; }).join("") + "</div>";
    return '<div class="cellbox">' + html + "</div>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderMatrix(view) {
    var configs = currentConfigs();
    var benchmarks = state.doc.benchmarks.filter(function (b) { return state.benchmarks.has(b.id); });
    var result = M.pivot(benchmarks, configs, view);
    renderColumnFilter(result.columns.map(function (c) { return { value: c, label: c }; }), view.columnTitle + "s");
    var hide = hidden(state.view);
    var columns = result.columns.filter(function (c) { return !hide.has(c); });

    var data = result.rows.map(function (row) {
      var b = row.benchmark;
      var rec = { id: b.id, name: b.name, created: b.created || "", updated: b.updated || "", _cells: {}, _search: b.name + " " + b.id + " " + (b.description || "") };
      columns.forEach(function (col, i) {
        var cell = row.cells[col];
        rec["c" + i] = cell.text;
        rec["n" + i] = cell.count;
        rec._cells["c" + i] = Object.assign({ column: col }, cell);
        rec._search += " " + col + " " + cell.text;
      });
      return rec;
    }).filter(function (r) { return M.matches(r._search, state.query); });

    var cols = [
      { title: "Benchmark", field: "name", frozen: freeze(), width: 205, cssClass: "bench-cell",
        formatter: function (c) { var b = c.getRow().getData(); var n = state.doc.tasks.filter(function(t){return t.benchmark_id === b.id;}).length; return '<button type="button" class="linklike bench-name"><span class="bench-monogram">'+escapeHtml(c.getValue().replace(/[^A-Za-z]/g, '').slice(0,2).toUpperCase())+'</span><span>'+escapeHtml(c.getValue())+'<span class="bench-sub">'+(n ? n+' annotated task'+(n===1?'':'s') : 'Awaiting task annotations')+'</span></span></button>'; },
        cellClick: function (e, c) { showBenchmark(c.getRow().getData().id); } },
      { title: "Created", field: "created", width: 98, formatter: dateFormatter },
      { title: "Updated", field: "updated", width: 98, formatter: dateFormatter },
    ];
    columns.forEach(function (col, i) {
      cols.push({
        title: col, titleFormatter: function(){return I.label(col, view.columnField);}, field: "c" + i, minWidth: 185, maxWidth: 300, cssClass: "wrap matrix-cell", headerHozAlign: "left",
        formatter: cellFormatter,
        sorter: function (a, b, ar, br) { return ar.getData()["n" + i] - br.getData()["n" + i]; },
        headerSortStartingDir: "desc",
        cellClick: function (e, c) { showCell(c.getRow().getData(), "c" + i, view); },
      });
    });

    $("view-help").textContent = "Rows: benchmarks. Columns: " + view.columnTitle.toLowerCase() +
      ". Cells: distinct " + view.valueTitle.toLowerCase() + " combinations with the number of distinct tasks; a task is counted once per cell however many formats or clients it has.";
    drawTable(cols, data, "No benchmarks match the current filters.");
  }

  function dateFormatter(c) {
    return c.getValue() ? escapeHtml(c.getValue()) : '<span class="empty">—</span>';
  }

  // ---------- task explorer ----------

  function renderExplorer() {
    var fieldCols = TECH.map(function (f) { return { value: f, label: D.FIELD_LABELS[f] }; });
    renderColumnFilter(fieldCols, "Columns");
    var hide = hidden("tasks");
    var data = currentConfigs().map(function (c) {
      var t = c.task;
      var b = state.benchById[t.benchmark_id];
      var rec = {
        key: c.key, benchmark: b ? b.name : t.benchmark_id, task_id: t.task_id,
        configuration: c.cfg.label || (t.configurations.length > 1 ? "#" + (c.index + 1) : ""),
        name: t.name || "", verification: c.cfg.verification,
        source_url: t.source_url || "", evidence_url: c.cfg.evidence_url || "", toml: t.source_file,
      };
      TECH.forEach(function (f) { rec[f] = c.cfg[f].join("; "); });
      rec._search = Object.keys(rec).map(function (k) { return rec[k]; }).join(" ");
      return rec;
    }).filter(function (r) { return M.matches(r._search, state.query); });

    var linkFmt = function (c) {
      var v = c.getValue();
      return v ? '<a href="' + escapeHtml(v) + '" target="_blank" rel="noopener">link</a>' : '<span class="empty">—</span>';
    };
    var cols = [
      { title: "Benchmark", field: "benchmark", frozen: freeze(), minWidth: 120, headerFilter: "input" },
      { title: "Task ID", field: "task_id", frozen: freeze(), minWidth: 110, maxWidth: 190, cssClass: "wrap", headerFilter: "input",
        formatter: function (c) { return '<button type="button" class="linklike">' + escapeHtml(c.getValue()) + "</button>"; },
        cellClick: function (e, c) { var d = c.getRow().getData(); showTasks(d.task_id, [d.key]); } },
      { title: "Config", field: "configuration", width: 90, headerFilter: "input" },
      { title: "Task name", field: "name", minWidth: 200, maxWidth: 320, cssClass: "wrap", headerFilter: "input" },
      { title: "Status", field: "verification", width: 100, headerFilter: "list",
        headerFilterParams: { values: [""].concat(STATUSES) },
        formatter: function (c) { return '<span class="badge ' + c.getValue() + '">' + c.getValue() + "</span>"; } },
    ];
    TECH.forEach(function (f) {
      if (hide.has(f)) return;
      cols.push({ title: D.FIELD_LABELS[f], field: f, minWidth: 120, maxWidth: 240, cssClass: "wrap", headerFilter: "input",
        formatter: function (c) { return techValues(c.getValue() ? c.getValue().split("; ") : [], f); } });
    });
    cols.push(
      { title: "Task source", field: "source_url", width: 90, formatter: linkFmt, headerSort: false },
      { title: "Evidence", field: "evidence_url", width: 90, formatter: linkFmt, headerSort: false },
      { title: "TOML", field: "toml", minWidth: 120, headerSort: false,
        formatter: function (c) { return '<a href="' + D.sourceFileUrl(c.getValue()) + '" target="_blank" rel="noopener">' + escapeHtml(c.getValue()) + "</a>"; } }
    );
    $("view-help").textContent = "One row per task configuration (a task run against two engines appears twice). Use the header boxes to filter individual columns.";
    drawTable(cols, data, "No tasks match the current filters.");
  }

  function drawTable(columns, data, placeholder) {
    if (table) table.destroy();
    table = new Tabulator("#table", {
      data: data,
      columns: columns,
      layout: "fitData",
      height: "auto",
      maxHeight: "72vh",
      placeholder: placeholder,
      columnDefaults: { headerTooltip: true, vertAlign: "top" },
      index: data.length && data[0].key ? "key" : "id",
    });
  }

  // ---------- detail panel ----------

  function openPanel(title, nodes) {
    $("detail-title").textContent = title;
    var body = $("detail-body");
    body.innerHTML = "";
    nodes.forEach(function (n) { if (n) body.appendChild(n); });
    $("detail").hidden = false;
    document.body.classList.add("panel-open");
  }

  function closePanel() {
    $("detail").hidden = true;
    document.body.classList.remove("panel-open");
  }

  function showCell(rowData, field, view) {
    var cell = rowData._cells[field];
    var b = state.benchById[rowData.id];
    var nodes = [];
    if (cell.supported) {
      nodes.push(el("p", { className: "note" }, [
        "◦ " + b.name + " claims " + cell.column + " support at benchmark level",
        b.support.evidence_url ? " (" : "", link(b.support.evidence_url, "evidence"), b.support.evidence_url ? ")" : "",
        ". This is separate from task-level usage below.",
      ]));
    }
    if (!cell.count) {
      nodes.push(el("p", { className: "note", text: "No task-level records for this combination under the current status filters." }));
      openPanel(b.name + " × " + cell.column, nodes);
      return;
    }
    nodes.push(el("p", { className: "note", text: view.valueTitle + ": " + cell.text }));
    showTasks(b.name + " × " + cell.column, cell.configKeys, nodes);
  }

  function showTasks(title, configKeys, prefix) {
    var byTask = new Map();
    configKeys.forEach(function (k) {
      var c = state.configByKey[k];
      if (!byTask.has(c.taskKey)) byTask.set(c.taskKey, []);
      byTask.get(c.taskKey).push(c);
    });
    var nodes = (prefix || []).slice();
    nodes.push(el("p", { className: "muted", text: byTask.size + " task" + (byTask.size === 1 ? "" : "s") }));
    byTask.forEach(function (cs) { nodes.push(taskCard(cs[0].task, cs)); });
    openPanel(title, nodes);
  }

  function taskCard(task, configs) {
    var b = state.benchById[task.benchmark_id];
    var card = el("article", { className: "task-card" }, [
      el("h3", {}, [el("code", { text: task.task_id }), " ", badge(task.verification)]),
      task.name ? el("p", { text: task.name }) : null,
      el("p", { className: "muted", text: (b ? b.name : task.benchmark_id) + " · " + (task.origin === "harbor" ? "Harbor task.toml" : "standalone annotation") }),
    ]);
    configs.forEach(function (c) {
      var cfg = c.cfg;
      if (task.configurations.length > 1) {
        card.appendChild(el("h4", {}, ["Configuration: " + (cfg.label || "#" + (c.index + 1)) + " ", cfg.verification !== task.verification ? badge(cfg.verification) : null]));
      }
      var dl = el("dl", { className: "fields" });
      TECH.forEach(function (f) {
        var inferred = cfg.inferred_fields.indexOf(f) !== -1;
        dl.appendChild(el("dt", { text: D.FIELD_LABELS[f] }));
        dl.appendChild(el("dd", {}, [
          techNode(cfg[f], f),
          inferred ? el("span", { className: "badge inferred small", text: "inferred" }) : null,
        ]));
      });
      card.appendChild(dl);
      if (cfg.notes) card.appendChild(el("p", { className: "note", text: cfg.notes }));
      if (cfg.evidence_url && cfg.evidence_url !== task.evidence_url) card.appendChild(el("p", {}, ["Configuration evidence: ", link(cfg.evidence_url)]));
    });
    if (task.notes) card.appendChild(el("p", { className: "note", text: task.notes }));
    card.appendChild(el("ul", { className: "links" }, [
      task.source_url ? el("li", {}, ["Task source: ", link(task.source_url)]) : null,
      task.evidence_url ? el("li", {}, ["Evidence: ", link(task.evidence_url)]) : null,
      el("li", {}, ["Metadata: ", link(D.sourceFileUrl(task.source_file), task.source_file)]),
    ]));
    return card;
  }

  function showBenchmark(id) {
    var b = state.benchById[id];
    var tasks = state.doc.tasks.filter(function (t) { return t.benchmark_id === id; });
    var counts = {};
    tasks.forEach(function (t) { counts[t.verification] = (counts[t.verification] || 0) + 1; });
    var dl = el("dl", { className: "fields" });
    [["Created", b.created, b.created_source], ["Last updated", b.updated, b.updated_source], ["Last verified", b.last_verified]].forEach(function (r) {
      dl.appendChild(el("dt", { text: r[0] }));
      dl.appendChild(el("dd", {}, [r[1] || el("span", { className: "empty", text: "unknown" }), r[2] ? el("span", { className: "muted", text: " — " + r[2] }) : null]));
    });
    var support = el("dl", { className: "fields" });
    ["engine", "client_application", "table_format", "language"].forEach(function (f) {
      if (!b.support[f].length) return;
      support.appendChild(el("dt", { text: D.FIELD_LABELS[f] }));
      support.appendChild(el("dd", {}, [techNode(b.support[f], f)]));
    });
    var nodes = [
      el("p", { text: b.description }),
      dl,
      el("ul", { className: "links" }, [
        b.repo_url ? el("li", {}, ["Repository: ", link(b.repo_url)]) : null,
        b.paper_url ? el("li", {}, ["Paper: ", link(b.paper_url)]) : null,
        b.website_url ? el("li", {}, ["Website: ", link(b.website_url)]) : null,
        b.dataset_url ? el("li", {}, ["Dataset: ", link(b.dataset_url)]) : null,
        el("li", {}, ["Metadata: ", link(D.sourceFileUrl(b.source_file), b.source_file)]),
      ]),
      el("h3", { text: "Benchmark-level technology support" }),
      support.childNodes.length ? support : el("p", { className: "muted", text: "None recorded." }),
      b.support.notes ? el("p", { className: "note", text: b.support.notes }) : null,
      b.support.evidence_url ? el("p", {}, ["Evidence: ", link(b.support.evidence_url)]) : null,
      el("h3", { text: "Task-level records" }),
      el("p", { text: tasks.length ? STATUSES.filter(function (s) { return counts[s]; }).map(function (s) { return counts[s] + " " + s; }).join(", ") : "No task-level records yet." }),
      b.notes ? el("p", { className: "note", text: b.notes }) : null,
    ];
    openPanel(b.name, nodes);
  }

  // ---------- top level ----------

  function renderDirectory() {
    if (table) { table.destroy(); table = null; }
    $("column-filter").hidden = true;
    $("status-filter").hidden = true;
    $("download-csv").hidden = true;
    $("view-help").textContent = "The complete catalogue, including benchmarks awaiting task-level annotations. Open an entry to inspect its sources and documented support.";
    var grid = $("benchmark-grid"); grid.innerHTML = "";
    state.doc.benchmarks.filter(function(b){return state.benchmarks.has(b.id) && M.matches(b.name+" "+b.description+" "+Object.keys(b.support).map(function(k){return b.support[k];}).join(" "), state.query);}).forEach(function(b){
      var n = state.doc.tasks.filter(function(t){return t.benchmark_id===b.id;}).length;
      var button = el("button", {type:"button", text:"View evidence ↗"});
      button.addEventListener("click", function(){showBenchmark(b.id);});
      var technologies = el("div", {className:"card-technologies"});
      technologies.innerHTML = (b.support.engine.length ? techValues(b.support.engine, "engine") : "") + (b.support.language.length ? " " + techValues(b.support.language, "language") : "");
      grid.appendChild(el("article", {className:"benchmark-card"}, [
        el("span", {className:"badge "+(n ? "verified" : "unknown"), text:n ? "TASKS ANNOTATED" : "BENCHMARK-LEVEL"}),
        el("h3", {text:b.name}), el("p", {text:b.description}), technologies,
        el("div", {className:"card-meta"}, [el("span", {text:n ? n+" annotated tasks" : "Task annotations pending"}), button])
      ]));
    });
    if (!grid.children.length) grid.appendChild(el("p", {className:"muted", text:"No benchmarks match the current filters."}));
  }

  function render() {
    var directory = state.view === "benchmarks";
    $("benchmark-grid").hidden = !directory;
    $("table").hidden = directory;
    ["column-filter", "status-filter", "download-csv"].forEach(function(id){$(id).hidden=false;});
    $("section-title").textContent = directory ? "Benchmark directory" : state.view === "tasks" ? "Task explorer" : "Benchmark matrix";
    document.querySelectorAll("[data-view]").forEach(function(button){var active=button.dataset.view===state.view;button.classList.toggle("active", active);button.setAttribute("aria-current", active ? "page" : "false");});
    renderBenchmarkFilter();
    renderStatusFilter();
    if (directory) renderDirectory();
    else if (state.view === "tasks") renderExplorer();
    else renderMatrix(M.VIEWS[state.view]);
  }

  function readHash() {
    var m = /view=([a-z_]+)/.exec(location.hash);
    if (m && (M.VIEWS[m[1]] || m[1] === "tasks" || m[1] === "benchmarks")) state.view = m[1];
    $("view-select").value = state.view;
  }

  function init(doc) {
    state.doc = doc;
    state.configs = M.flattenConfigurations(doc.tasks);
    state.configs.forEach(function (c) { state.configByKey[c.key] = c; });
    doc.benchmarks.forEach(function (b) { state.benchById[b.id] = b; });
    state.benchmarks = new Set(doc.benchmarks.map(function (b) { return b.id; }));
    var s = doc.stats;
    $("stats").textContent = s.benchmarks + " benchmarks · " + s.by_verification.verified + " verified tasks · " +
      s.by_verification.inferred + " inferred · " + s.by_verification.illustrative + " illustrative";

    var engines = new Set(); state.configs.forEach(function(c){c.cfg.engine.forEach(function(v){engines.add(v);});});
    $("metrics").innerHTML = [[s.benchmarks, "Benchmarks in the catalogue", "CATALOGUE"], [s.tasks, "Annotated tasks", "EVIDENCE"], [engines.size, "Execution engines in tasks", "DATA STACK"], [s.configurations, "Technology configurations", "TASK LEVEL"]].map(function(m){return '<div class="metric"><div class="metric-value">'+m[0]+'</div><div class="metric-label">'+m[1]+'</div><span class="metric-note">'+m[2]+'</span></div>';}).join("");
    $("hero-engines").innerHTML = ["Snowflake", "DuckDB", "BigQuery", "Pandas"].map(function(v){return I.icon(v);}).join("");
    document.querySelectorAll("[data-view]").forEach(function(button){button.addEventListener("click", function(){location.hash="view="+button.dataset.view;});});
    readHash();
    window.addEventListener("hashchange", function () { readHash(); closePanel(); render(); });
    $("view-select").addEventListener("change", function (e) {
      state.view = e.target.value;
      history.replaceState(null, "", "#view=" + state.view);
      closePanel();
      render();
    });
    var timer;
    $("search").addEventListener("input", function (e) {
      clearTimeout(timer);
      timer = setTimeout(function () { state.query = e.target.value.trim(); render(); }, 150);
    });
    $("download-csv").addEventListener("click", function () {
      if (table) table.download("csv", "agent-data-bench-" + state.view + ".csv");
    });
    $("detail-close").addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(); });
    document.addEventListener("click", function (e) {
      document.querySelectorAll("details.dropdown[open]").forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
    });
    render();
  }

  D.load().then(init).catch(function (err) {
    $("stats").textContent = "";
    $("table").textContent = "Failed to load catalogue: " + err.message;
  });
})();

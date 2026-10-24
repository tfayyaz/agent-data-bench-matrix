const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/leaderboard.js');
function fixture() {
  return {
    leaderboard: {
      engines: [
        {name:'Pandas', aliases:['pandas'], category:'DataFrame', license:'BSD-3-Clause'},
        {name:'DuckDB', aliases:[], category:'Embedded SQL', license:'MIT'},
        {name:'Polars', aliases:[], category:'DataFrame', license:'MIT'},
      ],
      evidence: [
        {engine:'DuckDB', benchmark_id:'a', kind:'runtime', evidence_url:'https://example.org/runtime'},
        {engine:'Polars', benchmark_id:'a', kind:'environment', evidence_url:'https://example.org/requirements'},
        {engine:'Polars', benchmark_id:'b', kind:'planned', evidence_url:'https://example.org/roadmap'},
      ],
    },
    benchmarks: [
      {id:'a', name:'A', support:{engine:['DuckDB'], evidence_url:'https://example.org/docs'}},
      {id:'b', name:'B', support:{engine:['Pandas'], evidence_url:'https://example.org/b'}},
      {id:'c', name:'C', support:{engine:['Polars']}},
    ],
    tasks: [
      {benchmark_id:'a', task_id:'one', source_url:'https://example.org/task', configurations:[
        {engine:['DuckDB','DuckDB'], verification:'verified'},
        {engine:['DuckDB'], verification:'verified'},
      ]},
      {benchmark_id:'b', task_id:'two', source_url:'https://example.org/task2', configurations:[
        {engine:['pandas'], verification:'verified', inferred_fields:['engine']},
      ]},
      {benchmark_id:'c', task_id:'example', source_url:'https://example.org/example', configurations:[
        {engine:['Polars'], verification:'illustrative'},
      ]},
    ],
  };
}
const byName = rows => Object.fromEntries(rows.map(r=>[r.engine.name,r]));
test('counts each engine/benchmark and task once across configurations and citations',()=>{
  const r=byName(L.build(fixture()));
  assert.equal(r.DuckDB.coverage,1);
  assert.equal(r.DuckDB.verifiedTasks,1);
  assert.equal(r.DuckDB.taskBenchmarks,1);
  assert.equal(r.DuckDB.supportOnly,0);
  assert.equal(r.DuckDB.benchmarks[0].sources.length,3);
});
test('does not credit installed packages, roadmap items, illustrative tasks or unsourced support',()=>{
  const r=byName(L.build(fixture()));
  assert.equal(r.Polars.coverage,0);
  assert.equal(r.Polars.rank,null);
  assert.equal(r.Polars.leads.length,2);
});
test('an inferred engine is not a verified task even when its configuration is verified',()=>{
  const r=byName(L.build(fixture()));
  assert.equal(r.Pandas.coverage,1);
  assert.equal(r.Pandas.verifiedTasks,0);
  assert.equal(r.Pandas.inferredTasks,1);
});
test('verified-only mode excludes support claims and inferred engines',()=>{
  const r=byName(L.build(fixture(),{mode:'verified'}));
  assert.equal(r.DuckDB.coverage,1);
  assert.equal(r.Pandas.coverage,0);
});
test('benchmark selection removes excluded benchmarks and recomputes ranking',()=>{
  const r=byName(L.build(fixture(),{benchmarkIds:['b']}));
  assert.equal(r.Pandas.coverage,1);
  assert.equal(r.Pandas.rank,1);
  assert.equal(r.DuckDB.coverage,0);
  assert.equal(r.Polars.leads.length,1);
});
test('coverage ties share a competition rank with deterministic name ordering',()=>{
  const rows=L.build(fixture());
  assert.deepEqual(rows.map(r=>[r.engine.name,r.rank]),[['DuckDB',1],['Pandas',1],['Polars',null]]);
});
test('inferred and verified versions of the same task count once as verified',()=>{
  const d=fixture();d.tasks[0].configurations.push({engine:['DuckDB'],verification:'inferred'});
  const r=byName(L.build(d));assert.equal(r.DuckDB.verifiedTasks,1);assert.equal(r.DuckDB.inferredTasks,0);
});
test('CSV contains sources, evidence counts and safely escaped values',()=>{
  const d=fixture();d.benchmarks[0].name='A, "quoted"';
  const csv=L.csv(L.build(d));
  assert.match(csv, /A, ""quoted""/);
  assert.match(csv, /https:\/\/example.org\/runtime/);
  assert.match(csv, /Support-only benchmarks/);
  const rows=L.build(d);rows[0].engine.name='=formula';assert.match(L.csv(rows), /'\=formula/);
});

test('tool ranking uses its own inventory and evidence without counting engine-only fields',()=>{
  const d=fixture();
  d.leaderboard.tools=[{name:'Grafana',aliases:[],category:'Observability interface',license:'AGPL-3.0'}];
  d.leaderboard.tool_evidence=[
    {tool:'Grafana',benchmark_id:'a',kind:'runtime',evidence_url:'https://example.org/grafana'},
    {tool:'Grafana',benchmark_id:'b',kind:'environment',evidence_url:'https://example.org/unused'},
  ];
  const rows=L.build(d,{subject:'tools'});
  assert.equal(rows.length,1);assert.equal(rows[0].engine.name,'Grafana');assert.equal(rows[0].coverage,1);assert.equal(rows[0].leads.length,1);
  assert.match(L.csv(rows,'tools'),/"Tool"/);
  assert.ok(!L.build(d).some(r=>r.engine.name==='Grafana'));
});

test('tools inferred from benchmark documentation do not become verified task tool usage',()=>{
  const d=fixture();d.leaderboard.tools=[{name:'Grafana',aliases:[],category:'Interface',license:'AGPL-3.0'}];
  d.tasks[0].configurations=[{engine:['DuckDB'],tools:['Grafana'],verification:'verified',inferred_fields:['tools']}];
  const all=L.build(d,{subject:'tools'})[0];assert.equal(all.coverage,1);assert.equal(all.inferredTasks,1);assert.equal(all.verifiedTasks,0);
  assert.equal(L.build(d,{subject:'tools',mode:'verified'})[0].coverage,0);
});

test('reviewed SRE sources exclude unused bundled Grafana and keep ORCA backend credit',()=>{
  const d=require('../data/generated/catalogue.json');
  const tools=byName(L.build(d,{subject:'tools'}));
  assert.deepEqual(tools.Grafana.benchmarks.map(p=>p.benchmark.id).sort(),['o11y-bench','orca-bench']);
  assert.ok(tools.Grafana.leads.some(e=>e.benchmark_id==='sregym'));
  const engines=byName(L.build(d));
  assert.ok(engines.OpenSearch.benchmarks.some(p=>p.benchmark.id==='orca-bench'));
  assert.ok(!engines.OpenSearch.benchmarks.some(p=>p.benchmark.id==='sregym'));
});

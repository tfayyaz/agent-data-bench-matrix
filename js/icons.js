/* Original geometric SVG pictograms. See docs/icons.md for provenance. */
(function (root) {
  "use strict";
  var shapes = {
    engine: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    snowflake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1M4 14l4 1-1 4M17 5l-1 4 4 1"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 11V9m3 2V7m3 4V8"/>',
    duck: '<path d="M3 14h10v-4a4 4 0 1 1 8 0h2l-3 3c0 6-3 8-8 8-6 0-9-3-9-7Z"/><circle cx="18" cy="9" r=".5"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    catalogue: '<path d="M4 4h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H4ZM13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 3"/>',
    file: '<path d="M5 2h9l5 5v15H5ZM14 2v6h5M8 12h8M8 16h6"/>',
    code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"/>',
    terminal: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m6 9 4 3-4 3m7 0h5"/>',
    unknown: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2m0 3h.01"/>',
    none: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>'
  };
  function escape(s) { return String(s).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function icon(value, field) {
    var v = String(value).toLowerCase(), type = 'file', color = 'slate';
    if (/catalogue/.test(field || '') || /native|catalog|polaris|glue|unity/.test(v)) { type='catalogue'; color='violet'; }
    else if (/snowflake/.test(v)) { type='snowflake';color='blue'; }
    else if (/bigquery/.test(v)) { type='search';color='blue'; }
    else if (/duckdb/.test(v)) { type='duck';color='amber'; }
    else if (/pandas/.test(v)) { type='grid';color='violet'; }
    else if (/sqlite|postgres|mysql|engine/.test(v) || field==='engine') { type='engine';color='teal'; }
    else if (/iceberg|delta|hudi|ducklake/.test(v) || field==='table_format') { type='layers';color='teal'; }
    else if (/csv|parquet|json|table|excel/.test(v)) { type='grid';color='teal'; }
    else if (/python|sql|jinja/.test(v)) { type='code';color='violet'; }
    else if (/cli|code|connector|terminal/.test(v)) { type='terminal';color='slate'; }
    if(v==='none') {type='none';color='slate';} if(v==='unknown'||!v) {type='unknown';color='slate';}
    return '<span class="tech-icon '+color+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+shapes[type]+'</svg></span>';
  }
  function label(value, field) { return '<span class="tech-label">'+icon(value,field)+'<span>'+escape(value)+'</span></span>'; }
  root.Icons={icon:icon,label:label};
})(this);

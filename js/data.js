/* Loads the generated catalogue (never the raw TOML) and exposes field metadata. */
(function (root) {
  "use strict";

  var REPO_URL = "https://github.com/tfayyaz/agent-data-bench-matrix";
  var CATALOGUE_URL = "data/generated/catalogue.json"; // relative: works under /agent-data-bench-matrix/

  var FIELD_LABELS = {
    client_application: "Client application",
    interaction_method: "Interaction method",
    language: "Core language",
    engine: "Execution engine",
    managed_service: "Managed service",
    table_format: "Table format",
    source_formats: "Source data formats",
    output_formats: "Output data formats",
    storage_format: "Underlying storage",
    catalogue: "Catalogue",
    tools: "OSS tools",
  };

  function load() {
    return fetch(CATALOGUE_URL, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("Could not load " + CATALOGUE_URL + " (" + res.status + ")");
      return res.json();
    });
  }

  function sourceFileUrl(path) {
    return REPO_URL + "/blob/main/" + path;
  }

  root.Data = {
    REPO_URL: REPO_URL,
    FIELD_LABELS: FIELD_LABELS,
    load: load,
    sourceFileUrl: sourceFileUrl,
  };
})(this);

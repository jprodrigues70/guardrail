(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  function exportConfigAsJson(config, filename) {
    var blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });

    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename || "pmfm-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importConfigFromFile(file, onSuccess, onError) {
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
      } catch (error) {
        onError(error);
      }
    };

    reader.readAsText(file);
  }

  root.importExport = {
    exportConfigAsJson: exportConfigAsJson,
    importConfigFromFile: importConfigFromFile,
  };
})();

(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  /**
   * Exporta a configuração para um arquivo JSON.
   *
   * Cria um Blob temporário, dispara o download e libera recursos em seguida.
   *
   * @param {object} config Configuração que será serializada.
   * @param {string} filename Nome sugerido para o arquivo baixado.
   */
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

  /**
   * Importa configuração a partir de um arquivo JSON selecionado.
   *
   * @param {File} file Arquivo enviado pela pessoa usuária.
   * @param {Function} onSuccess Callback executado com o JSON parseado.
   * @param {Function} onError Callback executado quando o conteúdo é inválido.
   */
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

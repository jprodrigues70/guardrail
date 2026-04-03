(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  /**
   * Cria uma API de acesso ao storage com suporte a migração legada.
   *
   * @param {object} options Dependências e chaves de armazenamento.
   * @param {string} options.storageKey Chave principal da configuração atual.
   * @param {string} options.legacyKey Chave legada usada para migração.
   * @param {Function} options.normalizeConfig Função de normalização da configuração.
   * @param {Function} options.buildConfigFromLegacy Construtor da configuração a partir do formato antigo.
   * @returns {{saveConfig: Function, loadConfig: Function, onConfigChanged: Function}} API de persistência.
   */
  function createStorageApi(options) {
    var storageKey = options.storageKey;
    var legacyKey = options.legacyKey;
    var normalizeConfig = options.normalizeConfig;
    var buildConfigFromLegacy = options.buildConfigFromLegacy;

    /**
     * Salva a configuração já normalizada no armazenamento sincronizado.
     *
     * @param {object} config Configuração a ser persistida.
     * @param {Function} callback Callback opcional pós-gravação.
     */
    function saveConfig(config, callback) {
      chrome.storage.sync.set(
        (function () {
          var payload = {};
          payload[storageKey] = normalizeConfig(config);
          return payload;
        })(),
        callback,
      );
    }

    /**
     * Carrega a configuração principal e aplica migração legada quando necessário.
     *
     * @param {Function} callback Recebe a configuração final normalizada.
     */
    function loadConfig(callback) {
      var defaults = {};
      defaults[storageKey] = null;
      defaults[legacyKey] = [];

      chrome.storage.sync.get(defaults, function (result) {
        if (result[storageKey]) {
          callback(normalizeConfig(result[storageKey]));
          return;
        }

        var migrated = buildConfigFromLegacy(result[legacyKey]);
        saveConfig(migrated, function () {
          callback(normalizeConfig(migrated));
        });
      });
    }

    /**
     * Escuta mudanças relevantes no storage da extensão.
     *
     * @param {Function} handler Callback acionado quando há alteração de configuração.
     */
    function onConfigChanged(handler) {
      chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName !== "sync") return;
        if (!changes[storageKey] && !changes[legacyKey]) return;
        handler(changes);
      });
    }

    return {
      saveConfig: saveConfig,
      loadConfig: loadConfig,
      onConfigChanged: onConfigChanged,
    };
  }

  root.storage = {
    createStorageApi: createStorageApi,
  };
})();

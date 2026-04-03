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
     * Verifica se o erro recebido indica contexto de extensão invalidado.
     *
     * Esse cenário ocorre com frequência quando a extensão é recarregada,
     * mas a aba ainda executa uma instância antiga do content script.
     *
     * @param {Error|object|string} error Erro capturado.
     * @returns {boolean} Verdadeiro quando o contexto foi invalidado.
     */
    function isContextInvalidatedError(error) {
      var message = "";

      if (typeof error === "string") {
        message = error;
      } else if (error && typeof error.message === "string") {
        message = error.message;
      }

      return message.indexOf("Extension context invalidated") !== -1;
    }

    /**
     * Verifica se a API de storage está disponível no contexto atual.
     *
     * @returns {boolean} Verdadeiro quando é seguro usar chrome.storage.sync.
     */
    function canUseStorageApi() {
      return Boolean(
        typeof chrome === "object" &&
        chrome &&
        chrome.storage &&
        chrome.storage.sync,
      );
    }

    /**
     * Executa callback somente quando ele é uma função válida.
     *
     * @param {Function} callback Callback opcional.
     * @param {*} arg Argumento opcional para callback.
     */
    function safeCall(callback, arg) {
      if (typeof callback === "function") callback(arg);
    }

    /**
     * Salva a configuração já normalizada no armazenamento sincronizado.
     *
     * @param {object} config Configuração a ser persistida.
     * @param {Function} callback Callback opcional pós-gravação.
     */
    function saveConfig(config, callback) {
      if (!canUseStorageApi()) {
        safeCall(callback);
        return;
      }

      try {
        chrome.storage.sync.set(
          (function () {
            var payload = {};
            payload[storageKey] = normalizeConfig(config);
            return payload;
          })(),
          function () {
            if (
              chrome.runtime &&
              chrome.runtime.lastError &&
              isContextInvalidatedError(chrome.runtime.lastError)
            ) {
              return;
            }

            safeCall(callback);
          },
        );
      } catch (error) {
        if (isContextInvalidatedError(error)) return;
        throw error;
      }
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

      if (!canUseStorageApi()) {
        safeCall(callback, normalizeConfig(buildConfigFromLegacy([])));
        return;
      }

      try {
        chrome.storage.sync.get(defaults, function (result) {
          if (
            chrome.runtime &&
            chrome.runtime.lastError &&
            isContextInvalidatedError(chrome.runtime.lastError)
          ) {
            return;
          }

          var data = result || defaults;

          if (data[storageKey]) {
            safeCall(callback, normalizeConfig(data[storageKey]));
            return;
          }

          var migrated = buildConfigFromLegacy(data[legacyKey]);
          saveConfig(migrated, function () {
            safeCall(callback, normalizeConfig(migrated));
          });
        });
      } catch (error) {
        if (isContextInvalidatedError(error)) return;
        throw error;
      }
    }

    /**
     * Escuta mudanças relevantes no storage da extensão.
     *
     * @param {Function} handler Callback acionado quando há alteração de configuração.
     */
    function onConfigChanged(handler) {
      if (!canUseStorageApi()) return;

      try {
        chrome.storage.onChanged.addListener(function (changes, areaName) {
          if (areaName !== "sync") return;
          if (!changes[storageKey] && !changes[legacyKey]) return;
          safeCall(handler, changes);
        });
      } catch (error) {
        if (isContextInvalidatedError(error)) return;
        throw error;
      }
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

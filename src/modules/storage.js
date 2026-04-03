(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  function createStorageApi(options) {
    var storageKey = options.storageKey;
    var legacyKey = options.legacyKey;
    var normalizeConfig = options.normalizeConfig;
    var buildConfigFromLegacy = options.buildConfigFromLegacy;

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

(function () {
  "use strict";

  var modules = globalThis.GuardRailModules || {};
  var schema = modules.configSchema;
  var storageModule = modules.storage;
  var ruleMatcher = modules.ruleMatcher;
  var profilesModule = modules.profiles;
  var uiRender = modules.uiRender;

  if (
    !schema ||
    !storageModule ||
    !ruleMatcher ||
    !profilesModule ||
    !uiRender
  ) {
    throw new Error("GuardRail modules were not loaded before content.js");
  }

  var BORDER_ID = "pmfm-page-border-overlay";
  var BANNER_ID = "pmfm-top-banner";
  var URL_CHANGE_EVENT = "pmfm:urlchange";
  var URL_POLL_INTERVAL_MS = 500;
  var BODY_BASE_PADDING_BOTTOM_ATTR = "data-pmfm-base-padding-bottom";
  var BODY_INLINE_PADDING_BOTTOM_ATTR = "data-pmfm-inline-padding-bottom";

  var lastKnownHref = window.location.href;
  var urlPollTimer = null;
  var currentContentConfig = null;
  var lastSourceFingerprint = "";

  var storageApi = storageModule.createStorageApi({
    storageKey: schema.STORAGE_KEY,
    legacyKey: schema.LEGACY_PREFIX_KEY,
    normalizeConfig: schema.normalizeConfig,
    buildConfigFromLegacy: schema.buildConfigFromLegacy,
  });

  var pageRenderer = uiRender.createPageAlertRenderer({
    borderId: BORDER_ID,
    bannerId: BANNER_ID,
    bodyBasePaddingBottomAttr: BODY_BASE_PADDING_BOTTOM_ATTR,
    bodyInlinePaddingBottomAttr: BODY_INLINE_PADDING_BOTTOM_ATTR,
  });

  /**
   * Calcula uma impressão digital dos valores de fontes não-URL das regras.
   *
   * Usada para detectar mudanças em localStorage ou cookies entre ciclos
   * de polling, disparando reavaliação apenas quando necessário.
   *
   * @param {object} config Configuração normalizada.
   * @returns {string} Fingerprint concatenado dos valores lidos.
   */
  function computeSourceFingerprint(config) {
    if (!config || !config.rules || !config.rules.length) return "";
    var parts = [];
    for (var i = 0; i < config.rules.length; i++) {
      var rule = config.rules[i];
      if (!rule.source || rule.source === "url") continue;
      var val = ruleMatcher.readSourceValue(rule);
      parts.push(
        rule.source + ":" + rule.sourceKey + "=" + (val === null ? "\0" : val),
      );
    }
    return parts.join("|");
  }

  /**
   * Aplica a configuração da extensão na página atual.
   *
   * A função identifica a primeira regra correspondente à URL, resolve o
   * estilo do perfil e então desenha ou remove borda e banner conforme
   * preferências ativas.
   *
   * @param {object} config Configuração normalizada carregada do storage.
   */
  function applyConfig(config) {
    currentContentConfig = config;
    lastSourceFingerprint = computeSourceFingerprint(config);
    var matchDetails = ruleMatcher.getMatchDetails(
      config,
      window.location.href,
    );
    if (!matchDetails) {
      pageRenderer.clear();
      return;
    }

    var matchedRule = matchDetails.rule;
    var profileName = profilesModule.getProfileName(
      config,
      matchedRule.profileId,
    );

    var profileStyle = profilesModule.getProfileStyle(
      config,
      matchedRule.profileId,
      config.bannerText,
    );

    pageRenderer.ensureBorder(config.style, profileStyle.color);

    if (config.bannerEnabled) {
      var details = {
        ruleText:
          "Regra aplicada: " +
          matchDetails.reason.matchType +
          ' "' +
          matchDetails.reason.ruleValue +
          '"',
        profileText: "Perfil: " + profileName,
        urlText: "URL detectada: " + matchDetails.reason.detectedUrl,
      };

      if (matchDetails.reason.source) {
        details.sourceText =
          "Fonte: " +
          matchDetails.reason.source +
          " (chave: " +
          matchDetails.reason.sourceKey +
          ")";
      }

      pageRenderer.ensureBanner(
        profileStyle.bannerText || config.bannerText,
        profileStyle.color,
        details,
        {
          alwaysMinimized: Boolean(config.bannerAlwaysMinimized),
        },
      );
    } else {
      pageRenderer.removeBanner();
    }
  }

  /**
   * Recarrega a configuração do armazenamento e reaplica na página.
   *
   * Centraliza leitura e aplicação para ser reutilizada em mudanças de URL
   * e alterações de configuração vindas do popup.
   */
  function updateFromStorage() {
    storageApi.loadConfig(function (config) {
      applyConfig(config);
    });
  }

  /**
   * Verifica se a URL mudou e dispara atualização somente quando necessário.
   *
   * Evita processamento redundante em SPAs onde diversos eventos podem ser
   * emitidos sem alteração real de rota.
   */
  function onPossibleUrlChange() {
    var currentHref = window.location.href;
    var hrefChanged = currentHref !== lastKnownHref;

    if (hrefChanged) {
      lastKnownHref = currentHref;
    }

    var fingerprint = computeSourceFingerprint(currentContentConfig);
    var sourceChanged = fingerprint !== lastSourceFingerprint;

    if (hrefChanged || sourceChanged) {
      updateFromStorage();
    }
  }

  /**
   * Intercepta métodos da History API para detectar navegação interna em SPAs.
   *
   * @param {"pushState"|"replaceState"} methodName Nome do método a ser encapsulado.
   */
  function patchHistoryMethod(methodName) {
    var original = history[methodName];
    if (typeof original !== "function") return;

    history[methodName] = function () {
      var result = original.apply(this, arguments);
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
      return result;
    };
  }

  /**
   * Inicializa os observadores de mudança de URL para páginas dinâmicas.
   *
   * Combina History API, eventos nativos e polling como fallback para cobrir
   * cenários em que bibliotecas de roteamento não disparam todos os eventos.
   */
  function setupSpaUrlObserver() {
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");

    window.addEventListener("popstate", onPossibleUrlChange);
    window.addEventListener("hashchange", onPossibleUrlChange);
    window.addEventListener(URL_CHANGE_EVENT, onPossibleUrlChange);
    window.addEventListener("pageshow", onPossibleUrlChange);
    window.addEventListener("focus", onPossibleUrlChange);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) onPossibleUrlChange();
    });

    if (!urlPollTimer) {
      urlPollTimer = window.setInterval(
        onPossibleUrlChange,
        URL_POLL_INTERVAL_MS,
      );
    }
  }

  storageApi.onConfigChanged(function () {
    updateFromStorage();
  });

  window.addEventListener("storage", function (event) {
    if (!currentContentConfig || !currentContentConfig.rules) return;
    var isRelevantKey = currentContentConfig.rules.some(function (rule) {
      return rule.source === "localStorage" && rule.sourceKey === event.key;
    });
    if (isRelevantKey) updateFromStorage();
  });

  setupSpaUrlObserver();
  updateFromStorage();
})();

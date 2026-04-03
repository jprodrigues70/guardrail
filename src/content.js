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
   * Aplica a configuração da extensão na página atual.
   *
   * A função identifica a primeira regra correspondente à URL, resolve o
   * estilo do perfil e então desenha ou remove borda e banner conforme
   * preferências ativas.
   *
   * @param {object} config Configuração normalizada carregada do storage.
   */
  function applyConfig(config) {
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
      pageRenderer.ensureBanner(
        profileStyle.bannerText || config.bannerText,
        profileStyle.color,
        {
          ruleText:
            "Regra aplicada: " +
            matchDetails.reason.matchType +
            ' "' +
            matchDetails.reason.ruleValue +
            '"',
          profileText: "Perfil: " + profileName,
          urlText: "URL detectada: " + matchDetails.reason.detectedUrl,
        },
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
    if (currentHref === lastKnownHref) return;
    lastKnownHref = currentHref;
    updateFromStorage();
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

  setupSpaUrlObserver();
  updateFromStorage();
})();

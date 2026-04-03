(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  /**
   * Avalia se uma regra específica corresponde à URL atual.
   *
   * Suporta os tipos contains, regex, domain e startsWith.
   *
   * @param {object} rule Regra individual.
   * @param {string} currentUrl URL completa da página.
   * @param {string} currentHostname Hostname já normalizado para minúsculas.
   * @returns {boolean} Verdadeiro quando a regra corresponde.
   */
  function isRuleMatch(rule, currentUrl, currentHostname) {
    if (rule.type === "contains") {
      return currentUrl.indexOf(rule.value) !== -1;
    }

    if (rule.type === "regex") {
      try {
        return new RegExp(rule.value).test(currentUrl);
      } catch (error) {
        return false;
      }
    }

    if (rule.type === "domain") {
      return currentHostname === rule.value.toLowerCase();
    }

    return currentUrl.startsWith(rule.value);
  }

  /**
   * Retorna a primeira regra aplicável para a URL informada.
   *
   * Apenas regras de perfis habilitados participam da busca.
   *
   * @param {object} config Configuração completa da extensão.
   * @param {string} href URL a ser avaliada.
   * @returns {object|null} Regra correspondente ou nulo.
   */
  function getMatchedRule(config, href) {
    var currentUrl = href || window.location.href;
    var currentHostname = new URL(currentUrl).hostname.toLowerCase();
    var enabledProfiles = Object.create(null);

    config.profiles.forEach(function (profile) {
      if (profile.enabled) enabledProfiles[profile.id] = true;
    });

    for (var i = 0; i < config.rules.length; i += 1) {
      var rule = config.rules[i];
      if (!enabledProfiles[rule.profileId]) continue;
      if (isRuleMatch(rule, currentUrl, currentHostname)) return rule;
    }

    return null;
  }

  root.ruleMatcher = {
    isRuleMatch: isRuleMatch,
    getMatchedRule: getMatchedRule,
  };
})();

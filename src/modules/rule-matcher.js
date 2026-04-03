(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  var TYPE_BASE_SCORE = {
    domain: 4000,
    startsWith: 3000,
    contains: 2000,
    regex: 1000,
  };

  function getRuleTypeLabel(type) {
    if (type === "domain") return "domínio exato";
    if (type === "startsWith") return "começa com";
    if (type === "contains") return "contém";
    if (type === "regex") return "regex";
    return "começa com";
  }

  function getRuleSpecificityScore(rule) {
    var base = TYPE_BASE_SCORE[rule.type] || TYPE_BASE_SCORE.startsWith;
    var valueLength = String(rule.value || "").length;
    return base + Math.min(valueLength, 999);
  }

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
   * Resolve o melhor match entre regras válidas para a URL informada.
   *
   * Política de precedência:
   * 1) regra mais específica vence (escore por tipo + tamanho do valor)
   * 2) em empate de escore, a regra mais antiga na lista vence
   *
   * @param {object} config Configuração completa da extensão.
   * @param {string} href URL a ser avaliada.
   * @returns {{rule: object, reason: object}|null} Match vencedor com metadados.
   */
  function resolveBestMatch(config, href) {
    var currentUrl = href || window.location.href;
    var currentHostname = new URL(currentUrl).hostname.toLowerCase();
    var enabledProfiles = Object.create(null);

    config.profiles.forEach(function (profile) {
      if (profile.enabled) enabledProfiles[profile.id] = true;
    });

    var best = null;

    for (var i = 0; i < config.rules.length; i += 1) {
      var rule = config.rules[i];
      if (!enabledProfiles[rule.profileId]) continue;
      if (!isRuleMatch(rule, currentUrl, currentHostname)) continue;

      var score = getRuleSpecificityScore(rule);
      if (!best || score > best.score) {
        best = {
          rule: rule,
          score: score,
          index: i,
        };
      }
    }

    if (!best) return null;

    return {
      rule: best.rule,
      reason: {
        matchType: getRuleTypeLabel(best.rule.type),
        ruleValue: best.rule.value,
        score: best.score,
        selectedBy: "mais específica vence",
        ruleIndex: best.index,
        detectedUrl: currentUrl,
      },
    };
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
    var resolved = resolveBestMatch(config, href);
    return resolved ? resolved.rule : null;
  }

  function getMatchDetails(config, href) {
    return resolveBestMatch(config, href);
  }

  root.ruleMatcher = {
    isRuleMatch: isRuleMatch,
    getRuleSpecificityScore: getRuleSpecificityScore,
    resolveBestMatch: resolveBestMatch,
    getMatchedRule: getMatchedRule,
    getMatchDetails: getMatchDetails,
  };
})();

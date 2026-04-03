(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

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

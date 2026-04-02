(function () {
  "use strict";

  var STORAGE_KEY = "pmfmConfig";
  var LEGACY_PREFIX_KEY = "urlPrefixes";
  var BORDER_ID = "pmfm-page-border-overlay";
  var BANNER_ID = "pmfm-top-banner";
  var URL_CHANGE_EVENT = "pmfm:urlchange";
  var URL_POLL_INTERVAL_MS = 500;
  var BODY_BASE_PADDING_BOTTOM_ATTR = "data-pmfm-base-padding-bottom";
  var BODY_INLINE_PADDING_BOTTOM_ATTR = "data-pmfm-inline-padding-bottom";
  var lastKnownHref = window.location.href;
  var urlPollTimer = null;

  var DEFAULT_PROFILES = [
    { id: "work", name: "Trabalho", enabled: true },
    { id: "production", name: "Producao", enabled: true },
    { id: "staging", name: "Homologacao", enabled: true },
  ];

  var DEFAULT_CONFIG = {
    rules: [],
    profiles: DEFAULT_PROFILES,
    profileStyles: {
      work: { color: "#d40000", bannerText: "Ambiente de Trabalho" },
      production: { color: "#f97316", bannerText: "Ambiente de Producao" },
      staging: { color: "#2563eb", bannerText: "Ambiente de Homologacao" },
    },
    style: {
      width: 4,
      lineStyle: "solid",
    },
    bannerEnabled: true,
    bannerText: "Ambiente sensivel",
    confirmDelete: true,
  };

  function sanitizePrefix(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeProfiles(value) {
    var source = Array.isArray(value) ? value : DEFAULT_PROFILES;
    var profiles = source
      .map(function (profile) {
        var id = sanitizePrefix(profile && profile.id);
        var name = sanitizePrefix(profile && profile.name);
        if (!id || !name) return null;

        return {
          id: id,
          name: name,
          enabled: Boolean(profile.enabled),
        };
      })
      .filter(Boolean);

    if (!profiles.length) return clone(DEFAULT_PROFILES);

    return profiles;
  }

  function normalizeStyle(style) {
    var source = style || {};
    var width = Number(source.width);
    if (!Number.isFinite(width)) width = DEFAULT_CONFIG.style.width;
    width = Math.max(1, Math.min(16, Math.round(width)));

    var lineStyle = source.lineStyle === "dashed" ? "dashed" : "solid";
    var color = sanitizePrefix(source.color) || DEFAULT_CONFIG.style.color;
    var level = sanitizePrefix(source.level) || DEFAULT_CONFIG.style.level;

    return {
      width: width,
      lineStyle: lineStyle,
    };
  }

  function normalizeColor(value, fallback) {
    var input = sanitizePrefix(value);
    if (/^#[0-9a-fA-F]{6}$/.test(input)) return input;
    return fallback;
  }

  function normalizeProfileStyles(
    rawProfileStyles,
    profiles,
    styleFallbackColor,
  ) {
    var source =
      rawProfileStyles && typeof rawProfileStyles === "object"
        ? rawProfileStyles
        : {};

    var legacyColor = normalizeColor(styleFallbackColor, "#d40000");
    var result = {};

    profiles.forEach(function (profile, index) {
      var defaultColor =
        (DEFAULT_CONFIG.profileStyles[profile.id] &&
          DEFAULT_CONFIG.profileStyles[profile.id].color) ||
        legacyColor;

      var color = normalizeColor(
        source[profile.id] && source[profile.id].color,
        defaultColor,
      );

      var defaultBannerText =
        (DEFAULT_CONFIG.profileStyles[profile.id] &&
          DEFAULT_CONFIG.profileStyles[profile.id].bannerText) ||
        profile.name;
      var bannerText =
        sanitizePrefix(source[profile.id] && source[profile.id].bannerText) ||
        defaultBannerText;

      if (!color && index === 0) color = legacyColor;
      result[profile.id] = {
        color: color || defaultColor,
        bannerText: bannerText,
      };
    });

    return result;
  }

  function normalizeRules(value, profileIds) {
    if (!Array.isArray(value)) return [];

    var allowedTypes = {
      startsWith: true,
      contains: true,
      regex: true,
      domain: true,
    };

    return value
      .map(function (rule, index) {
        var type = sanitizePrefix(rule && rule.type);
        var valueText = sanitizePrefix(rule && rule.value);
        var profileId = sanitizePrefix(rule && rule.profileId);

        if (!valueText) return null;
        if (!allowedTypes[type]) type = "startsWith";
        if (!profileIds[profileId]) profileId = DEFAULT_PROFILES[0].id;

        return {
          id:
            sanitizePrefix(rule && rule.id) ||
            "rule-" + index + "-" + Date.now(),
          type: type,
          value: valueText,
          profileId: profileId,
        };
      })
      .filter(Boolean);
  }

  function normalizeConfig(rawConfig) {
    var config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    var profiles = normalizeProfiles(config.profiles);
    var profileIds = Object.create(null);

    profiles.forEach(function (profile) {
      profileIds[profile.id] = true;
    });

    return {
      rules: normalizeRules(config.rules, profileIds),
      profiles: profiles,
      profileStyles: normalizeProfileStyles(
        config.profileStyles,
        profiles,
        config.style && config.style.color,
      ),
      style: normalizeStyle(config.style),
      bannerEnabled:
        typeof config.bannerEnabled === "boolean"
          ? config.bannerEnabled
          : DEFAULT_CONFIG.bannerEnabled,
      bannerText:
        sanitizePrefix(config.bannerText) || DEFAULT_CONFIG.bannerText,
      confirmDelete:
        typeof config.confirmDelete === "boolean"
          ? config.confirmDelete
          : DEFAULT_CONFIG.confirmDelete,
    };
  }

  function buildConfigFromLegacy(prefixes) {
    return {
      rules: normalizePrefixes(prefixes).map(function (prefix, index) {
        return {
          id: "legacy-" + index + "-" + Date.now(),
          type: "startsWith",
          value: prefix,
          profileId: DEFAULT_PROFILES[0].id,
        };
      }),
      profiles: clone(DEFAULT_PROFILES),
      profileStyles: clone(DEFAULT_CONFIG.profileStyles),
      style: clone(DEFAULT_CONFIG.style),
      bannerEnabled: DEFAULT_CONFIG.bannerEnabled,
      bannerText: DEFAULT_CONFIG.bannerText,
      confirmDelete: DEFAULT_CONFIG.confirmDelete,
    };
  }

  function normalizePrefixes(value) {
    if (!Array.isArray(value)) return [];

    var unique = Object.create(null);
    return value.map(sanitizePrefix).filter(function (prefix) {
      if (!prefix) return false;
      var key = prefix.toLowerCase();
      if (unique[key]) return false;
      unique[key] = true;
      return true;
    });
  }

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

  function getMatchedRule(config) {
    var currentUrl = window.location.href;
    var currentHostname = window.location.hostname.toLowerCase();
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

  function ensureBorder(style, color) {
    var border = document.getElementById(BORDER_ID);
    if (!border) {
      border = document.createElement("div");
      border.id = BORDER_ID;
      border.setAttribute("aria-hidden", "true");
      border.style.position = "fixed";
      border.style.inset = "0";
      border.style.pointerEvents = "none";
      border.style.zIndex = "2147483647";
      border.style.boxSizing = "border-box";
      border.style.opacity = "0.6";
      document.documentElement.appendChild(border);
    }

    border.style.border =
      String(style.width) + "px " + style.lineStyle + " " + color;
  }

  function removeBorder() {
    var existing = document.getElementById(BORDER_ID);
    if (existing) existing.remove();
  }

  function ensureBanner(text, style) {
    var banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;
      banner.setAttribute("aria-live", "polite");
      banner.style.display = "block";
      banner.style.width = "100%";
      banner.style.padding = "8px 12px";
      banner.style.textAlign = "center";
      banner.style.fontFamily = "Segoe UI, sans-serif";
      banner.style.fontSize = "13px";
      banner.style.fontWeight = "700";
      banner.style.letterSpacing = "0.02em";
      banner.style.color = "#ffffff";
      banner.style.boxSizing = "border-box";

      if (document.body) {
        document.body.insertBefore(banner, document.body.firstChild);
      } else {
        document.documentElement.appendChild(banner);
      }
    }

    banner.style.background = style.color;
    banner.textContent = text;
    applyBannerCompensation(banner.offsetHeight || 0);
  }

  function applyBannerCompensation(bannerHeight) {
    if (!document.body) return;

    var body = document.body;
    if (!body.hasAttribute(BODY_INLINE_PADDING_BOTTOM_ATTR)) {
      body.setAttribute(
        BODY_INLINE_PADDING_BOTTOM_ATTR,
        body.style.paddingBottom || "",
      );
    }

    if (!body.hasAttribute(BODY_BASE_PADDING_BOTTOM_ATTR)) {
      var computed = window.getComputedStyle(body);
      var baseBottom = parseFloat(computed.paddingBottom) || 0;
      body.setAttribute(BODY_BASE_PADDING_BOTTOM_ATTR, String(baseBottom));
    }

    var storedBottom = Number(body.getAttribute(BODY_BASE_PADDING_BOTTOM_ATTR));
    var baseBottomPadding = Number.isFinite(storedBottom) ? storedBottom : 0;

    body.style.paddingBottom = String(baseBottomPadding + bannerHeight) + "px";
  }

  function clearBannerCompensation() {
    if (!document.body) return;

    var body = document.body;
    var inlineBottom = body.getAttribute(BODY_INLINE_PADDING_BOTTOM_ATTR);

    body.style.paddingBottom = inlineBottom === null ? "" : inlineBottom;

    body.removeAttribute(BODY_BASE_PADDING_BOTTOM_ATTR);
    body.removeAttribute(BODY_INLINE_PADDING_BOTTOM_ATTR);
  }

  function removeBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (banner) banner.remove();
    clearBannerCompensation();
  }

  function applyVisualState(config, matchedRule) {
    if (matchedRule) {
      var profileStyle = config.profileStyles[matchedRule.profileId] ||
        config.profileStyles[DEFAULT_PROFILES[0].id] || {
          color: "#d40000",
          bannerText: config.bannerText || "Ambiente sensivel",
        };

      ensureBorder(config.style, profileStyle.color);
      if (config.bannerEnabled) {
        ensureBanner(
          profileStyle.bannerText || config.bannerText || "Ambiente sensivel",
          { color: profileStyle.color },
        );
      } else {
        removeBanner();
      }
      return;
    }

    removeBorder();
    removeBanner();
  }

  function loadConfig(callback) {
    chrome.storage.sync.get(
      { pmfmConfig: null, urlPrefixes: [] },
      function (result) {
        if (result[STORAGE_KEY]) {
          callback(normalizeConfig(result[STORAGE_KEY]));
          return;
        }

        var migrated = buildConfigFromLegacy(result[LEGACY_PREFIX_KEY]);
        chrome.storage.sync.set({ pmfmConfig: migrated }, function () {
          callback(normalizeConfig(migrated));
        });
      },
    );
  }

  function updateBorderFromSettings() {
    loadConfig(function (config) {
      applyVisualState(config, getMatchedRule(config));
    });
  }

  function onPossibleUrlChange() {
    var currentHref = window.location.href;
    if (currentHref === lastKnownHref) return;
    lastKnownHref = currentHref;
    updateBorderFromSettings();
  }

  function patchHistoryMethod(methodName) {
    var original = history[methodName];
    if (typeof original !== "function") return;

    history[methodName] = function () {
      var result = original.apply(this, arguments);
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
      return result;
    };
  }

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

    // Fallback para SPAs que alteram URL sem disparar eventos esperados
    // (ou sobrescrevem history internamente).
    if (!urlPollTimer) {
      urlPollTimer = window.setInterval(
        onPossibleUrlChange,
        URL_POLL_INTERVAL_MS,
      );
    }
  }

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== "sync") return;
    if (!changes[STORAGE_KEY] && !changes[LEGACY_PREFIX_KEY]) return;
    updateBorderFromSettings();
  });

  setupSpaUrlObserver();
  updateBorderFromSettings();
})();

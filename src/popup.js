(function () {
  "use strict";

  var STORAGE_KEY = "pmfmConfig";
  var LEGACY_PREFIX_KEY = "urlPrefixes";

  var RULE_TYPES = {
    startsWith: "Comeca com",
    contains: "Contem",
    regex: "Regex",
    domain: "Dominio exato",
  };

  var DEFAULT_CONFIG = {
    rules: [],
    profiles: [
      { id: "work", name: "Trabalho", enabled: true },
      { id: "production", name: "Producao", enabled: true },
      { id: "staging", name: "Homologacao", enabled: true },
    ],
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

  var tabButtons = document.querySelectorAll("[data-tab]");
  var tabPanels = document.querySelectorAll("[data-panel]");
  var form = document.getElementById("rule-form");
  var valueInput = document.getElementById("rule-value");
  var typeInput = document.getElementById("rule-type");
  var profileInput = document.getElementById("rule-profile");
  var addCurrentUrlBtn = document.getElementById("add-current-url");

  var profileList = document.getElementById("profile-list");
  var borderWidth = document.getElementById("border-width");
  var borderStyle = document.getElementById("border-style");
  var bannerEnabled = document.getElementById("banner-enabled");

  var confirmDeleteInput = document.getElementById("confirm-delete");
  var exportButton = document.getElementById("export-config");
  var importButton = document.getElementById("import-config");
  var importFile = document.getElementById("import-file");

  var clearRulesButton = document.getElementById("clear-rules");
  var undoRemoveButton = document.getElementById("undo-remove");
  var ruleList = document.getElementById("rule-list");
  var emptyState = document.getElementById("empty-state");
  var feedback = document.getElementById("feedback");

  var currentConfig = null;
  var lastRemovedRule = null;
  var feedbackTimer = null;

  function sanitizeText(value) {
    return (value || "").trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId() {
    return "rule-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalizeColor(value, fallback) {
    var color = sanitizeText(value);
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    return fallback;
  }

  function normalizeProfiles(value) {
    var source = Array.isArray(value) ? value : DEFAULT_CONFIG.profiles;
    var profiles = source
      .map(function (profile) {
        var id = sanitizeText(profile && profile.id);
        var name = sanitizeText(profile && profile.name);
        if (!id || !name) return null;
        return { id: id, name: name, enabled: Boolean(profile.enabled) };
      })
      .filter(Boolean);

    return profiles.length ? profiles : clone(DEFAULT_CONFIG.profiles);
  }

  function normalizeStyle(value) {
    var source = value || {};
    var width = Number(source.width);
    if (!Number.isFinite(width)) width = DEFAULT_CONFIG.style.width;
    width = Math.max(1, Math.min(16, Math.round(width)));

    return {
      width: width,
      lineStyle: source.lineStyle === "dashed" ? "dashed" : "solid",
    };
  }

  function normalizeProfileStyles(rawProfileStyles, profiles, legacyColor) {
    var source =
      rawProfileStyles && typeof rawProfileStyles === "object"
        ? rawProfileStyles
        : {};
    var fallbackFromLegacy = normalizeColor(legacyColor, "#d40000");
    var profileStyles = {};

    profiles.forEach(function (profile) {
      var defaultData = DEFAULT_CONFIG.profileStyles[profile.id] || {
        color: fallbackFromLegacy,
        bannerText: profile.name,
      };

      var entry = source[profile.id] || {};
      profileStyles[profile.id] = {
        color: normalizeColor(entry.color, defaultData.color),
        bannerText: sanitizeText(entry.bannerText) || defaultData.bannerText,
      };
    });

    return profileStyles;
  }

  function normalizeRules(value, profileIds) {
    if (!Array.isArray(value)) return [];

    var seen = Object.create(null);

    return value
      .map(function (rule) {
        var text = sanitizeText(rule && rule.value);
        var type = sanitizeText(rule && rule.type);
        var profileId = sanitizeText(rule && rule.profileId);
        if (!text) return null;
        if (!RULE_TYPES[type]) type = "startsWith";
        if (!profileIds[profileId]) profileId = DEFAULT_CONFIG.profiles[0].id;

        var dedupe = type + "::" + profileId + "::" + text.toLowerCase();
        if (seen[dedupe]) return null;
        seen[dedupe] = true;

        return {
          id: sanitizeText(rule && rule.id) || makeId(),
          type: type,
          value: text,
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
      bannerText: sanitizeText(config.bannerText) || DEFAULT_CONFIG.bannerText,
      confirmDelete:
        typeof config.confirmDelete === "boolean"
          ? config.confirmDelete
          : DEFAULT_CONFIG.confirmDelete,
    };
  }

  function migrateLegacy(prefixes) {
    var seen = Object.create(null);

    return {
      rules: (Array.isArray(prefixes) ? prefixes : [])
        .map(function (prefix) {
          return sanitizeText(prefix);
        })
        .filter(function (prefix) {
          if (!prefix) return false;
          var key = prefix.toLowerCase();
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        })
        .map(function (prefix) {
          return {
            id: makeId(),
            type: "startsWith",
            value: prefix,
            profileId: DEFAULT_CONFIG.profiles[0].id,
          };
        }),
      profiles: clone(DEFAULT_CONFIG.profiles),
      profileStyles: clone(DEFAULT_CONFIG.profileStyles),
      style: clone(DEFAULT_CONFIG.style),
      bannerEnabled: DEFAULT_CONFIG.bannerEnabled,
      bannerText: DEFAULT_CONFIG.bannerText,
      confirmDelete: DEFAULT_CONFIG.confirmDelete,
    };
  }

  function showFeedback(message, isError) {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.add("feedback--visible");
    feedback.classList.toggle("feedback--error", Boolean(isError));

    if (feedbackTimer) window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(function () {
      feedback.classList.remove("feedback--visible");
      feedback.classList.remove("feedback--error");
      feedback.textContent = "";
      feedback.hidden = true;
    }, 2600);
  }

  function saveConfig(callback) {
    chrome.storage.sync.set(
      { pmfmConfig: normalizeConfig(currentConfig) },
      callback,
    );
  }

  function loadConfig(callback) {
    chrome.storage.sync.get(
      { pmfmConfig: null, urlPrefixes: [] },
      function (result) {
        if (result[STORAGE_KEY]) {
          callback(normalizeConfig(result[STORAGE_KEY]));
          return;
        }

        var migrated = migrateLegacy(result[LEGACY_PREFIX_KEY]);
        chrome.storage.sync.set({ pmfmConfig: migrated }, function () {
          callback(normalizeConfig(migrated));
        });
      },
    );
  }

  function switchTab(tabName) {
    tabButtons.forEach(function (button) {
      var active = button.getAttribute("data-tab") === tabName;
      button.classList.toggle("tab--active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    tabPanels.forEach(function (panel) {
      var active = panel.getAttribute("data-panel") === tabName;
      panel.classList.toggle("tab-panel--active", active);
      panel.hidden = !active;
    });
  }

  function getProfileName(profileId) {
    var profile = currentConfig.profiles.find(function (item) {
      return item.id === profileId;
    });
    return profile ? profile.name : "Sem perfil";
  }

  function syncInputsFromConfig() {
    profileInput.innerHTML = "";
    currentConfig.profiles.forEach(function (profile) {
      var option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      profileInput.appendChild(option);
    });

    if (!profileInput.value && currentConfig.profiles[0]) {
      profileInput.value = currentConfig.profiles[0].id;
    }

    borderWidth.value = String(currentConfig.style.width);
    borderStyle.value = currentConfig.style.lineStyle;
    bannerEnabled.checked = currentConfig.bannerEnabled;
    confirmDeleteInput.checked = currentConfig.confirmDelete;
  }

  function renderProfiles() {
    profileList.innerHTML = "";

    currentConfig.profiles.forEach(function (profile) {
      var item = document.createElement("li");
      item.className = "profile-item";

      var left = document.createElement("div");
      left.className = "field-group";

      var label = document.createElement("span");
      label.textContent = profile.name;

      var bannerInput = document.createElement("input");
      bannerInput.type = "text";
      bannerInput.className = "profile-item__banner";
      bannerInput.value =
        (currentConfig.profileStyles[profile.id] &&
          currentConfig.profileStyles[profile.id].bannerText) ||
        profile.name;
      bannerInput.placeholder = "Texto do banner";
      bannerInput.addEventListener("change", function () {
        if (!currentConfig.profileStyles[profile.id]) {
          currentConfig.profileStyles[profile.id] = {
            color: "#d40000",
            bannerText: profile.name,
          };
        }

        currentConfig.profileStyles[profile.id].bannerText =
          sanitizeText(bannerInput.value) || profile.name;

        saveConfig(function () {
          showFeedback("Texto do banner do ambiente atualizado.", false);
        });
      });

      left.appendChild(label);
      left.appendChild(bannerInput);

      var controls = document.createElement("div");
      controls.className = "profile-item__controls";

      var colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "profile-item__color";
      colorInput.value =
        (currentConfig.profileStyles[profile.id] &&
          currentConfig.profileStyles[profile.id].color) ||
        "#d40000";
      colorInput.addEventListener("change", function () {
        if (!currentConfig.profileStyles[profile.id]) {
          currentConfig.profileStyles[profile.id] = {
            color: "#d40000",
            bannerText: profile.name,
          };
        }
        currentConfig.profileStyles[profile.id].color = normalizeColor(
          colorInput.value,
          "#d40000",
        );

        saveConfig(function () {
          showFeedback("Cor do ambiente atualizada.", false);
        });
      });

      var toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = profile.enabled;
      toggle.addEventListener("change", function () {
        currentConfig.profiles = currentConfig.profiles.map(
          function (candidate) {
            if (candidate.id !== profile.id) return candidate;
            return {
              id: candidate.id,
              name: candidate.name,
              enabled: toggle.checked,
            };
          },
        );

        saveConfig(function () {
          showFeedback("Perfil atualizado.", false);
          render();
        });
      });

      controls.appendChild(colorInput);
      controls.appendChild(toggle);
      item.appendChild(left);
      item.appendChild(controls);
      profileList.appendChild(item);
    });
  }

  function renderRules() {
    ruleList.innerHTML = "";

    currentConfig.rules.forEach(function (rule) {
      var item = document.createElement("li");
      item.className = "rule-item";

      var text = document.createElement("span");
      text.className = "rule-item__text";
      text.textContent =
        "[" +
        RULE_TYPES[rule.type] +
        "] " +
        rule.value +
        " (" +
        getProfileName(rule.profileId) +
        ")";

      var removeButton = document.createElement("button");
      removeButton.className = "rule-item__remove";
      removeButton.type = "button";
      removeButton.textContent = "Remover";
      removeButton.addEventListener("click", function () {
        if (
          currentConfig.confirmDelete &&
          !window.confirm("Remover essa regra?")
        ) {
          return;
        }

        var removed = null;
        currentConfig.rules = currentConfig.rules.filter(function (candidate) {
          if (candidate.id === rule.id) {
            removed = candidate;
            return false;
          }
          return true;
        });

        saveConfig(function () {
          if (removed) {
            lastRemovedRule = removed;
            undoRemoveButton.hidden = false;
          }
          showFeedback("Regra removida.", false);
          render();
        });
      });

      item.appendChild(text);
      item.appendChild(removeButton);
      ruleList.appendChild(item);
    });

    var isEmpty = currentConfig.rules.length === 0;
    emptyState.hidden = !isEmpty;
    ruleList.hidden = isEmpty;
  }

  function render() {
    syncInputsFromConfig();
    renderProfiles();
    renderRules();
  }

  function addRule(value, type, profileId) {
    var text = sanitizeText(value);

    if (!text) {
      showFeedback("Informe um valor de regra valido.", true);
      return;
    }

    if (type === "regex") {
      try {
        new RegExp(text);
      } catch (error) {
        showFeedback("Regex invalido.", true);
        return;
      }
    }

    var exists = currentConfig.rules.some(function (rule) {
      return (
        rule.type === type &&
        rule.profileId === profileId &&
        rule.value.toLowerCase() === text.toLowerCase()
      );
    });

    if (exists) {
      showFeedback("Essa regra ja existe nesse perfil.", true);
      return;
    }

    currentConfig.rules = currentConfig.rules.concat({
      id: makeId(),
      type: type,
      value: text,
      profileId: profileId,
    });

    saveConfig(function () {
      render();
      form.reset();
      typeInput.value = "startsWith";
      profileInput.value = profileId;
      valueInput.focus();
      showFeedback("Regra adicionada.", false);
    });
  }

  function saveBorderStyle() {
    currentConfig.style = normalizeStyle({
      width: borderWidth.value,
      lineStyle: borderStyle.value,
    });

    saveConfig(function () {
      showFeedback("Configuracao da borda atualizada.", false);
    });
  }

  tabButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      switchTab(button.getAttribute("data-tab"));
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    addRule(valueInput.value, typeInput.value, profileInput.value);
  });

  addCurrentUrlBtn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        showFeedback("Nao foi possivel ler a URL da aba atual.", true);
        return;
      }

      try {
        var parsed = new URL(tab.url);
        valueInput.value = parsed.origin + parsed.pathname;
        valueInput.focus();
        showFeedback("URL atual copiada para o campo.", false);
      } catch (error) {
        showFeedback("URL da aba atual invalida para uso.", true);
      }
    });
  });

  borderWidth.addEventListener("change", saveBorderStyle);
  borderStyle.addEventListener("change", saveBorderStyle);

  bannerEnabled.addEventListener("change", function () {
    currentConfig.bannerEnabled = bannerEnabled.checked;
    saveConfig(function () {
      showFeedback("Mensagem fixa atualizada.", false);
    });
  });

  confirmDeleteInput.addEventListener("change", function () {
    currentConfig.confirmDelete = confirmDeleteInput.checked;
    saveConfig(function () {
      showFeedback("Protecao de remocao atualizada.", false);
    });
  });

  clearRulesButton.addEventListener("click", function () {
    if (!window.confirm("Limpar todas as regras?")) return;
    currentConfig.rules = [];
    lastRemovedRule = null;
    undoRemoveButton.hidden = true;

    saveConfig(function () {
      showFeedback("Todas as regras foram removidas.", false);
      render();
    });
  });

  undoRemoveButton.addEventListener("click", function () {
    if (!lastRemovedRule) return;

    currentConfig.rules = currentConfig.rules.concat(lastRemovedRule);
    lastRemovedRule = null;
    undoRemoveButton.hidden = true;

    saveConfig(function () {
      showFeedback("Regra restaurada.", false);
      render();
    });
  });

  exportButton.addEventListener("click", function () {
    var blob = new Blob(
      [JSON.stringify(normalizeConfig(currentConfig), null, 2)],
      {
        type: "application/json",
      },
    );

    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "pmfm-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showFeedback("Configuracao exportada.", false);
  });

  importButton.addEventListener("click", function () {
    importFile.click();
  });

  importFile.addEventListener("change", function () {
    var file = importFile.files && importFile.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || "{}"));
        currentConfig = normalizeConfig(parsed);
        lastRemovedRule = null;
        undoRemoveButton.hidden = true;

        saveConfig(function () {
          render();
          showFeedback("Configuracao importada.", false);
        });
      } catch (error) {
        showFeedback("Arquivo JSON invalido.", true);
      } finally {
        importFile.value = "";
      }
    };

    reader.readAsText(file);
  });

  loadConfig(function (config) {
    currentConfig = normalizeConfig(config);
    switchTab("rules");
    render();
  });
})();

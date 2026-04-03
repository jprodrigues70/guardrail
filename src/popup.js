(function () {
  "use strict";

  var modules = globalThis.GuardRailModules || {};
  var schema = modules.configSchema;
  var storageModule = modules.storage;
  var profilesModule = modules.profiles;
  var importExport = modules.importExport;
  var uiRender = modules.uiRender;

  if (
    !schema ||
    !storageModule ||
    !profilesModule ||
    !importExport ||
    !uiRender
  ) {
    throw new Error("GuardRail modules were not loaded before popup.js");
  }

  var tabButtons = document.querySelectorAll("[data-tab]");
  var tabPanels = document.querySelectorAll("[data-panel]");
  var form = document.getElementById("rule-form");
  var valueInput = document.getElementById("rule-value");
  var typeInput = document.getElementById("rule-type");
  var profileInput = document.getElementById("rule-profile");
  var addCurrentUrlBtn = document.getElementById("add-current-url");

  var profileList = document.getElementById("profile-list");
  var addProfileButton = document.getElementById("add-profile");
  var customProfileNameInput = document.getElementById("custom-profile-name");
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

  var storageApi = storageModule.createStorageApi({
    storageKey: schema.STORAGE_KEY,
    legacyKey: schema.LEGACY_PREFIX_KEY,
    normalizeConfig: schema.normalizeConfig,
    buildConfigFromLegacy: schema.buildConfigFromLegacy,
  });

  var feedbackController = uiRender.createFeedbackController(feedback, 2600);
  var tabController = uiRender.createTabController(tabButtons, tabPanels);

  var currentConfig = null;
  var lastRemovedRule = null;
  var defaultProfileIds = schema.DEFAULT_PROFILES.reduce(function (acc, item) {
    acc[item.id] = true;
    return acc;
  }, Object.create(null));

  /**
   * Exibe uma mensagem de retorno no topo do popup.
   *
   * Esta função centraliza o uso do controlador de feedback para manter
   * consistência visual entre mensagens de sucesso e erro.
   *
   * @param {string} message Mensagem a ser apresentada para a pessoa usuária.
   * @param {boolean} isError Define se a mensagem deve ser tratada como erro.
   */
  function showFeedback(message, isError) {
    feedbackController.show(message, isError);
  }

  /**
   * Persiste a configuração atual no armazenamento sincronizado da extensão.
   *
   * @param {Function} callback Função opcional executada após salvar.
   */
  function saveConfig(callback) {
    storageApi.saveConfig(currentConfig, callback);
  }

  /**
   * Sincroniza os campos do formulário com o estado mais recente da configuração.
   *
   * Este método atualiza a lista de perfis no seletor de regra e também aplica
   * os valores de estilo e preferências (borda, banner e confirmação de remoção).
   */
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

  /**
   * Renderiza a lista de perfis com seus controles de edição.
   *
   * Cada item permite alterar texto do banner, cor e status habilitado,
   * salvando automaticamente após cada modificação.
   */
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
          schema.sanitizeText(bannerInput.value) || profile.name;

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

        currentConfig.profileStyles[profile.id].color = schema.normalizeColor(
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

      if (!defaultProfileIds[profile.id]) {
        var removeProfileButton = document.createElement("button");
        removeProfileButton.type = "button";
        removeProfileButton.className = "profile-item__remove";
        removeProfileButton.textContent = "Remover";
        removeProfileButton.addEventListener("click", function () {
          removeCustomProfile(profile.id);
        });
        controls.appendChild(removeProfileButton);
      }

      item.appendChild(left);
      item.appendChild(controls);
      profileList.appendChild(item);
    });
  }

  /**
   * Gera um identificador para contexto personalizado.
   *
   * @returns {string} Id único no formato profile-<tempo>-<aleatorio>.
   */
  function makeProfileId() {
    return (
      "profile-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8)
    );
  }

  /**
   * Adiciona um novo contexto personalizado.
   *
   * @param {string} name Nome informado para o novo contexto.
   */
  function addCustomProfile(name) {
    var cleanedName = schema.sanitizeText(name);
    if (!cleanedName) {
      showFeedback("Informe um nome para o contexto.", true);
      return;
    }

    var alreadyExists = currentConfig.profiles.some(function (profile) {
      return profile.name.toLowerCase() === cleanedName.toLowerCase();
    });

    if (alreadyExists) {
      showFeedback("Já existe um contexto com esse nome.", true);
      return;
    }

    var profileId = makeProfileId();
    currentConfig.profiles = currentConfig.profiles.concat({
      id: profileId,
      name: cleanedName,
      enabled: true,
    });

    currentConfig.profileStyles[profileId] = {
      color: "#d40000",
      bannerText: cleanedName,
    };

    saveConfig(function () {
      render();
      profileInput.value = profileId;
      customProfileNameInput.value = "";
      customProfileNameInput.focus();
      showFeedback("Contexto personalizado criado.", false);
    });
  }

  /**
   * Remove um contexto personalizado e move regras para um contexto de fallback.
   *
   * @param {string} profileId Id do contexto a ser removido.
   */
  function removeCustomProfile(profileId) {
    if (defaultProfileIds[profileId]) {
      showFeedback("Não é permitido remover contextos padrão.", true);
      return;
    }

    var profileToRemove = currentConfig.profiles.find(function (profile) {
      return profile.id === profileId;
    });
    if (!profileToRemove) return;

    if (!window.confirm('Remover o contexto "' + profileToRemove.name + '"?')) {
      return;
    }

    var remainingProfiles = currentConfig.profiles.filter(function (profile) {
      return profile.id !== profileId;
    });

    if (!remainingProfiles.length) {
      showFeedback("É necessário manter pelo menos um contexto.", true);
      return;
    }

    var fallbackProfileId = remainingProfiles[0].id;

    currentConfig.rules = currentConfig.rules.map(function (rule) {
      if (rule.profileId !== profileId) return rule;
      return {
        id: rule.id,
        type: rule.type,
        value: rule.value,
        profileId: fallbackProfileId,
      };
    });

    currentConfig.profiles = remainingProfiles;
    delete currentConfig.profileStyles[profileId];

    saveConfig(function () {
      render();
      if (profileInput.value === profileId) {
        profileInput.value = fallbackProfileId;
      }
      showFeedback(
        "Contexto removido. Regras vinculadas foram movidas para outro contexto.",
        false,
      );
    });
  }

  /**
   * Renderiza a lista de regras cadastradas.
   *
   * Também gerencia remoção com confirmação opcional, estado de lista vazia
   * e disponibilidade do botão de desfazer última exclusão.
   */
  function renderRules() {
    ruleList.innerHTML = "";

    currentConfig.rules.forEach(function (rule) {
      var item = document.createElement("li");
      item.className = "rule-item";

      var text = document.createElement("span");
      text.className = "rule-item__text";
      text.textContent =
        "[" +
        schema.RULE_TYPES[rule.type] +
        "] " +
        rule.value +
        " (" +
        profilesModule.getProfileName(currentConfig, rule.profileId) +
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

  /**
   * Atualiza toda a interface do popup com base no estado atual.
   *
   * Mantém uma ordem estável de renderização para evitar inconsistências
   * entre formulário, perfis e lista de regras.
   */
  function render() {
    syncInputsFromConfig();
    renderProfiles();
    renderRules();
  }

  /**
   * Cria e salva uma nova regra após validações de formato e duplicidade.
   *
   * Regras inválidas ou repetidas não são adicionadas, e o usuário recebe
   * feedback imediato explicando o motivo.
   *
   * @param {string} value Valor bruto informado no campo de regra.
   * @param {string} type Tipo de correspondência selecionado.
   * @param {string} profileId Identificador do perfil associado à regra.
   */
  function addRule(value, type, profileId) {
    var text = schema.sanitizeText(value);

    if (!text) {
      showFeedback("Informe um valor de regra válido.", true);
      return;
    }

    if (type === "regex") {
      try {
        new RegExp(text);
      } catch (error) {
        showFeedback("Regex inválido.", true);
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
      id: schema.makeId(),
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

  /**
   * Normaliza e salva as preferências visuais da borda de alerta.
   *
   * É acionado ao alterar espessura ou estilo, garantindo que apenas valores
   * válidos sejam persistidos.
   */
  function saveBorderStyle() {
    currentConfig.style = schema.normalizeStyle({
      width: borderWidth.value,
      lineStyle: borderStyle.value,
    });

    saveConfig(function () {
      showFeedback("Configuração da borda atualizada.", false);
    });
  }

  /**
   * Registra todos os eventos da interface do popup.
   *
   * Este método conecta ações de formulário, botões utilitários,
   * preferências gerais e fluxo de importação/exportação de configuração.
   */
  function wireEvents() {
    tabController.wire();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      addRule(valueInput.value, typeInput.value, profileInput.value);
    });

    addCurrentUrlBtn.addEventListener("click", function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (!tab || !tab.url) {
          showFeedback("Não foi possível ler a URL da aba atual.", true);
          return;
        }

        try {
          var parsed = new URL(tab.url);
          valueInput.value = parsed.origin + parsed.pathname;
          valueInput.focus();
          showFeedback("URL atual copiada para o campo.", false);
        } catch (error) {
          showFeedback("URL da aba atual inválida para uso.", true);
        }
      });
    });

    borderWidth.addEventListener("change", saveBorderStyle);
    borderStyle.addEventListener("change", saveBorderStyle);

    addProfileButton.addEventListener("click", function () {
      addCustomProfile(customProfileNameInput.value);
    });

    customProfileNameInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addCustomProfile(customProfileNameInput.value);
    });

    bannerEnabled.addEventListener("change", function () {
      currentConfig.bannerEnabled = bannerEnabled.checked;
      saveConfig(function () {
        showFeedback("Mensagem fixa atualizada.", false);
      });
    });

    confirmDeleteInput.addEventListener("change", function () {
      currentConfig.confirmDelete = confirmDeleteInput.checked;
      saveConfig(function () {
        showFeedback("Proteção de remoção atualizada.", false);
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
      importExport.exportConfigAsJson(
        schema.normalizeConfig(currentConfig),
        "pmfm-config.json",
      );
      showFeedback("Configuração exportada.", false);
    });

    importButton.addEventListener("click", function () {
      importFile.click();
    });

    importFile.addEventListener("change", function () {
      var file = importFile.files && importFile.files[0];
      if (!file) return;

      importExport.importConfigFromFile(
        file,
        function (parsed) {
          currentConfig = schema.normalizeConfig(parsed);
          lastRemovedRule = null;
          undoRemoveButton.hidden = true;

          saveConfig(function () {
            render();
            showFeedback("Configuração importada.", false);
          });
        },
        function () {
          showFeedback("Arquivo JSON inválido.", true);
        },
      );

      importFile.value = "";
    });
  }

  wireEvents();
  storageApi.loadConfig(function (config) {
    currentConfig = schema.normalizeConfig(config);
    tabController.switchTab("rules");
    render();
  });
})();

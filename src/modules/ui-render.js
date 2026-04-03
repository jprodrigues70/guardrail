(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  /**
   * Cria um controlador de mensagens de feedback para o popup.
   *
   * @param {HTMLElement} feedbackElement Elemento onde a mensagem será exibida.
   * @param {number} timeoutMs Tempo, em milissegundos, para ocultar automaticamente.
   * @returns {{show: Function}} API para exibição de feedback.
   */
  function createFeedbackController(feedbackElement, timeoutMs) {
    var timer = null;
    var hideAfter = Number(timeoutMs) || 2600;

    /**
     * Exibe uma mensagem e agenda ocultação automática.
     *
     * @param {string} message Texto apresentado ao usuário.
     * @param {boolean} isError Define se a aparência deve ser de erro.
     */
    function show(message, isError) {
      feedbackElement.textContent = message;
      feedbackElement.hidden = false;
      feedbackElement.classList.add("feedback--visible");
      feedbackElement.classList.toggle("feedback--error", Boolean(isError));

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        feedbackElement.classList.remove("feedback--visible");
        feedbackElement.classList.remove("feedback--error");
        feedbackElement.textContent = "";
        feedbackElement.hidden = true;
      }, hideAfter);
    }

    return {
      show: show,
    };
  }

  /**
   * Cria um controlador de navegação por abas no popup.
   *
   * @param {NodeList|Array<HTMLElement>} tabButtons Botões de troca de aba.
   * @param {NodeList|Array<HTMLElement>} tabPanels Painéis de conteúdo.
   * @returns {{switchTab: Function, wire: Function}} API de controle das abas.
   */
  function createTabController(tabButtons, tabPanels) {
    /**
     * Ativa a aba solicitada e desativa as demais.
     *
     * @param {string} tabName Nome lógico da aba alvo.
     */
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

    /**
     * Liga os eventos de clique dos botões de aba.
     */
    function wire() {
      tabButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          switchTab(button.getAttribute("data-tab"));
        });
      });
    }

    return {
      switchTab: switchTab,
      wire: wire,
    };
  }

  /**
   * Cria um renderizador para alertas visuais na página (borda e banner).
   *
   * @param {object} options Identificadores e atributos usados no DOM.
   * @returns {{ensureBorder: Function, removeBorder: Function, ensureBanner: Function, removeBanner: Function, clear: Function}} API de renderização.
   */
  function createPageAlertRenderer(options) {
    var borderId = options.borderId;
    var bannerId = options.bannerId;
    var ribbonToggleId = bannerId + "-ribbon-toggle";
    var bodyBasePaddingBottomAttr = options.bodyBasePaddingBottomAttr;
    var bodyInlinePaddingBottomAttr = options.bodyInlinePaddingBottomAttr;
    var bannerOutsideClickHandler = null;
    var bannerEscapeHandler = null;
    var bannerIsMinimized = false;
    var bannerAlwaysMinimized = false;
    var temporaryExpandedByUser = false;
    var currentBannerColor = "#d40000";
    var currentBannerText = "Ambiente";

    function stripPrefix(text, prefix) {
      if (typeof text !== "string") return "";
      return text.indexOf(prefix) === 0 ? text.slice(prefix.length) : text;
    }

    function buildDetailsRows(container, details) {
      if (!container) return;
      container.innerHTML = "";

      var rows = [
        {
          label: "Regra",
          value: stripPrefix(details && details.ruleText, "Regra aplicada: "),
        },
        {
          label: "Perfil",
          value: stripPrefix(details && details.profileText, "Perfil: "),
        },
        {
          label: "URL",
          value: stripPrefix(details && details.urlText, "URL detectada: "),
        },
      ];

      rows.forEach(function (row) {
        if (!row.value) return;

        var item = document.createElement("div");
        item.style.marginTop = "8px";

        var label = document.createElement("div");
        label.textContent = row.label;
        label.style.fontSize = "11px";
        label.style.fontWeight = "700";
        label.style.textTransform = "uppercase";
        label.style.letterSpacing = "0.04em";
        label.style.color = "#4b5563";

        var value = document.createElement("div");
        value.textContent = row.value;
        value.style.marginTop = "2px";
        value.style.fontSize = "12px";
        value.style.fontWeight = "500";
        value.style.color = "#111827";
        value.style.whiteSpace = "normal";
        value.style.overflowWrap = "anywhere";
        value.style.wordBreak = "break-word";

        item.appendChild(label);
        item.appendChild(value);
        container.appendChild(item);
      });
    }

    /**
     * Garante a existência da borda de alerta e atualiza seu estilo.
     *
     * @param {{width:number,lineStyle:string}} style Estilo da borda.
     * @param {string} color Cor da borda.
     */
    function ensureBorder(style, color) {
      var border = document.getElementById(borderId);
      if (!border) {
        border = document.createElement("div");
        border.id = borderId;
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

    /**
     * Remove a borda de alerta, se existir.
     */
    function removeBorder() {
      var existing = document.getElementById(borderId);
      if (existing) existing.remove();
    }

    /**
     * Aplica compensação inferior no body para evitar corte de conteúdo.
     *
     * @param {number} bannerHeight Altura atual do banner renderizado.
     */
    function applyBannerCompensation(bannerHeight) {
      if (!document.body) return;

      var body = document.body;
      if (!body.hasAttribute(bodyInlinePaddingBottomAttr)) {
        body.setAttribute(
          bodyInlinePaddingBottomAttr,
          body.style.paddingBottom || "",
        );
      }

      if (!body.hasAttribute(bodyBasePaddingBottomAttr)) {
        var computed = window.getComputedStyle(body);
        var baseBottom = parseFloat(computed.paddingBottom) || 0;
        body.setAttribute(bodyBasePaddingBottomAttr, String(baseBottom));
      }

      var storedBottom = Number(body.getAttribute(bodyBasePaddingBottomAttr));
      var baseBottomPadding = Number.isFinite(storedBottom) ? storedBottom : 0;
      body.style.paddingBottom =
        String(baseBottomPadding + bannerHeight) + "px";
    }

    /**
     * Restaura o padding inferior original do body.
     */
    function clearBannerCompensation() {
      if (!document.body) return;

      var body = document.body;
      var inlineBottom = body.getAttribute(bodyInlinePaddingBottomAttr);
      body.style.paddingBottom = inlineBottom === null ? "" : inlineBottom;

      body.removeAttribute(bodyBasePaddingBottomAttr);
      body.removeAttribute(bodyInlinePaddingBottomAttr);
    }

    function minimizeBannerNow(color) {
      var banner = document.getElementById(bannerId);
      if (!banner) return;

      bannerIsMinimized = true;
      banner.hidden = true;
      banner.style.display = "none";
      clearBannerCompensation();
      ensureRibbonToggle(color || currentBannerColor);
    }

    function hideRibbonToggle() {
      var ribbon = document.getElementById(ribbonToggleId);
      if (ribbon) ribbon.hidden = true;
    }

    function ensureRibbonToggle(color) {
      var ribbon = document.getElementById(ribbonToggleId);
      if (!ribbon) {
        ribbon = document.createElement("button");
        ribbon.id = ribbonToggleId;
        ribbon.type = "button";
        ribbon.className = "pmfm-ribbon-restore-button";
        ribbon.textContent = "";
        ribbon.title = "Restaurar banner de alerta";
        ribbon.setAttribute("aria-label", "Restaurar banner de alerta");
        ribbon.style.position = "fixed";
        ribbon.style.left = "0";
        ribbon.style.top = "0";
        ribbon.style.width = "0";
        ribbon.style.height = "0";
        ribbon.style.padding = "0";
        ribbon.style.borderTop = "50px solid #d40000";
        ribbon.style.borderBottom = "0px solid transparent";
        ribbon.style.borderLeft = "0 solid transparent";
        ribbon.style.borderRight = "50px solid transparent";
        ribbon.style.borderBottomRightRadius = "200px";
        ribbon.style.background = "transparent";
        ribbon.style.cursor = "pointer";
        ribbon.style.zIndex = "2147483647";
        ribbon.style.filter = "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))";

        ribbon.addEventListener("click", function () {
          var banner = document.getElementById(bannerId);
          if (!banner) return;

          if (bannerAlwaysMinimized) {
            temporaryExpandedByUser = true;
          }

          bannerIsMinimized = false;
          banner.hidden = false;
          banner.style.display = "block";
          ribbon.hidden = true;
          applyBannerCompensation(banner.offsetHeight || 0);
        });

        document.documentElement.appendChild(ribbon);
      }

      ribbon.hidden = false;
      ribbon.style.borderTopColor = color;
      ribbon.title = currentBannerText + ". Clique para expandir";
      ribbon.setAttribute(
        "aria-label",
        bannerAlwaysMinimized
          ? "Banner minimizado permanentemente"
          : "Restaurar banner de alerta",
      );

      return ribbon;
    }

    /**
     * Garante a existência do banner de alerta e atualiza seu conteúdo visual.
     *
     * @param {string} text Texto exibido no banner.
     * @param {string} color Cor de fundo aplicada ao banner.
     * @param {object} details Informações de diagnóstico sobre a regra aplicada.
     */
    function ensureBanner(text, color, details, options) {
      var renderOptions =
        options && typeof options === "object" ? options : Object.create(null);
      bannerAlwaysMinimized = Boolean(renderOptions.alwaysMinimized);
      currentBannerColor = color || currentBannerColor;
      currentBannerText = text || currentBannerText;

      var banner = document.getElementById(bannerId);
      var title = null;
      var detailsButton = null;
      var minimizeButton = null;
      var detailsPopup = null;
      if (!banner) {
        banner = document.createElement("div");
        banner.id = bannerId;
        banner.setAttribute("aria-live", "polite");
        banner.style.display = "block";
        banner.style.width = "100%";
        banner.style.padding = "4px 12px";
        banner.style.textAlign = "center";
        banner.style.fontFamily = "Segoe UI, sans-serif";
        banner.style.fontSize = "13px";
        banner.style.fontWeight = "700";
        banner.style.letterSpacing = "0.02em";
        banner.style.color = "#ffffff";
        banner.style.boxSizing = "border-box";
        banner.style.position = "relative";

        var titleRow = document.createElement("div");
        titleRow.className = "pmfm-banner-title-row";
        titleRow.style.display = "inline-flex";
        titleRow.style.alignItems = "center";
        titleRow.style.justifyContent = "center";
        titleRow.style.gap = "8px";

        title = document.createElement("div");
        title.className = "pmfm-banner-title";
        titleRow.appendChild(title);

        detailsButton = document.createElement("button");
        detailsButton.type = "button";
        detailsButton.className = "pmfm-banner-help-button";
        detailsButton.textContent = "?";
        detailsButton.setAttribute(
          "aria-label",
          "Mostrar detalhes da regra aplicada",
        );
        detailsButton.setAttribute("aria-expanded", "false");
        detailsButton.title = "Ver detalhes da regra aplicada";
        detailsButton.style.width = "24px";
        detailsButton.style.height = "24px";
        detailsButton.style.minHeight = "auto";
        detailsButton.style.borderRadius = "999px";
        detailsButton.style.display = "flex";
        detailsButton.style.alignItems = "center";
        detailsButton.style.justifyContent = "center";
        detailsButton.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
        detailsButton.style.backdropFilter = "blur(4px)";
        detailsButton.style.color = "#ffffff";
        detailsButton.style.fontSize = "14px";
        detailsButton.style.fontWeight = "700";
        detailsButton.style.cursor = "pointer";
        detailsButton.style.lineHeight = "1";
        detailsButton.style.padding = "0";
        detailsButton.style.boxShadow = "0 3px 10px rgba(15, 23, 42, 0.25)";
        titleRow.appendChild(detailsButton);

        minimizeButton = document.createElement("button");
        minimizeButton.type = "button";
        minimizeButton.className = "pmfm-banner-minimize-button";
        minimizeButton.textContent = "−";
        minimizeButton.setAttribute("aria-label", "Minimizar banner de alerta");
        minimizeButton.title = "Minimizar banner";
        minimizeButton.style.width = "24px";
        minimizeButton.style.height = "24px";
        minimizeButton.style.minHeight = "auto";
        minimizeButton.style.borderRadius = "999px";
        minimizeButton.style.display = "flex";
        minimizeButton.style.alignItems = "center";
        minimizeButton.style.justifyContent = "center";
        minimizeButton.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
        minimizeButton.style.backdropFilter = "blur(4px)";
        minimizeButton.style.color = "#ffffff";
        minimizeButton.style.fontSize = "16px";
        minimizeButton.style.fontWeight = "700";
        minimizeButton.style.cursor = "pointer";
        minimizeButton.style.lineHeight = "1";
        minimizeButton.style.padding = "0";
        minimizeButton.style.boxShadow = "0 3px 10px rgba(15, 23, 42, 0.25)";
        titleRow.appendChild(minimizeButton);

        banner.appendChild(titleRow);

        detailsPopup = document.createElement("div");
        detailsPopup.className = "pmfm-banner-popup";
        detailsPopup.hidden = true;
        detailsPopup.style.position = "absolute";
        detailsPopup.style.top = "calc(100% + 6px)";
        detailsPopup.style.right = "12px";
        detailsPopup.style.maxWidth = "min(560px, calc(100vw - 24px))";
        detailsPopup.style.padding = "10px 12px";
        detailsPopup.style.borderRadius = "8px";
        detailsPopup.style.background = "#ffffff";
        detailsPopup.style.color = "#1f2937";
        detailsPopup.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.2)";
        detailsPopup.style.border = "1px solid rgba(15, 23, 42, 0.12)";
        detailsPopup.style.fontSize = "12px";
        detailsPopup.style.lineHeight = "1.45";
        detailsPopup.style.fontWeight = "500";
        detailsPopup.style.textAlign = "left";
        detailsPopup.style.whiteSpace = "normal";
        detailsPopup.style.zIndex = "2147483647";
        banner.appendChild(detailsPopup);

        detailsButton.addEventListener("click", function (event) {
          event.stopPropagation();
          var opening = detailsPopup.hidden;
          detailsPopup.hidden = !opening;
          detailsButton.setAttribute(
            "aria-expanded",
            opening ? "true" : "false",
          );
        });

        minimizeButton.addEventListener("click", function (event) {
          event.stopPropagation();
          temporaryExpandedByUser = false;
          detailsPopup.hidden = true;
          detailsButton.setAttribute("aria-expanded", "false");
          minimizeBannerNow(color);
        });

        bannerOutsideClickHandler = function (event) {
          if (detailsPopup.hidden) return;
          if (detailsPopup.contains(event.target)) return;
          if (detailsButton.contains(event.target)) return;
          detailsPopup.hidden = true;
          detailsButton.setAttribute("aria-expanded", "false");
        };
        document.addEventListener("click", bannerOutsideClickHandler);

        bannerEscapeHandler = function (event) {
          if (event.key !== "Escape") return;
          if (detailsPopup.hidden) return;
          detailsPopup.hidden = true;
          detailsButton.setAttribute("aria-expanded", "false");
        };
        document.addEventListener("keydown", bannerEscapeHandler);

        if (document.body) {
          document.body.insertBefore(banner, document.body.firstChild);
        } else {
          document.documentElement.appendChild(banner);
        }
      }

      title = title || banner.querySelector(".pmfm-banner-title");
      detailsButton =
        detailsButton || banner.querySelector(".pmfm-banner-help-button");
      minimizeButton =
        minimizeButton || banner.querySelector(".pmfm-banner-minimize-button");
      detailsPopup = detailsPopup || banner.querySelector(".pmfm-banner-popup");

      banner.style.background = color;
      if (title) {
        title.textContent = text;
      } else {
        banner.textContent = text;
      }

      if (detailsButton && detailsPopup) {
        var detailText = [
          details && details.ruleText,
          details && details.profileText,
          details && details.urlText,
        ]
          .filter(Boolean)
          .join(" | ");

        if (detailText) {
          detailsButton.hidden = false;
          buildDetailsRows(detailsPopup, details);
          detailsPopup.title = detailText;
        } else {
          detailsPopup.hidden = true;
          detailsButton.hidden = true;
          detailsButton.setAttribute("aria-expanded", "false");
        }
      }

      if (minimizeButton) {
        minimizeButton.hidden = false;
      }

      if (bannerIsMinimized) {
        minimizeBannerNow(color);
        return;
      }

      if (bannerAlwaysMinimized && !temporaryExpandedByUser) {
        bannerIsMinimized = true;
        minimizeBannerNow(color);
        return;
      }

      banner.hidden = false;
      banner.style.display = "block";
      hideRibbonToggle();

      if (!bannerAlwaysMinimized) {
        temporaryExpandedByUser = false;
      }

      applyBannerCompensation(banner.offsetHeight || 0);
    }

    /**
     * Remove o banner e limpa qualquer compensação de layout associada.
     */
    function removeBanner() {
      var banner = document.getElementById(bannerId);
      if (banner) banner.remove();

      var ribbon = document.getElementById(ribbonToggleId);
      if (ribbon) ribbon.remove();

      bannerIsMinimized = false;
      bannerAlwaysMinimized = false;
      temporaryExpandedByUser = false;

      if (bannerOutsideClickHandler) {
        document.removeEventListener("click", bannerOutsideClickHandler);
        bannerOutsideClickHandler = null;
      }

      if (bannerEscapeHandler) {
        document.removeEventListener("keydown", bannerEscapeHandler);
        bannerEscapeHandler = null;
      }

      clearBannerCompensation();
    }

    /**
     * Limpa todos os elementos visuais de alerta da página.
     */
    function clear() {
      removeBorder();
      removeBanner();
    }

    return {
      ensureBorder: ensureBorder,
      removeBorder: removeBorder,
      ensureBanner: ensureBanner,
      removeBanner: removeBanner,
      clear: clear,
    };
  }

  root.uiRender = {
    createFeedbackController: createFeedbackController,
    createTabController: createTabController,
    createPageAlertRenderer: createPageAlertRenderer,
  };
})();

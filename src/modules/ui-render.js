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
    var bodyBasePaddingBottomAttr = options.bodyBasePaddingBottomAttr;
    var bodyInlinePaddingBottomAttr = options.bodyInlinePaddingBottomAttr;

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

    /**
     * Garante a existência do banner de alerta e atualiza seu conteúdo visual.
     *
     * @param {string} text Texto exibido no banner.
     * @param {string} color Cor de fundo aplicada ao banner.
     */
    function ensureBanner(text, color) {
      var banner = document.getElementById(bannerId);
      if (!banner) {
        banner = document.createElement("div");
        banner.id = bannerId;
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

      banner.style.background = color;
      banner.textContent = text;
      applyBannerCompensation(banner.offsetHeight || 0);
    }

    /**
     * Remove o banner e limpa qualquer compensação de layout associada.
     */
    function removeBanner() {
      var banner = document.getElementById(bannerId);
      if (banner) banner.remove();
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

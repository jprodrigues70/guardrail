(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  function createFeedbackController(feedbackElement, timeoutMs) {
    var timer = null;
    var hideAfter = Number(timeoutMs) || 2600;

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

  function createTabController(tabButtons, tabPanels) {
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

  function createPageAlertRenderer(options) {
    var borderId = options.borderId;
    var bannerId = options.bannerId;
    var bodyBasePaddingBottomAttr = options.bodyBasePaddingBottomAttr;
    var bodyInlinePaddingBottomAttr = options.bodyInlinePaddingBottomAttr;

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

    function removeBorder() {
      var existing = document.getElementById(borderId);
      if (existing) existing.remove();
    }

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

    function clearBannerCompensation() {
      if (!document.body) return;

      var body = document.body;
      var inlineBottom = body.getAttribute(bodyInlinePaddingBottomAttr);
      body.style.paddingBottom = inlineBottom === null ? "" : inlineBottom;

      body.removeAttribute(bodyBasePaddingBottomAttr);
      body.removeAttribute(bodyInlinePaddingBottomAttr);
    }

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

    function removeBanner() {
      var banner = document.getElementById(bannerId);
      if (banner) banner.remove();
      clearBannerCompensation();
    }

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

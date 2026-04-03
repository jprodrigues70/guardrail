(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  /**
   * Recupera o nome amigável de um perfil a partir do id.
   *
   * @param {object} config Configuração atual com lista de perfis.
   * @param {string} profileId Identificador do perfil procurado.
   * @returns {string} Nome do perfil ou texto padrão quando não encontrado.
   */
  function getProfileName(config, profileId) {
    var profile = config.profiles.find(function (item) {
      return item.id === profileId;
    });
    return profile ? profile.name : "Sem perfil";
  }

  /**
   * Resolve o estilo final de um perfil (cor e texto do banner).
   *
   * Aplica fallback seguro quando o perfil não possui configuração específica.
   *
   * @param {object} config Configuração completa da extensão.
   * @param {string} profileId Identificador do perfil.
   * @param {string} fallbackBannerText Texto alternativo para banner.
   * @returns {{color:string,bannerText:string}} Estilo consolidado do perfil.
   */
  function getProfileStyle(config, profileId, fallbackBannerText) {
    var fallback = {
      color: "#d40000",
      bannerText: fallbackBannerText || "Ambiente sensível",
    };

    var style = config.profileStyles[profileId];
    if (!style) return fallback;

    return {
      color: style.color || fallback.color,
      bannerText: style.bannerText || fallback.bannerText,
    };
  }

  root.profiles = {
    getProfileName: getProfileName,
    getProfileStyle: getProfileStyle,
  };
})();

(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  function getProfileName(config, profileId) {
    var profile = config.profiles.find(function (item) {
      return item.id === profileId;
    });
    return profile ? profile.name : "Sem perfil";
  }

  function getProfileStyle(config, profileId, fallbackBannerText) {
    var fallback = {
      color: "#d40000",
      bannerText: fallbackBannerText || "Ambiente sensivel",
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

(function () {
  "use strict";

  var root = (globalThis.GuardRailModules = globalThis.GuardRailModules || {});

  var STORAGE_KEY = "pmfmConfig";
  var LEGACY_PREFIX_KEY = "urlPrefixes";

  var RULE_TYPES = {
    startsWith: "Comeca com",
    contains: "Contem",
    regex: "Regex",
    domain: "Dominio exato",
  };

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

  /**
   * Converte qualquer entrada para texto seguro e sem espaços nas extremidades.
   *
   * @param {*} value Valor recebido de formulário, storage ou importação.
   * @returns {string} Texto higienizado para uso interno.
   */
  function sanitizeText(value) {
    return (typeof value === "string" ? value : "").trim();
  }

  /**
   * Realiza clonagem profunda simples via serialização JSON.
   *
   * Adequado para objetos de configuração com dados serializáveis.
   *
   * @param {*} value Estrutura a ser clonada.
   * @returns {*} Cópia independente do valor original.
   */
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Gera um identificador único para regras.
   *
   * A composição usa timestamp e componente aleatório para reduzir colisões
   * durante adições sequenciais rápidas.
   *
   * @returns {string} Identificador no formato rule-<tempo>-<aleatório>.
   */
  function makeId() {
    return "rule-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  /**
   * Normaliza uma cor hexadecimal no formato #RRGGBB.
   *
   * @param {string} value Cor recebida.
   * @param {string} fallback Cor de fallback quando o valor for inválido.
   * @returns {string} Cor validada para renderização.
   */
  function normalizeColor(value, fallback) {
    var color = sanitizeText(value);
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    return fallback;
  }

  /**
   * Normaliza a lista de perfis garantindo id, nome e estado habilitado.
   *
   * Remove entradas inválidas e aplica padrão quando necessário.
   *
   * @param {Array<object>} value Lista bruta de perfis.
   * @returns {Array<object>} Lista de perfis válida.
   */
  function normalizeProfiles(value) {
    var source = Array.isArray(value) ? value : DEFAULT_PROFILES;
    var profiles = source
      .map(function (profile) {
        var id = sanitizeText(profile && profile.id);
        var name = sanitizeText(profile && profile.name);
        if (!id || !name) return null;
        return { id: id, name: name, enabled: Boolean(profile.enabled) };
      })
      .filter(Boolean);

    return profiles.length ? profiles : clone(DEFAULT_PROFILES);
  }

  /**
   * Normaliza as preferências visuais da borda.
   *
   * Garante faixa de largura aceitável e restringe estilo aos valores suportados.
   *
   * @param {object} value Objeto de estilo bruto.
   * @returns {{width:number,lineStyle:string}} Estilo válido para a página.
   */
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

  /**
   * Normaliza estilos por perfil (cor e texto de banner).
   *
   * Usa dados padrão do sistema e pode aproveitar cor legada quando disponível.
   *
   * @param {object} rawProfileStyles Mapa bruto vindo do storage/importação.
   * @param {Array<object>} profiles Perfis válidos já normalizados.
   * @param {string} legacyColor Cor antiga que pode servir de fallback.
   * @returns {object} Mapa de estilos por id de perfil.
   */
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

  /**
   * Normaliza a coleção de regras.
   *
   * Regras inválidas são descartadas; tipos e perfis são corrigidos para valores
   * suportados; duplicatas são removidas de forma case-insensitive.
   *
   * @param {Array<object>} value Lista bruta de regras.
   * @param {object} profileIds Conjunto de ids de perfis válidos.
   * @returns {Array<object>} Lista de regras consistente.
   */
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
        if (!profileIds[profileId]) profileId = DEFAULT_PROFILES[0].id;

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

  /**
   * Normaliza a configuração completa usada pela extensão.
   *
   * Esta função é o ponto único de saneamento para leituras de storage,
   * importações e migrações.
   *
   * @param {object} rawConfig Configuração bruta.
   * @returns {object} Configuração pronta para uso.
   */
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

  /**
   * Normaliza uma lista legada de prefixos.
   *
   * Remove entradas vazias e duplicadas ignorando diferença de maiúsculas.
   *
   * @param {Array<string>} value Prefixos antigos.
   * @returns {Array<string>} Prefixos válidos e únicos.
   */
  function normalizePrefixes(value) {
    if (!Array.isArray(value)) return [];

    var seen = Object.create(null);
    return value
      .map(function (prefix) {
        return sanitizeText(prefix);
      })
      .filter(function (prefix) {
        if (!prefix) return false;
        var key = prefix.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  /**
   * Constrói a configuração nova a partir de dados legados baseados em prefixo.
   *
   * Cada prefixo vira uma regra startsWith associada ao perfil padrão.
   *
   * @param {Array<string>} prefixes Lista antiga de prefixos.
   * @returns {object} Configuração no formato atual da extensão.
   */
  function buildConfigFromLegacy(prefixes) {
    return {
      rules: normalizePrefixes(prefixes).map(function (prefix) {
        return {
          id: makeId(),
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

  root.configSchema = {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_PREFIX_KEY: LEGACY_PREFIX_KEY,
    RULE_TYPES: RULE_TYPES,
    DEFAULT_PROFILES: DEFAULT_PROFILES,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    sanitizeText: sanitizeText,
    clone: clone,
    makeId: makeId,
    normalizeColor: normalizeColor,
    normalizeProfiles: normalizeProfiles,
    normalizeStyle: normalizeStyle,
    normalizeProfileStyles: normalizeProfileStyles,
    normalizeRules: normalizeRules,
    normalizeConfig: normalizeConfig,
    normalizePrefixes: normalizePrefixes,
    buildConfigFromLegacy: buildConfigFromLegacy,
  };
})();

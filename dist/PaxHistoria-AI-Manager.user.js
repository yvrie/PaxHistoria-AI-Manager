// ==UserScript==
// @name         PaxHistoria - AI Manager
// @namespace    https://paxhistoria.co/
// @homepageURL  https://github.com/yvrie/PaxHistoria-AI-Manager
// @supportURL   https://github.com/yvrie/PaxHistoria-AI-Manager/issues
// @version      1.0.0
// @description  Connect AI providers and choose models for Pax Historia features.
// @match        https://paxhistoria.co/*
// @match        https://www.paxhistoria.co/*
// @match        http://paxhistoria.co/*
// @match        http://www.paxhistoria.co/*
// @match        https://paxhistoria.co/game/*
// @match        https://www.paxhistoria.co/game/*
// @include      https://paxhistoria.co/*
// @include      https://www.paxhistoria.co/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @connect      *
// @run-at       document-start
// @noframes
// ==/UserScript==
/* jshint esversion: 11, browser: true */

(() => {
  // src/relay/registry.js
  var FEATURED_PROVIDERS = Object.freeze([
    "google",
    "zai",
    "openrouter",
    "openai"
  ]);
  var PROVIDER_DESCRIPTIONS = Object.freeze({
    google: "Google's Gemini AI, with available models found automatically.",
    zai: "Z.ai's GLM models.",
    openrouter: "One account that can connect to models from many providers.",
    openai: "OpenAI's GPT models."
  });
  var baseline = {
    chat: true,
    responses: false,
    jsonMode: false,
    jsonSchema: false,
    tools: false,
    reasoningControls: false,
    temperature: true,
    maxOutputTokens: true,
    streaming: false,
    systemMessages: true,
    modelDiscovery: true,
    vision: false
  };
  var ProviderRegistry = class {
    constructor() {
      this.providers = /* @__PURE__ */ new Map();
      this.protocols = /* @__PURE__ */ new Map();
    }
    register(metadata) {
      const enriched = !metadata.description && PROVIDER_DESCRIPTIONS[metadata.id] ? { ...metadata, description: PROVIDER_DESCRIPTIONS[metadata.id] } : metadata;
      this.providers.set(
        enriched.id,
        Object.freeze({
          ...enriched,
          capabilities: { ...baseline, ...enriched.capabilities }
        })
      );
      return this;
    }
    protocol(id, adapter) {
      this.protocols.set(id, adapter);
      return this;
    }
    adapter(profile) {
      const protocolId = profile.providerId === "lmstudio" && profile.protocol === "openai-chat" ? "lmstudio-chat" : profile.protocol;
      const adapter = this.protocols.get(protocolId);
      if (!adapter) {
        throw new Error(
          `Protocol ${profile.protocol} requires a cloud or provider-specific adapter. It is not available in this build.`
        );
      }
      return adapter;
    }
  };
  var registry = new ProviderRegistry();
  var entries = [
    ["openai", "OpenAI", "https://api.openai.com/v1"],
    ["openrouter", "OpenRouter", "https://openrouter.ai/api/v1"],
    ["groq", "Groq", "https://api.groq.com/openai/v1"],
    ["xai", "xAI", "https://api.x.ai/v1"],
    ["deepseek", "DeepSeek", "https://api.deepseek.com/v1"],
    ["mistral", "Mistral AI", "https://api.mistral.ai/v1"],
    ["together", "Together AI", "https://api.together.xyz/v1"],
    ["fireworks", "Fireworks AI", "https://api.fireworks.ai/inference/v1"],
    ["deepinfra", "DeepInfra", "https://api.deepinfra.com/v1/openai"],
    ["cerebras", "Cerebras", "https://api.cerebras.ai/v1"],
    ["huggingface", "Hugging Face Router", "https://router.huggingface.co/v1"],
    ["perplexity", "Perplexity Sonar", "https://api.perplexity.ai"],
    ["sambanova", "SambaNova", "https://api.sambanova.ai/v1"],
    ["novita", "Novita AI", "https://api.novita.ai/v3/openai"],
    ["nvidia", "NVIDIA NIM", "https://integrate.api.nvidia.com/v1"],
    ["zai", "Z.ai", "https://api.z.ai/api/paas/v4"],
    ["hyperbolic", "Hyperbolic", "https://api.hyperbolic.xyz/v1"],
    ["featherless", "Featherless AI", "https://api.featherless.ai/v1"],
    ["scaleway", "Scaleway AI", "https://api.scaleway.ai/v1"],
    [
      "ovh",
      "OVHcloud AI Endpoints",
      "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1"
    ]
  ];
  for (const [id, label, endpoint2] of entries) {
    registry.register({
      id,
      label,
      endpoint: endpoint2,
      protocol: id === "openrouter" ? "openrouter-chat" : "openai-chat",
      auth: "bearer",
      group: "Hosted APIs"
    });
  }
  registry.register({
    ...registry.providers.get("openai"),
    capabilities: { temperature: false, jsonMode: true, jsonSchema: true },
    tokenParameter: "max_completion_tokens"
  });
  registry.register({
    ...registry.providers.get("deepseek"),
    capabilities: { jsonMode: true }
  });
  registry.register({
    id: "google",
    label: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    protocol: "gemini-generate-content",
    auth: "header",
    authName: "x-goog-api-key",
    group: "Hosted APIs",
    // Used only when Google's model directory is temporarily unavailable.
    modelHints: [
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash-lite",
      "gemini-3-flash"
    ],
    capabilities: { jsonMode: true, jsonSchema: true }
  });
  registry.register({
    id: "anthropic",
    label: "Anthropic Claude",
    endpoint: "https://api.anthropic.com/v1",
    protocol: "anthropic-messages",
    auth: "header",
    authName: "x-api-key",
    group: "Hosted APIs",
    capabilities: { jsonSchema: true }
  });
  for (const [id, label, endpoint2] of [
    ["ollama", "Ollama", "http://127.0.0.1:11434"],
    ["lmstudio", "LM Studio", "http://127.0.0.1:1234/v1"],
    ["vllm", "vLLM", "http://127.0.0.1:8000/v1"],
    ["llamacpp", "llama.cpp", "http://127.0.0.1:8080/v1"],
    ["localai", "LocalAI", "http://127.0.0.1:8080/v1"],
    ["kobold", "KoboldCpp", "http://127.0.0.1:5001/v1"],
    ["textwebui", "text-generation-webui", "http://127.0.0.1:5000/v1"]
  ]) {
    registry.register({
      id,
      label,
      endpoint: endpoint2,
      protocol: id === "ollama" ? "ollama-native" : id === "lmstudio" ? "lmstudio-chat" : "openai-chat",
      auth: "none",
      group: "Local",
      capabilities: { jsonSchema: id === "ollama" || id === "lmstudio" }
    });
  }
  for (const [id, label, protocol] of [
    ["azure", "Azure AI", "azure"],
    ["bedrock", "Amazon Bedrock", "bedrock"],
    ["vertex", "Google Vertex AI", "vertex"],
    ["replicate", "Replicate", "replicate"],
    ["cohere", "Cohere", "cohere"],
    ["baseten", "Baseten", "custom-native"],
    ["cloudflare", "Cloudflare Workers AI", "custom-native"]
  ]) {
    registry.register({
      id,
      label,
      protocol,
      endpoint: "",
      auth: "bearer",
      group: "Cloud / native setup",
      capabilities: { modelDiscovery: false }
    });
  }
  registry.register({
    ...registry.providers.get("azure"),
    auth: "header",
    authName: "api-key",
    capabilities: { modelDiscovery: false, temperature: false },
    tokenParameter: "max_completion_tokens"
  });
  registry.register({
    id: "custom",
    label: "Custom API",
    protocol: "openai-chat",
    endpoint: "",
    auth: "bearer",
    group: "Advanced"
  });
  function randomId() {
    var _a2;
    if (typeof ((_a2 = globalThis.crypto) == null ? void 0 : _a2.randomUUID) === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  function newProfile(providerId = "custom") {
    const preset = registry.providers.get(providerId);
    if (!preset) {
      throw new Error("Unknown provider preset.");
    }
    return {
      id: randomId(),
      label: preset.label,
      providerId,
      protocol: preset.protocol,
      endpoint: preset.endpoint,
      credentials: {
        mode: preset.auth,
        name: preset.authName || "",
        secret: "",
        boundEndpoint: preset.endpoint
      },
      defaultModel: "",
      modelHints: [...preset.modelHints || []],
      options: {
        temperature: 0.7,
        maxOutputTokens: providerId === "lmstudio" ? 4096 : 16384,
        timeoutMs: 12e4,
        tokenParameter: preset.tokenParameter || "max_tokens"
      },
      capabilities: { ...preset.capabilities },
      headers: {},
      completionPath: "",
      modelPath: ""
    };
  }
  function modelHintsFor(profile) {
    var _a2, _b2;
    if ((_a2 = profile.modelHints) == null ? void 0 : _a2.length) {
      return profile.modelHints;
    }
    return ((_b2 = registry.providers.get(profile.providerId)) == null ? void 0 : _b2.modelHints) || [];
  }
  function capabilitiesFor(profile, modelMeta = null) {
    const caps = { ...profile.capabilities || {} };
    if (profile.providerId === "deepseek") {
      caps.jsonMode = true;
    }
    if (profile.providerId === "lmstudio") {
      caps.jsonSchema = true;
    }
    if (profile.providerId === "anthropic") {
      caps.jsonSchema = true;
    }
    return { ...caps, ...(modelMeta == null ? void 0 : modelMeta.capabilities) || {} };
  }

  // src/relay/migration.js
  async function migrateConfiguration(port, doc, makeProfile) {
    var _a2, _b2;
    const old = await port.get("pax-ai-relay.settings.v1");
    if (!old) {
      return doc;
    }
    const active = old.active || old;
    const records = { ...old.profiles, [active.provider]: active };
    const ids = {};
    for (const [provider, record] of Object.entries(records)) {
      if (!record || !provider || provider === "undefined") {
        continue;
      }
      const p = makeProfile(provider === "generic" ? "custom" : provider);
      p.endpoint = record.baseUrl || p.endpoint;
      p.defaultModel = record.model || "";
      if (provider === "ollama") {
        p.protocol = "openai-chat";
      }
      p.credentials.secret = record.apiKey || "";
      p.credentials.boundEndpoint = p.endpoint;
      p.options = {
        ...p.options,
        temperature: (_a2 = record.temperature) != null ? _a2 : 0.7,
        maxOutputTokens: record.maxTokens || (p.providerId === "lmstudio" ? 4096 : 16384)
      };
      doc.profiles[p.id] = p;
      ids[provider] = p.id;
    }
    doc.activeProfileId = ids[active.provider] || "";
    doc.behavior.fallback = active.fallbackToPax ? "pax" : "error";
    const routing = old.routing || active.routing;
    if (routing == null ? void 0 : routing.enabled) {
      for (const [kind, previous] of [
        ["conversation", "conversation"],
        ["advisor", "advisor"],
        ["lightweight", "emotes"]
      ]) {
        doc.routes[kind] = {
          profileId: ids[routing[previous]] || doc.activeProfileId,
          model: ((_b2 = routing.models) == null ? void 0 : _b2[previous]) || "",
          fallbackModels: []
        };
      }
    }
    return doc;
  }

  // src/relay/config.js
  var CONFIG_KEY = "historia-relay.document.v2";
  var routeKinds = ["conversation", "advisor", "lightweight"];
  function normalizeConfiguration(input) {
    const doc = structuredClone(input);
    doc.migrations = { ...doc.migrations || {} };
    doc.routes || (doc.routes = {});
    for (const kind of routeKinds) {
      const route = doc.routes[kind] || {};
      doc.routes[kind] = {
        profileId: String(route.profileId || ""),
        model: String(route.model || ""),
        fallbackModels: [
          ...new Set(
            (Array.isArray(route.fallbackModels) ? route.fallbackModels : []).map((model) => String(model).trim()).filter(Boolean)
          )
        ]
      };
    }
    doc.behavior = {
      fallback: "error",
      fallbackProfiles: [],
      debug: false,
      ...doc.behavior || {}
    };
    doc.behavior.fallbackProfiles = [
      ...new Set(
        (Array.isArray(doc.behavior.fallbackProfiles) ? doc.behavior.fallbackProfiles : []).filter(Boolean)
      )
    ];
    return doc;
  }
  function emptyConfiguration() {
    return {
      version: 2,
      profiles: {},
      activeProfileId: "",
      routes: Object.fromEntries(
        routeKinds.map((kind) => [
          kind,
          { profileId: "", model: "", fallbackModels: [] }
        ])
      ),
      behavior: { fallback: "error", fallbackProfiles: [], debug: false },
      ui: {},
      migrations: { lmStudioOutputBudgetV1: true }
    };
  }
  var ConfigStore = class {
    constructor(port) {
      this.port = port;
    }
    async read() {
      var _a2;
      const saved = await this.port.get(CONFIG_KEY);
      if (saved) {
        if (saved.version !== 2) {
          throw new Error("Unsupported settings version.");
        }
        const normalized = normalizeConfiguration(saved);
        if (!normalized.migrations.lmStudioOutputBudgetV1) {
          for (const profile of Object.values(normalized.profiles || {})) {
            if ((profile == null ? void 0 : profile.providerId) === "lmstudio" && Number((_a2 = profile.options) == null ? void 0 : _a2.maxOutputTokens) === 16384) {
              profile.options.maxOutputTokens = 4096;
            }
          }
          normalized.migrations.lmStudioOutputBudgetV1 = true;
          return this.write(normalized);
        }
        return normalized;
      }
      if (!this.migrating) {
        this.migrating = (async () => {
          const doc = await migrateConfiguration(
            this.port,
            emptyConfiguration(),
            newProfile
          );
          return this.write(doc);
        })().catch((error) => {
          this.migrating = void 0;
          throw error;
        });
      }
      return structuredClone(await this.migrating);
    }
    async write(doc) {
      if (doc.version !== 2 || !doc.profiles || !doc.routes) {
        throw new Error("Invalid settings document.");
      }
      const normalized = normalizeConfiguration(doc);
      normalized.revision = Number(doc.revision || 0) + 1;
      await this.port.set(CONFIG_KEY, structuredClone(normalized));
      return normalized;
    }
  };

  // src/relay/diagnostics.js
  var RelayFailure = class extends Error {
    constructor(category, message, status = 0) {
      super(message);
      this.category = category;
      this.status = status;
    }
  };
  var Diagnostics = class {
    constructor() {
      this.events = [];
    }
    emit(category, details = {}) {
      const entry = {
        time: (/* @__PURE__ */ new Date()).toISOString(),
        category,
        requestId: details.requestId,
        status: details.status,
        attempt: details.attempt,
        delayMs: details.delayMs
      };
      this.events.push(entry);
      if (this.events.length > 80) {
        this.events.shift();
      }
      if (this.enabled) {
        console.debug("[PaxHistoria - AI Manager]", entry);
      }
    }
  };

  // src/relay/transport.js
  function endpoint(value) {
    let u;
    try {
      u = new URL(value);
    } catch (e) {
      throw new RelayFailure("configuration", "Enter a complete API URL.");
    }
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.hash) {
      throw new RelayFailure(
        "configuration",
        "Use an HTTP or HTTPS URL without embedded credentials or fragments."
      );
    }
    return u;
  }
  function authenticatedRequest(profile, path) {
    const base = endpoint(profile.endpoint), url = new URL(path || "", `${base.href.replace(/\/$/, "")}/`);
    if (url.origin !== base.origin) {
      throw new RelayFailure(
        "configuration",
        "Completion and model endpoints must belong to the profile origin."
      );
    }
    const credential = profile.credentials || {}, headers = { "Content-Type": "application/json" };
    if (/[\r\n]/.test(
      String(credential.secret || "") + String(credential.name || "")
    ) || /^(cookie|host|content-length|proxy-authorization)$/i.test(
      credential.name || ""
    )) {
      throw new RelayFailure(
        "configuration",
        "Authentication contains an invalid header or newline."
      );
    }
    if ((credential.secret || Object.keys(profile.headers || {}).length) && credential.boundEndpoint !== profile.endpoint) {
      throw new RelayFailure(
        "configuration",
        "The endpoint changed. Clear the old key and enter credentials for this endpoint."
      );
    }
    for (const [key, value] of Object.entries(profile.headers || {})) {
      if (/^(cookie|host|content-length|authorization|proxy-authorization)$/i.test(
        key
      ) || /[\r\n]/.test(key + value)) {
        throw new RelayFailure(
          "configuration",
          "Custom headers contain a reserved or invalid header."
        );
      }
      headers[key] = String(value);
    }
    if (credential.mode !== "none") {
      if (!credential.secret) {
        throw new RelayFailure(
          "authentication",
          "Enter a key for this profile.",
          401
        );
      }
      if (credential.mode === "bearer") {
        headers.Authorization = `Bearer ${credential.secret}`;
      } else if (credential.mode === "header" && credential.name) {
        headers[credential.name] = credential.secret;
      } else if (credential.mode === "query" && credential.name) {
        url.searchParams.set(credential.name, credential.secret);
      } else {
        throw new RelayFailure(
          "configuration",
          "Choose an authentication type and header or parameter name."
        );
      }
    }
    return { url: url.href, headers };
  }
  function browserHttp(spec) {
    var _a2, _b2;
    const gm = globalThis.GM_xmlhttpRequest || ((_b2 = (_a2 = globalThis.GM) == null ? void 0 : _a2.xmlHttpRequest) == null ? void 0 : _b2.bind(globalThis.GM));
    if (!gm) {
      throw new RelayFailure(
        "configuration",
        "Enable the userscript manager HTTP permission."
      );
    }
    return new Promise((resolve, reject) => {
      var _a3, _b3, _c2;
      let handle, done = false;
      const finish = (fn, value) => {
        var _a4;
        if (done) {
          return;
        }
        done = true;
        (_a4 = spec.signal) == null ? void 0 : _a4.removeEventListener("abort", abort);
        fn(value);
      };
      const abort = () => {
        var _a4;
        if (done) {
          return;
        }
        finish(reject, new RelayFailure("cancelled", "Request cancelled."));
        (_a4 = handle == null ? void 0 : handle.abort) == null ? void 0 : _a4.call(handle);
      };
      if ((_a3 = spec.signal) == null ? void 0 : _a3.aborted) {
        return abort();
      }
      (_b3 = spec.signal) == null ? void 0 : _b3.addEventListener("abort", abort, { once: true });
      const sameOrigin = (finalUrl) => {
        try {
          return new URL(finalUrl).origin === new URL(spec.url).origin;
        } catch (e) {
          return false;
        }
      };
      const receive = (r) => {
        if (r.finalUrl && !sameOrigin(r.finalUrl)) {
          return finish(
            reject,
            new RelayFailure(
              "configuration",
              "The API redirected to another origin."
            )
          );
        }
        let json;
        try {
          json = JSON.parse(r.responseText);
        } catch (e) {
        }
        finish(resolve, {
          status: r.status,
          headers: r.responseHeaders,
          json,
          text: r.responseText
        });
      };
      try {
        handle = gm({
          url: spec.url,
          method: spec.method || "POST",
          headers: spec.headers,
          data: spec.body === void 0 ? void 0 : JSON.stringify(spec.body),
          timeout: spec.timeoutMs,
          anonymous: true,
          redirect: "error",
          onload: receive,
          onerror: () => finish(
            reject,
            new RelayFailure("network", "The API could not be reached.")
          ),
          ontimeout: () => finish(
            reject,
            new RelayFailure("timeout", "The API did not respond in time.")
          ),
          onabort: abort
        });
        (_c2 = handle == null ? void 0 : handle.then) == null ? void 0 : _c2.call(
          handle,
          receive,
          () => finish(reject, new RelayFailure("network", "The API request failed."))
        );
      } catch (e) {
        finish(
          reject,
          new RelayFailure("network", "The API request could not start.")
        );
      }
    });
  }
  function retryDelay(response, now = Date.now()) {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h, _i, _j, _k;
    const header = typeof response.headers === "string" ? (_a2 = response.headers.match(/^retry-after:\s*(.+)$/im)) == null ? void 0 : _a2[1] : (_c2 = (_b2 = response.headers) == null ? void 0 : _b2.get) == null ? void 0 : _c2.call(_b2, "retry-after");
    const details = ((_e2 = (_d2 = response.json) == null ? void 0 : _d2.error) == null ? void 0 : _e2.details) || [];
    const hint = (_f2 = details.find(
      (x) => {
        var _a3;
        return (_a3 = x["@type"]) == null ? void 0 : _a3.endsWith("RetryInfo");
      }
    )) == null ? void 0 : _f2.retryDelay;
    const message = ((_h = (_g = response.json) == null ? void 0 : _g.error) == null ? void 0 : _h.message) || "";
    const seconds = (_k = (_i = hint == null ? void 0 : hint.match(/^([\d.]+)s$/)) == null ? void 0 : _i[1]) != null ? _k : (_j = message.match(/retry in ([\d.]+)s/i)) == null ? void 0 : _j[1];
    const delays = [
      header && !Number.isNaN(Number(header)) ? Number(header) * 1e3 : Date.parse(header || "") - now,
      Number(seconds) * 1e3
    ].filter(Number.isFinite);
    return Math.max(0, ...delays) + 1e3;
  }
  var sleep = (ms, signal) => new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new RelayFailure("cancelled", "Request cancelled."));
    };
    const timer = setTimeout(() => {
      signal == null ? void 0 : signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal == null ? void 0 : signal.aborted) {
      abort();
    } else {
      signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
    }
  });
  var HttpExecutor = class {
    constructor(diagnostics, send = browserHttp, wait = sleep) {
      this.cooldowns = /* @__PURE__ */ new Map();
      this.log = diagnostics;
      this.send = send;
      this.wait = wait;
    }
    async request(profile, path, body, context = {}) {
      var _a2, _b2;
      const scope = `${profile.id}:${context.model || ""}`;
      const timeoutMs = Math.min(
        12e4,
        Math.max(1e3, Number(profile.options.timeoutMs) || 12e4)
      );
      for (let attempt = 1; attempt <= 3; attempt++) {
        const delay = Math.max(0, (this.cooldowns.get(scope) || 0) - Date.now());
        if (delay > 0) {
          await this.wait(delay, context.signal);
        }
        this.log.emit("transport", { attempt, requestId: context.requestId });
        let response;
        try {
          response = await this.send({
            ...authenticatedRequest(profile, path),
            body,
            method: body === void 0 ? "GET" : "POST",
            timeoutMs,
            signal: context.signal
          });
        } catch (error) {
          if (!["timeout", "network"].includes(error.category) || attempt === 3) {
            throw error;
          }
          await this.wait(
            Math.min(15e3, 1e3 * 2 ** attempt) + Math.random() * 500,
            context.signal
          );
          continue;
        }
        if (response.status >= 200 && response.status < 300) {
          if (!response.json) {
            throw new RelayFailure(
              "invalid-response",
              "The API returned an unreadable response.",
              response.status
            );
          }
          return response.json;
        }
        const status = response.status;
        const contextLimitMessage = profile.providerId === "lmstudio" ? lmStudioContextLimitMessage(response.json) : "";
        const category = contextLimitMessage ? "context-limit" : status === 401 || status === 403 ? "authentication" : status === 429 ? "rate-limit" : [408, 425].includes(status) || status >= 500 ? "transient" : "configuration";
        const daily = (((_b2 = (_a2 = response.json) == null ? void 0 : _a2.error) == null ? void 0 : _b2.details) || []).some(
          (d) => (d.violations || []).some(
            (v) => /perday|per_day|daily/i.test(v.quotaId || "")
          )
        );
        const backoff = Math.max(
          retryDelay(response),
          Math.min(15e3, 1e3 * 2 ** attempt) + Math.random() * 500
        );
        const failure = new RelayFailure(
          category,
          contextLimitMessage || (daily ? "Daily quota reached. Wait for its reset or choose a different configured profile." : `The API rejected the request (${status}). ${category === "authentication" ? "Check this profile key." : category === "rate-limit" ? "Usage limits are still active." : "Check the model, endpoint and capabilities."}`),
          status
        );
        if (daily || !["rate-limit", "transient"].includes(category) || attempt === 3 || backoff > 12e4) {
          throw failure;
        }
        this.cooldowns.set(scope, Date.now() + backoff);
        this.log.emit("transport", { status, delayMs: backoff, attempt });
      }
    }
  };
  function lmStudioContextLimitMessage(data) {
    const error = data == null ? void 0 : data.error;
    const message = typeof error === "string" ? error : typeof (error == null ? void 0 : error.message) === "string" ? error.message : typeof (data == null ? void 0 : data.message) === "string" ? data.message : "";
    if (!/context/i.test(message) || !/(?:exceed|too large|overflow|larger than)/i.test(message)) {
      return "";
    }
    const tokenCounts = [...message.matchAll(/([\d,]+)\s*tokens?/gi)].map((match) => Number(match[1].replace(/,/g, ""))).filter((value) => Number.isFinite(value) && value > 0);
    if (tokenCounts.length < 2) {
      return "";
    }
    const format = (value) => value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : String(value);
    return `LM Studio context limit: this request needs about ${format(tokenCounts[0])} tokens, but the loaded model context is ${format(tokenCounts[1])}. Load the model with a larger context or reduce the request size in Pax Historia.`;
  }

  // src/relay/contracts.js
  var maps = /* @__PURE__ */ new Set([
    "properties",
    "$defs",
    "definitions",
    "patternProperties"
  ]);
  var children = /* @__PURE__ */ new Set([
    "items",
    "additionalProperties",
    "not",
    "if",
    "then",
    "else",
    "contains",
    "propertyNames"
  ]);
  var lists = /* @__PURE__ */ new Set(["anyOf", "oneOf", "allOf", "prefixItems"]);
  function visitSchema(schema, visitor, path = "$") {
    if (typeof schema === "boolean") {
      return visitor(schema, path);
    }
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      throw new RelayFailure("schema", `Invalid schema at ${path}.`);
    }
    const result = {};
    for (const [key, value] of Object.entries(schema)) {
      if (maps.has(key)) {
        result[key] = Object.fromEntries(
          Object.entries(value).map(([name, child]) => [
            name,
            visitSchema(child, visitor, `${path}/${key}/${name}`)
          ])
        );
      } else if (children.has(key) && typeof value === "object" || children.has(key) && typeof value === "boolean") {
        result[key] = visitSchema(value, visitor, `${path}/${key}`);
      } else if (lists.has(key)) {
        result[key] = value.map(
          (child, i) => visitSchema(child, visitor, `${path}/${key}/${i}`)
        );
      } else {
        result[key] = structuredClone(value);
      }
    }
    return visitor(result, path);
  }
  function normalizeContract(input) {
    var _a2;
    if (!input) {
      return null;
    }
    return visitSchema((_a2 = input.schema) != null ? _a2 : input, (node) => {
      if (typeof node === "boolean") {
        return node;
      }
      if (node.type) {
        node.type = Array.isArray(node.type) ? node.type.map((t) => t.toLowerCase()) : node.type.toLowerCase();
      }
      if (node.nullable) {
        delete node.nullable;
        return { anyOf: [node, { type: "null" }] };
      }
      return node;
    });
  }
  function schemaDialect(schema, protocol) {
    const unsupported = [];
    const lmStudio = protocol === "lmstudio-chat";
    const allowed = /* @__PURE__ */ new Set([
      "type",
      "properties",
      "required",
      "items",
      "prefixItems",
      "enum",
      "description",
      "title",
      "$id",
      "$defs",
      "$ref",
      "$anchor",
      "format",
      "pattern",
      "propertyOrdering",
      "nullable",
      "example",
      "anyOf",
      "oneOf",
      "allOf",
      "minimum",
      "maximum",
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
      "minProperties",
      "maxProperties",
      "additionalProperties"
    ]);
    const result = visitSchema(schema, (node, path) => {
      if (typeof node === "boolean") {
        return node;
      }
      if (lmStudio) {
        delete node.propertyOrdering;
      }
      if (protocol === "gemini-generate-content") {
        for (const key of Object.keys(node)) {
          if (!allowed.has(key)) {
            unsupported.push(`${path}/${key}`);
          }
        }
      }
      if (protocol !== "gemini-generate-content" && !lmStudio && node.propertyOrdering !== void 0) {
        unsupported.push(`${path}/propertyOrdering`);
      }
      if (protocol !== "gemini-generate-content" && !lmStudio && node.type === "object" && node.additionalProperties !== false) {
        unsupported.push(`${path}/additionalProperties`);
      }
      return node;
    });
    return { schema: result, unsupported };
  }
  function decodeOutput(output) {
    if (output !== null && typeof output === "object") {
      return output;
    }
    const text2 = String(output || "").trim();
    const candidates = [
      text2,
      ...Array.from(text2.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi), (m) => m[1])
    ];
    let start = -1, stack = [], quoted = false, escaped = false;
    for (let i = 0; i < text2.length; i++) {
      const c = text2[i];
      if (start < 0) {
        if (c === "{" || c === "[") {
          start = i;
          stack = [c];
        }
        continue;
      }
      if (quoted) {
        if (escaped) {
          escaped = false;
        } else if (c === "\\") {
          escaped = true;
        } else if (c === '"') {
          quoted = false;
        }
        continue;
      }
      if (c === '"') {
        quoted = true;
      } else if (c === "{" || c === "[") {
        stack.push(c);
      } else if (c === "}" || c === "]") {
        const open = stack.pop();
        if (c === "}" && open !== "{" || c === "]" && open !== "[") {
          start = -1;
          stack = [];
        } else if (!stack.length) {
          candidates.push(text2.slice(start, i + 1));
          start = -1;
        }
      }
    }
    const found = [];
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate.replace(/^\uFEFF/, ""));
        if (!found.some((x) => JSON.stringify(x) === JSON.stringify(parsed))) {
          found.push(parsed);
        }
      } catch (e) {
      }
    }
    if (found.length !== 1) {
      throw new RelayFailure(
        "decoding",
        found.length ? "The response contains multiple different JSON values." : "The response contains no complete JSON value. Truncated output cannot be repaired safely."
      );
    }
    return found[0];
  }
  var supported = /* @__PURE__ */ new Set([
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "enum",
    "const",
    "anyOf",
    "oneOf",
    "allOf",
    "not",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "description",
    "title",
    "format",
    "propertyOrdering",
    "example",
    "default",
    "examples",
    "$schema",
    "$id",
    "$ref",
    "$anchor",
    "$defs",
    "definitions"
  ]);
  function validateOutput(value, schema) {
    const equal = (a, b) => a === b || a !== null && b !== null && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(
      (key) => Object.hasOwn(b, key) && equal(a[key], b[key])
    );
    const failedPaths = /* @__PURE__ */ new Set();
    const check = (v, s, path, depth = 0) => {
      const valid = evaluate(v, s, path, depth);
      if (!valid) {
        failedPaths.add(path);
      }
      return valid;
    };
    const evaluate = (v, s, path, depth = 0) => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h, _i, _j, _k, _l;
      if (depth > 80) {
        throw new RelayFailure("schema", "Schema recursion limit reached.");
      }
      if (s === true) {
        return true;
      }
      if (s === false) {
        return false;
      }
      for (const k of Object.keys(s)) {
        if (!supported.has(k)) {
          throw new RelayFailure(
            "schema",
            `Unsupported validation keyword: ${k}.`
          );
        }
      }
      if (s.$ref) {
        if (!s.$ref.startsWith("#/")) {
          throw new RelayFailure(
            "schema",
            "External schema references are not supported."
          );
        }
        let ref = schema;
        for (const part of s.$ref.slice(2).split("/")) {
          ref = ref == null ? void 0 : ref[part.replace(/~1/g, "/").replace(/~0/g, "~")];
        }
        if (ref === void 0) {
          throw new RelayFailure("schema", "Unresolved schema reference.");
        }
        if (!check(v, ref, path, depth + 1)) {
          return false;
        }
      }
      const types = {
        null: v === null,
        array: Array.isArray(v),
        object: v !== null && typeof v === "object" && !Array.isArray(v),
        string: typeof v === "string",
        number: typeof v === "number" && Number.isFinite(v),
        integer: Number.isInteger(v),
        boolean: typeof v === "boolean"
      };
      if (s.type && ![s.type].flat().some((t) => types[t])) {
        return false;
      }
      if (s.enum && !s.enum.some((x) => equal(x, v)) || Object.hasOwn(s, "const") && !equal(s.const, v)) {
        return false;
      }
      for (const [key, test] of [
        ["anyOf", (n) => n > 0],
        ["oneOf", (n) => n === 1],
        ["allOf", (n) => n === s.allOf.length]
      ]) {
        if (s[key] && !test(s[key].filter((x) => check(v, x, path, depth + 1)).length)) {
          return false;
        }
      }
      if (s.not && check(v, s.not, path, depth + 1)) {
        return false;
      }
      if (types.object) {
        const keys = Object.keys(v);
        if (((_a2 = s.required) == null ? void 0 : _a2.some((k) => !Object.hasOwn(v, k))) || keys.length < ((_b2 = s.minProperties) != null ? _b2 : 0) || keys.length > ((_c2 = s.maxProperties) != null ? _c2 : Infinity)) {
          return false;
        }
        for (const key of keys) {
          const child = (_d2 = s.properties) == null ? void 0 : _d2[key];
          if (child !== void 0) {
            if (!check(v[key], child, `${path}/${key}`, depth + 1)) {
              return false;
            }
          } else if (s.additionalProperties !== void 0 && !check(v[key], s.additionalProperties, `${path}/${key}`, depth + 1)) {
            return false;
          }
        }
      }
      if (types.array) {
        if (v.length < ((_e2 = s.minItems) != null ? _e2 : 0) || v.length > ((_f2 = s.maxItems) != null ? _f2 : Infinity) || s.uniqueItems && v.some((x, i) => v.slice(0, i).some((y) => equal(x, y)))) {
          return false;
        }
        if (s.items !== void 0 && !v.every((x, i) => check(x, s.items, `${path}/${i}`, depth + 1))) {
          return false;
        }
      }
      if (types.string) {
        if ([...v].length < ((_g = s.minLength) != null ? _g : 0) || [...v].length > ((_h = s.maxLength) != null ? _h : Infinity)) {
          return false;
        }
        if (s.pattern) {
          if (s.pattern.length > 500 || v.length > 1e5) {
            throw new RelayFailure(
              "schema",
              "Pattern validation size limit exceeded."
            );
          }
          if (!new RegExp(s.pattern, "u").test(v)) {
            return false;
          }
        }
      }
      if (types.number && (v < ((_i = s.minimum) != null ? _i : -Infinity) || v > ((_j = s.maximum) != null ? _j : Infinity) || v <= ((_k = s.exclusiveMinimum) != null ? _k : -Infinity) || v >= ((_l = s.exclusiveMaximum) != null ? _l : Infinity) || s.multipleOf && Math.abs(v / s.multipleOf - Math.round(v / s.multipleOf)) > 1e-8)) {
        return false;
      }
      return true;
    };
    if (!check(value, schema, "$")) {
      throw new RelayFailure(
        "validation",
        `The answer does not match the game response contract at ${[...failedPaths].slice(0, 4).join(", ")}.`
      );
    }
    return value;
  }

  // src/relay/model-metadata.js
  function finiteNumber(value) {
    if (value === null || value === void 0 || value === "") {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function stringList(value) {
    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === "string");
    }
    if (value && typeof value === "object") {
      return Object.keys(value);
    }
    return [];
  }
  function firstNumber(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) {
        return number;
      }
    }
    return null;
  }
  function firstString(...values) {
    return values.find((value) => typeof value === "string" && value.trim()) || "";
  }
  function setCapability(target, name, ...values) {
    const value = values.find((item) => typeof item === "boolean");
    if (value !== void 0) {
      target[name] = value;
    }
  }
  function normalizeModelRecord(value) {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h;
    if (typeof value === "string") {
      return { id: value.trim() };
    }
    if (!value || typeof value !== "object") {
      return { id: "" };
    }
    const architecture = value.architecture || {};
    const id = firstString(value.id, value.key, value.name).replace(/^models\//, "");
    const supportedParameters = stringList(
      (_a2 = value.supported_parameters) != null ? _a2 : value.supportedParameters
    );
    const inputModalities = stringList(
      (_d2 = (_c2 = (_b2 = value.input_modalities) != null ? _b2 : value.inputModalities) != null ? _c2 : value.supportedInputTypes) != null ? _d2 : architecture.input_modalities
    );
    const outputModalities = stringList(
      (_g = (_f2 = (_e2 = value.output_modalities) != null ? _e2 : value.outputModalities) != null ? _f2 : value.supportedOutputTypes) != null ? _g : architecture.output_modalities
    );
    const sourceCapabilities = value.capabilities && typeof value.capabilities === "object" ? value.capabilities : {};
    const capabilityTags = Array.isArray(value.capabilities) ? value.capabilities : [];
    const capabilities = {};
    setCapability(capabilities, "chat", sourceCapabilities.chat, value.chat);
    setCapability(capabilities, "jsonSchema", sourceCapabilities.jsonSchema, value.jsonSchema);
    setCapability(capabilities, "jsonMode", sourceCapabilities.jsonMode, value.jsonMode);
    setCapability(
      capabilities,
      "temperature",
      sourceCapabilities.temperature,
      value.temperatureSupported
    );
    setCapability(
      capabilities,
      "maxOutputTokens",
      sourceCapabilities.maxOutputTokens,
      value.maxOutputTokensSupported
    );
    setCapability(capabilities, "vision", sourceCapabilities.vision, value.vision);
    setCapability(
      capabilities,
      "tools",
      sourceCapabilities.tools,
      sourceCapabilities.trained_for_tool_use,
      value.trained_for_tool_use,
      value.tools
    );
    setCapability(
      capabilities,
      "reasoningControls",
      sourceCapabilities.reasoningControls,
      value.reasoningControls,
      typeof value.thinking === "boolean" ? value.thinking : void 0
    );
    if (capabilityTags.includes("tool_use") && capabilities.tools === void 0) {
      capabilities.tools = true;
    }
    if (capabilityTags.includes("vision") && capabilities.vision === void 0) {
      capabilities.vision = true;
    }
    setCapability(
      capabilities,
      "streaming",
      sourceCapabilities.streaming,
      value.supports_streaming,
      value.supportsStreaming
    );
    const parameterSet = new Set(supportedParameters);
    if (supportedParameters.length) {
      setCapability(capabilities, "jsonSchema", parameterSet.has("structured_outputs"));
      setCapability(capabilities, "jsonMode", parameterSet.has("response_format"));
      setCapability(capabilities, "temperature", parameterSet.has("temperature"));
      setCapability(
        capabilities,
        "maxOutputTokens",
        parameterSet.has("max_tokens") || parameterSet.has("max_completion_tokens")
      );
      setCapability(
        capabilities,
        "tools",
        parameterSet.has("tools") || parameterSet.has("tool_choice")
      );
      setCapability(
        capabilities,
        "reasoningControls",
        parameterSet.has("reasoning") || parameterSet.has("reasoning_effort")
      );
    }
    if (inputModalities.length && capabilities.vision === void 0) {
      capabilities.vision = inputModalities.includes("image");
    }
    const generationMethods = stringList(value.supportedGenerationMethods);
    const type = firstString(value.type, value.kind).toLowerCase();
    const generatedText = outputModalities.includes("text");
    if (capabilities.chat === void 0) {
      if (type === "embedding" || type === "embeddings") {
        capabilities.chat = false;
      } else if (type === "llm" || type === "vlm") {
        capabilities.chat = true;
      } else if (generationMethods.includes("generateContent")) {
        capabilities.chat = true;
      } else if (generationMethods.length && !generationMethods.includes("generateContent")) {
        capabilities.chat = false;
      } else if (generatedText) {
        capabilities.chat = true;
      } else if (outputModalities.length && !generatedText) {
        capabilities.chat = false;
      }
    }
    const reasoning = (_h = sourceCapabilities.reasoning) != null ? _h : value.reasoning;
    if (typeof value.thinking === "boolean" && value.thinking && capabilities.reasoningControls === void 0) {
      capabilities.reasoningControls = true;
    }
    if (Array.isArray(reasoning == null ? void 0 : reasoning.allowed_options) && reasoning.allowed_options.length && capabilities.reasoningControls === void 0) {
      capabilities.reasoningControls = true;
    }
    if ((sourceCapabilities.trained_for_tool_use === true || value.trained_for_tool_use === true) && capabilities.tools === void 0) {
      capabilities.tools = true;
    }
    const topProvider = value.top_provider || {};
    const maxContextLength = firstNumber(
      value.maxContextLength,
      value.max_context_length
    );
    const loadedContextLength = firstNumber(
      value.loadedContextLength,
      value.loaded_context_length
    );
    const contextLength2 = value.contextSource === "lmstudio" ? loadedContextLength : firstNumber(
      loadedContextLength,
      value.contextLength,
      value.context_length,
      value.contextWindow,
      value.context_window,
      maxContextLength,
      value.inputTokenLimit,
      architecture.context_length,
      topProvider.context_length
    );
    const outputTokenLimit = firstNumber(
      value.outputTokenLimit,
      value.output_token_limit,
      value.max_output_tokens,
      topProvider.max_completion_tokens
    );
    const pricing = value.pricing || {};
    const record = {
      id,
      displayName: firstString(value.displayName, value.display_name, value.name),
      description: firstString(value.description),
      contextLength: contextLength2,
      maxContextLength,
      loadedContextLength,
      contextSource: firstString(value.contextSource),
      outputTokenLimit,
      inputModalities,
      outputModalities,
      supportedParameters,
      capabilities,
      pricing: {
        prompt: firstNumber(pricing.prompt, pricing.input),
        completion: firstNumber(pricing.completion, pricing.output)
      }
    };
    const details = value.details || {};
    const family = firstString(value.family, value.arch, architecture.family, details.family);
    const parameterSize = firstString(value.parameterSize, value.parameter_size, details.parameter_size);
    const publisher = firstString(value.publisher, value.owned_by);
    const quantization = value.quantization;
    const quantizationName = typeof quantization === "string" ? quantization : firstString(quantization == null ? void 0 : quantization.name, value.quantization_level, details.quantization_level);
    if (family) {
      record.family = family;
    }
    if (parameterSize) {
      record.parameterSize = parameterSize;
    }
    if (publisher) {
      record.publisher = publisher;
    }
    if (quantizationName) {
      record.quantization = quantizationName;
    }
    if (typeof capabilities.chat === "boolean") {
      record.chat = capabilities.chat;
    }
    return record;
  }

  // src/relay/request-size.js
  function approximateTokens(characters) {
    return Math.ceil(characters / 4);
  }
  function messageText(message) {
    const content = message == null ? void 0 : message.content;
    if (typeof content === "string") {
      return content;
    }
    if (!Array.isArray(content)) {
      return "";
    }
    return content.map((part) => typeof (part == null ? void 0 : part.text) === "string" ? part.text : "").join("");
  }
  function repeatedBlockStats(blocks, minimumLength) {
    const counts = /* @__PURE__ */ new Map();
    for (const block of blocks) {
      const normalized = block.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.length < minimumLength) {
        continue;
      }
      const entry = counts.get(normalized) || { count: 0, characters: normalized.length };
      entry.count += 1;
      counts.set(normalized, entry);
    }
    let repeatedBlocks = 0;
    let repeatedCharacters = 0;
    for (const entry of counts.values()) {
      if (entry.count > 1) {
        repeatedBlocks += entry.count - 1;
        repeatedCharacters += (entry.count - 1) * entry.characters;
      }
    }
    return { repeatedBlocks, repeatedCharacters };
  }
  function promptStructure(prompt) {
    const paragraphs = repeatedBlockStats(prompt.split(/\n\s*\n+/), 120);
    const longLines = repeatedBlockStats(prompt.split(/\r?\n/), 160);
    const headings = [];
    for (const line of prompt.split(/\r?\n/)) {
      const markdown = line.match(/^\s*#{1,6}\s+(.{3,100}?)\s*#*\s*$/);
      const bracketed = line.match(/^\s*\[([^\]]{3,100})\]\s*$/);
      const label = line.match(/^\s*([\p{L}][\p{L}\d /()&_-]{2,64}):\s*$/u);
      const heading = (markdown == null ? void 0 : markdown[1]) || (bracketed == null ? void 0 : bracketed[1]) || (label == null ? void 0 : label[1]);
      if (heading) {
        headings.push(heading);
      }
    }
    const repeatedHeadings = repeatedBlockStats(headings, 3);
    return {
      sectionHeadings: headings.length,
      repeatedLongParagraphs: paragraphs.repeatedBlocks,
      repeatedParagraphChars: paragraphs.repeatedCharacters,
      repeatedLongLines: longLines.repeatedBlocks,
      repeatedLineChars: longLines.repeatedCharacters,
      repeatedHeadings: repeatedHeadings.repeatedBlocks
    };
  }
  function requestSizeReport({ request, messages, schema }) {
    var _a2, _b2;
    const paxPrompt = messageText((_a2 = request.messages) == null ? void 0 : _a2[0]);
    const paxPromptChars = Number((_b2 = request.metadata) == null ? void 0 : _b2.paxPromptChars) || paxPrompt.length;
    const messageContents = messages.map(messageText);
    const totalChars = messageContents.reduce((total, content) => total + content.length, 0);
    const insertedMessageChars = Math.max(0, totalChars - paxPromptChars);
    const outputContractChars = schema ? JSON.stringify(schema).length : 0;
    const serializedContracts = [schema, request.outputContract].filter(Boolean).map((contract) => JSON.stringify(contract));
    const schemaEmbeddedInMessages = serializedContracts.some(
      (serialized) => messageContents.some((content) => content.includes(serialized))
    );
    return {
      paxPromptChars,
      paxPromptApproxTokens: approximateTokens(paxPromptChars),
      outputContractChars,
      outputContractApproxTokens: approximateTokens(outputContractChars),
      insertedMessageChars,
      insertedMessageApproxTokens: approximateTokens(insertedMessageChars),
      totalChars,
      totalMessageApproxTokens: approximateTokens(totalChars),
      requestApproxChars: totalChars + outputContractChars,
      approximateTokens: approximateTokens(totalChars + outputContractChars),
      schemaEmbeddedInMessages,
      ...promptStructure(paxPrompt)
    };
  }

  // src/relay/protocols.js
  var textParts = (parts) => (parts || []).filter((x) => !x.thought).map((x) => x.text || "").join("");
  function strategy(request, profile, capabilities) {
    const messages = structuredClone(request.messages);
    let schema;
    if (request.outputContract) {
      const schemaProtocol = profile.providerId === "lmstudio" ? "lmstudio-chat" : profile.protocol;
      const dialect = schemaDialect(request.outputContract, schemaProtocol);
      const nativeSchema = capabilities.jsonSchema && !dialect.unsupported.length;
      if (nativeSchema) {
        schema = dialect.schema;
      }
      messages.push({
        role: "user",
        content: nativeSchema ? "Return only the requested structured result." : `Return one JSON value matching this contract. Do not include commentary or code fences.
${JSON.stringify(request.outputContract)}`
      });
    }
    return { messages, schema };
  }
  var settings = (profile, tokenName, capabilities) => ({
    ...capabilities.temperature && {
      temperature: profile.options.temperature
    },
    ...capabilities.maxOutputTokens && {
      [tokenName]: profile.options.maxOutputTokens
    }
  });
  function chatTokenParameter(profile, modelMeta) {
    const supported2 = modelMeta == null ? void 0 : modelMeta.supportedParameters;
    if (!Array.isArray(supported2) || !supported2.length) {
      return profile.options.tokenParameter || "max_tokens";
    }
    const preferred = profile.options.tokenParameter || "max_tokens";
    if (supported2.includes(preferred)) {
      return preferred;
    }
    if (supported2.includes("max_completion_tokens")) {
      return "max_completion_tokens";
    }
    if (supported2.includes("max_tokens")) {
      return "max_tokens";
    }
    return preferred;
  }
  var ChatProtocol = class {
    async complete(request, ctx) {
      var _a2, _b2, _c2, _d2, _e2, _f2;
      const { profile, http } = ctx;
      const capabilities = ctx.effectiveCapabilities || capabilitiesFor(profile, ctx.modelMeta);
      const { messages, schema } = strategy(request, profile, capabilities);
      const requestProfile = profile.providerId === "lmstudio" ? {
        ...profile,
        options: { ...profile.options, maxOutputTokens: 4096 }
      } : profile;
      const requestCapabilities = profile.providerId === "lmstudio" ? { ...capabilities, maxOutputTokens: true } : capabilities;
      const tokenParameter = chatTokenParameter(profile, ctx.modelMeta);
      const body = {
        model: ctx.model,
        messages,
        stream: false,
        ...settings(
          requestProfile,
          tokenParameter,
          requestCapabilities
        )
      };
      if (schema) {
        body.response_format = {
          type: "json_schema",
          json_schema: { name: "game_response", strict: true, schema }
        };
      } else if (request.outputContract && capabilities.jsonMode) {
        body.response_format = { type: "json_object" };
      }
      if (profile.providerId === "openrouter" && request.outputContract && (schema || capabilities.jsonMode)) {
        body.provider = {
          ...profile.options.providerPreferences || {},
          require_parameters: true
        };
      }
      if (profile.providerId === "lmstudio" && request.kind === "advisor" && request.outputContract) {
        console.info("[PAX AI] Request size:", requestSizeReport({
          request,
          messages,
          schema
        }));
      }
      const data = await http.request(
        profile,
        profile.completionPath || "chat/completions",
        body,
        ctx
      );
      const choice = (_a2 = data.choices) == null ? void 0 : _a2[0];
      if ((choice == null ? void 0 : choice.finish_reason) === "length") {
        throw new RelayFailure(
          "invalid-response",
          "The model stopped at its output limit before finishing. Increase this profile's output token limit or choose a model with more output capacity."
        );
      }
      if ((_b2 = choice == null ? void 0 : choice.message) == null ? void 0 : _b2.refusal) {
        throw new RelayFailure("refusal", "The model declined this request.");
      }
      return (_f2 = (_c2 = choice == null ? void 0 : choice.message) == null ? void 0 : _c2.parsed) != null ? _f2 : Array.isArray((_d2 = choice == null ? void 0 : choice.message) == null ? void 0 : _d2.content) ? textParts(choice.message.content) : (_e2 = choice == null ? void 0 : choice.message) == null ? void 0 : _e2.content;
    }
    async listModels(ctx) {
      const data = await ctx.http.request(
        ctx.profile,
        ctx.profile.modelPath || "models",
        void 0,
        ctx
      );
      return (data.data || []).map((model) => normalizeModelRecord(model));
    }
  };
  var OpenRouterProtocol = class extends ChatProtocol {
    async listModels(ctx) {
      const data = await ctx.http.request(
        ctx.profile,
        ctx.profile.modelPath || "models",
        void 0,
        ctx
      );
      return (data.data || []).map((model) => normalizeModelRecord(model));
    }
  };
  var ResponsesProtocol = class extends ChatProtocol {
    async complete(request, ctx) {
      var _a2;
      const { profile, http } = ctx;
      const capabilities = ctx.effectiveCapabilities || capabilitiesFor(profile, ctx.modelMeta);
      const { messages, schema } = strategy(request, profile, capabilities);
      const body = {
        model: ctx.model,
        input: messages,
        ...settings(profile, "max_output_tokens", capabilities)
      };
      if (schema) {
        body.text = {
          format: {
            type: "json_schema",
            name: "game_response",
            strict: true,
            schema
          }
        };
      } else if (request.outputContract && capabilities.jsonMode) {
        body.text = { format: { type: "json_object" } };
      }
      const data = await http.request(
        profile,
        profile.completionPath || "responses",
        body,
        ctx
      );
      if (data.status === "incomplete") {
        throw new RelayFailure(
          "invalid-response",
          "The model response is incomplete."
        );
      }
      return (_a2 = data.output_text) != null ? _a2 : textParts((data.output || []).flatMap((x) => x.content || []));
    }
  };
  var GeminiProtocol = class {
    async complete(request, ctx) {
      var _a2, _b2, _c2;
      const { profile, http } = ctx;
      const capabilities = ctx.effectiveCapabilities || capabilitiesFor(profile, ctx.modelMeta);
      const { messages, schema } = strategy(request, profile, capabilities);
      const generationConfig = settings(profile, "maxOutputTokens", capabilities);
      if (request.outputContract && capabilities.jsonMode) {
        generationConfig.responseMimeType = "application/json";
      }
      if (schema) {
        if (ctx.googleSchemaMode === "legacy") {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseJsonSchema = schema;
        } else {
          generationConfig.responseFormat = {
            text: { mimeType: "application/json", schema }
          };
        }
      }
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const data = await http.request(
        profile,
        profile.completionPath || `models/${encodeURIComponent(ctx.model.replace(/^models\//, ""))}:generateContent`,
        { contents, generationConfig },
        ctx
      );
      const answer = (_a2 = data.candidates) == null ? void 0 : _a2[0];
      if ((answer == null ? void 0 : answer.finishReason) === "MAX_TOKENS") {
        throw new RelayFailure(
          "invalid-response",
          "Gemini reached the output limit before finishing."
        );
      }
      if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT"].includes(
        answer == null ? void 0 : answer.finishReason
      ) || ((_b2 = data.promptFeedback) == null ? void 0 : _b2.blockReason)) {
        throw new RelayFailure("refusal", "Gemini declined this request.");
      }
      return textParts((_c2 = answer == null ? void 0 : answer.content) == null ? void 0 : _c2.parts);
    }
    async listModels(ctx) {
      let token = "", models = [];
      for (let page2 = 0; page2 < 20; page2++) {
        const data = await ctx.http.request(
          ctx.profile,
          ctx.profile.modelPath || `models${token ? `?pageToken=${encodeURIComponent(token)}` : ""}`,
          void 0,
          ctx
        );
        models.push(
          ...(data.models || []).filter(
            (m) => {
              var _a2;
              return (_a2 = m.supportedGenerationMethods) == null ? void 0 : _a2.includes("generateContent");
            }
          ).map((model) => normalizeModelRecord({
            ...model,
            id: model.name,
            contextLength: model.inputTokenLimit,
            outputTokenLimit: model.outputTokenLimit,
            temperatureSupported: typeof model.temperature === "number"
          }))
        );
        token = data.nextPageToken;
        if (!token || ctx.profile.modelPath) {
          break;
        }
      }
      return models;
    }
  };
  var AnthropicProtocol = class {
    async complete(request, ctx) {
      const capabilities = ctx.effectiveCapabilities || capabilitiesFor(ctx.profile, ctx.modelMeta);
      const { messages, schema } = strategy(request, ctx.profile, capabilities);
      const profile = {
        ...ctx.profile,
        headers: {
          ...ctx.profile.headers,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        }
      };
      const body = {
        model: ctx.model,
        messages,
        max_tokens: profile.options.maxOutputTokens,
        ...settings(profile, "max_tokens", capabilities)
      };
      if (schema) {
        body.output_config = {
          format: { type: "json_schema", schema }
        };
      }
      const data = await ctx.http.request(
        profile,
        profile.completionPath || "messages",
        body,
        ctx
      );
      if (data.stop_reason === "max_tokens") {
        throw new RelayFailure(
          "invalid-response",
          "Claude reached the output limit before finishing."
        );
      }
      return textParts(data.content);
    }
    async listModels(ctx) {
      const profile = {
        ...ctx.profile,
        headers: {
          ...ctx.profile.headers,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        }
      };
      const data = await ctx.http.request(
        profile,
        profile.modelPath || "models",
        void 0,
        ctx
      );
      return (data.data || []).map((model) => normalizeModelRecord(model));
    }
  };
  var OllamaProtocol = class {
    async complete(request, ctx) {
      var _a2;
      const capabilities = ctx.effectiveCapabilities || capabilitiesFor(ctx.profile, ctx.modelMeta);
      const { messages, schema } = strategy(request, ctx.profile, capabilities);
      const data = await ctx.http.request(
        ctx.profile,
        ctx.profile.completionPath || "api/chat",
        {
          model: ctx.model,
          messages,
          stream: false,
          options: {
            temperature: ctx.profile.options.temperature,
            num_predict: ctx.profile.options.maxOutputTokens
          },
          ...schema && { format: schema }
        },
        ctx
      );
      return (_a2 = data.message) == null ? void 0 : _a2.content;
    }
    async listModels(ctx) {
      const data = await ctx.http.request(
        ctx.profile,
        ctx.profile.modelPath || "api/tags",
        void 0,
        ctx
      );
      return (data.models || []).map((model) => normalizeModelRecord(model));
    }
  };
  var LMStudioProtocol = class extends ChatProtocol {
    async listModels(ctx) {
      let data;
      try {
        data = await ctx.http.request(
          ctx.profile,
          ctx.profile.modelPath || "../api/v1/models",
          void 0,
          ctx
        );
      } catch (error) {
        if (ctx.profile.modelPath || ![404, 405].includes(error.status)) {
          throw error;
        }
        return super.listModels(ctx);
      }
      return (data.models || []).map((model) => {
        var _a2, _b2, _c2;
        const isChatModel = model.type === "llm" || model.type === "vlm";
        const loadedContexts = (Array.isArray(model.loaded_instances) ? model.loaded_instances : []).map((instance) => {
          var _a3;
          return Number((_a3 = instance == null ? void 0 : instance.config) == null ? void 0 : _a3.context_length);
        }).filter((value) => Number.isFinite(value) && value > 0);
        const loadedContextLength = loadedContexts.length ? Math.min(...loadedContexts) : null;
        return normalizeModelRecord({
          ...model,
          id: model.key || model.id,
          display_name: model.display_name || model.displayName,
          contextSource: "lmstudio",
          max_context_length: model.max_context_length,
          loaded_context_length: loadedContextLength,
          capabilities: {
            ...model.capabilities || {},
            chat: isChatModel,
            jsonSchema: isChatModel,
            tools: (_a2 = model.capabilities) == null ? void 0 : _a2.trained_for_tool_use,
            ...Array.isArray((_c2 = (_b2 = model.capabilities) == null ? void 0 : _b2.reasoning) == null ? void 0 : _c2.allowed_options) ? { reasoningControls: model.capabilities.reasoning.allowed_options.length > 0 } : {}
          }
        });
      });
    }
  };
  registry.protocol("openai-chat", new ChatProtocol()).protocol("openrouter-chat", new OpenRouterProtocol()).protocol("openai-responses", new ResponsesProtocol()).protocol("gemini-generate-content", new GeminiProtocol()).protocol("anthropic-messages", new AnthropicProtocol()).protocol("ollama-native", new OllamaProtocol()).protocol("lmstudio-chat", new LMStudioProtocol());
  var ModelCatalog = class {
    constructor(http) {
      this.http = http;
      this.cache = /* @__PURE__ */ new Map();
    }
    keyFor(profile) {
      return [profile.id, profile.endpoint, profile.protocol, profile.modelPath || ""].join("|");
    }
    async list(profile, refresh = false) {
      const key = this.keyFor(profile);
      const cached = this.cache.get(profile.id);
      if (!refresh && (cached == null ? void 0 : cached.key) === key && cached.expires > Date.now()) {
        return cached.models;
      }
      if (!profile.capabilities.modelDiscovery) {
        throw new RelayFailure(
          "configuration",
          "Enter a model manually for this profile."
        );
      }
      const models = [
        ...new Map(
          (await registry.adapter(profile).listModels({
            profile,
            http: this.http
          })).map(normalizeModelRecord).filter((model) => model.id).map((model) => [model.id, model])
        ).values()
      ];
      this.cache.set(profile.id, { key, models, expires: Date.now() + 3e5 });
      return models;
    }
    peek(profile, modelId2) {
      const key = this.keyFor(profile);
      const cached = this.cache.get(profile.id);
      if (!cached || cached.key !== key) {
        return null;
      }
      return cached.models.find((model) => model.id === modelId2) || null;
    }
  };

  // src/relay/generation.js
  async function generate(request, context) {
    const adapter = registry.adapter(context.profile);
    const capabilities = context.effectiveCapabilities || capabilitiesFor(context.profile, context.modelMeta);
    try {
      return await adapter.complete(request, context);
    } catch (error) {
      if (request.outputContract && [400, 422].includes(error.status) && context.profile.protocol === "gemini-generate-content" && context.googleSchemaMode !== "legacy" && context.googleSchemaMode !== "prompt" && capabilities.jsonSchema) {
        try {
          return await adapter.complete(request, {
            ...context,
            googleSchemaMode: "legacy"
          });
        } catch (legacyError) {
          error = legacyError;
        }
      }
      if (!request.outputContract || ![400, 422].includes(error.status) || context.profile.providerId === "lmstudio" || !capabilities.jsonSchema && !capabilities.jsonMode) {
        throw error;
      }
      const profile = {
        ...context.profile,
        capabilities: { ...capabilities, jsonSchema: false, jsonMode: false }
      };
      return adapter.complete(request, {
        ...context,
        profile,
        effectiveCapabilities: { ...capabilities, jsonSchema: false, jsonMode: false }
      });
    }
  }

  // src/relay/pipeline.js
  function classifyPaxRequest(data) {
    const descriptor = String(
      data.requestType || data.promptStage || data.type || ""
    ).toLowerCase();
    if (/emot|emoji|mood/.test(descriptor)) {
      return "lightweight";
    }
    if (/advis|action|decision|order/.test(descriptor)) {
      return "advisor";
    }
    return "conversation";
  }
  function requestDigest(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
  function coordinationKey(body, doc, request, primary) {
    return JSON.stringify([
      "v2",
      requestDigest(body),
      request.kind,
      primary.profile.id,
      primary.model,
      primary.fallbackModels,
      doc.revision || 0
    ]);
  }
  function needsOutputRecovery(error) {
    return (error == null ? void 0 : error.category) === "decoding" || (error == null ? void 0 : error.category) === "validation" || (error == null ? void 0 : error.category) === "invalid-response" && /incomplete|output limit|exhausted/i.test(error.message || "");
  }
  function recoveryProfile(profile) {
    var _a2;
    const current = Number((_a2 = profile.options) == null ? void 0 : _a2.maxOutputTokens) || (profile.providerId === "lmstudio" ? 4096 : 16384);
    const maxOutputTokens = profile.providerId === "lmstudio" ? Math.min(8192, Math.max(4096, current * 2)) : Math.min(65536, Math.max(32768, current * 2));
    return {
      ...profile,
      options: {
        ...profile.options,
        maxOutputTokens
      }
    };
  }
  function conciseRequest(request) {
    const instruction = request.outputContract ? "The previous answer did not satisfy the contract. Return exactly one complete JSON value. Include every required field, use the declared types literally, keep text fields concise, and do not add optional entries." : "The previous answer reached its output limit. Give a concise, complete answer and finish all sentences. Do not repeat the prompt or add an introduction.";
    return {
      ...request,
      messages: [
        ...request.messages,
        {
          role: "user",
          content: instruction
        }
      ]
    };
  }
  async function completeValue(request, context) {
    const output = await generate(request, context);
    if (output === void 0 || output === null || output === "") {
      throw new RelayFailure(
        "invalid-response",
        "The model returned an empty answer."
      );
    }
    return request.outputContract ? validateOutput(decodeOutput(output), request.outputContract) : { message: String(output) };
  }
  function decodePax(body) {
    if (typeof body !== "string" || body.length > 2 * 1024 * 1024) {
      throw new RelayFailure(
        "configuration",
        "The game request is too large or unreadable."
      );
    }
    const data = JSON.parse(body);
    if (!data || typeof data.prompt !== "string") {
      throw new RelayFailure(
        "configuration",
        "The game request has no text prompt."
      );
    }
    const kind = classifyPaxRequest(data);
    return {
      kind,
      messages: [{ role: "user", content: data.prompt }],
      outputContract: normalizeContract(data.jsonSchema),
      generationOptions: {},
      metadata: {
        requestId: randomId(),
        paxPromptChars: data.prompt.length
      }
    };
  }
  var RequestCoordinator = class {
    constructor() {
      this.jobs = /* @__PURE__ */ new Map();
    }
    async run(key, operation) {
      let job = this.jobs.get(key);
      if (!job) {
        job = Promise.resolve().then(operation);
        this.jobs.set(key, job);
        job.finally(() => {
          if (this.jobs.get(key) === job) {
            this.jobs.delete(key);
          }
        }).catch(() => {
        });
      }
      return job;
    }
  };
  var RouteResolver = class {
    resolve(doc, kind) {
      const route = doc.routes[kind] || {};
      const profile = doc.profiles[route.profileId || doc.activeProfileId];
      if (!profile) {
        throw new RelayFailure(
          "configuration",
          "Open AI settings and add a profile."
        );
      }
      const model = route.model || profile.defaultModel;
      if (!model) {
        throw new RelayFailure(
          "configuration",
          `Choose a primary model for ${kind} before sending a request.`
        );
      }
      return {
        profile,
        model,
        fallbackModels: [
          ...new Set(
            (Array.isArray(route.fallbackModels) ? route.fallbackModels : []).map((value) => String(value).trim()).filter((value) => value && value !== model)
          )
        ]
      };
    }
  };
  var FallbackPolicy = class {
    candidates(doc, primary) {
      const candidates = [
        { profile: primary.profile, model: primary.model },
        ...primary.fallbackModels.map((model) => ({
          profile: primary.profile,
          model
        }))
      ];
      if (doc.behavior.fallback === "profiles") {
        for (const id of doc.behavior.fallbackProfiles || []) {
          const profile = doc.profiles[id];
          if (profile == null ? void 0 : profile.defaultModel) {
            candidates.push({ profile, model: profile.defaultModel });
          }
        }
      }
      const seen = /* @__PURE__ */ new Set();
      return candidates.filter(({ profile, model }) => {
        const key = `${profile.id}:${model}`;
        if (!model || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }
    finish(doc, error) {
      if (doc.behavior.fallback === "pax" && error.category !== "cancelled") {
        return { fallback: true };
      }
      throw error;
    }
  };
  var RequestPipeline = class {
    constructor(store, http, catalog, diagnostics) {
      this.coordinator = new RequestCoordinator();
      this.routes = new RouteResolver();
      this.fallback = new FallbackPolicy();
      Object.assign(this, { store, http, catalog, diagnostics });
    }
    async process(body) {
      const doc = await this.store.read();
      try {
        return await this.handle(doc, body);
      } catch (error) {
        return this.fallback.finish(doc, error);
      }
    }
    async handle(doc, body) {
      const request = decodePax(body);
      this.diagnostics.enabled = doc.behavior.debug;
      const primary = this.routes.resolve(doc, request.kind);
      return this.coordinator.run(
        coordinationKey(body, doc, request, primary),
        async () => {
          var _a2, _b2, _c2, _d2, _e2;
          let failure;
          let failedChoices = 0;
          for (const route of this.fallback.candidates(doc, primary)) {
            const model = route.model;
            try {
              this.diagnostics.emit("routing", {
                requestId: request.metadata.requestId
              });
              this.diagnostics.emit("provider", {
                requestId: request.metadata.requestId
              });
              const context = {
                ...route,
                model,
                modelMeta: (_b2 = (_a2 = this.catalog) == null ? void 0 : _a2.peek) == null ? void 0 : _b2.call(_a2, route.profile, model),
                effectiveCapabilities: capabilitiesFor(
                  route.profile,
                  (_d2 = (_c2 = this.catalog) == null ? void 0 : _c2.peek) == null ? void 0 : _d2.call(_c2, route.profile, model)
                ),
                http: this.http,
                requestId: request.metadata.requestId
              };
              let value;
              try {
                value = await completeValue(request, context);
              } catch (firstError) {
                if (!needsOutputRecovery(firstError)) {
                  throw firstError;
                }
                this.diagnostics.emit("fallback", {
                  requestId: request.metadata.requestId,
                  status: 502
                });
                value = await completeValue(conciseRequest(request), {
                  ...context,
                  profile: recoveryProfile(route.profile)
                });
              }
              this.diagnostics.emit("schema", {
                requestId: request.metadata.requestId
              });
              this.diagnostics.emit("validation", {
                requestId: request.metadata.requestId,
                status: 200
              });
              return { body: JSON.stringify(value), status: 200 };
            } catch (error) {
              failedChoices += 1;
              if (!failure) {
                const advisorAssignment = ((_e2 = doc.routes) == null ? void 0 : _e2.advisor) || {};
                const assignedElsewhere = request.kind === "advisor" && advisorAssignment.profileId && advisorAssignment.profileId !== doc.activeProfileId;
                const differentAdvisorModel = request.kind === "advisor" && advisorAssignment.model && advisorAssignment.model !== route.profile.defaultModel;
                const assignmentHint = assignedElsewhere && error.category === "authentication" ? " Advisor/actions is still assigned to this connection. Open AI settings, then Assign, to change it." : differentAdvisorModel && error.category === "authentication" ? " Advisor/actions still uses a separate model. Open AI settings, then Assign, to change it." : "";
                failure = new RelayFailure(
                  error.category || "configuration",
                  `${route.profile.label} / ${model}: ${error.message}${assignmentHint}`,
                  error.status
                );
              }
              this.diagnostics.emit("fallback", {
                status: error.status,
                requestId: request.metadata.requestId
              });
            }
          }
          if (failure && failedChoices > 1) {
            failure = new RelayFailure(
              failure.category,
              `${failure.message} ${failedChoices - 1} approved backup choice(s) also failed.`,
              failure.status
            );
          }
          return this.fallback.finish(
            doc,
            failure || new RelayFailure("configuration", "No approved model is configured.")
          );
        }
      );
    }
  };

  // src/relay/interception.js
  function responseStatus(status) {
    const code = Number(status);
    return code === 429 || code >= 500 && code <= 599 ? code : 502;
  }
  function installInterceptor(page2, pipeline) {
    const marker = Symbol.for("historia-relay.interceptor.v2");
    if (page2[marker]) {
      return;
    }
    const original = page2.fetch.bind(page2);
    const originals = /* @__PURE__ */ new Map();
    async function fallbackOnce(body, input, init) {
      const key = JSON.stringify([body, (init == null ? void 0 : init.method) || (input == null ? void 0 : input.method) || "POST"]);
      let shared = originals.get(key);
      if (!shared) {
        shared = Promise.resolve().then(() => original(input, init));
        originals.set(key, shared);
        shared.finally(() => {
          setTimeout(() => originals.delete(key), 0);
        }).catch(() => {
        });
      }
      return (await shared).clone();
    }
    function match(input) {
      try {
        const u = new URL(
          typeof input === "string" ? input : (input == null ? void 0 : input.url) || String(input),
          page2.location.href
        );
        return u.origin === page2.location.origin && u.pathname === "/api/simple-chat";
      } catch (e) {
        return false;
      }
    }
    async function route(input, init) {
      var _a2;
      const body = (init == null ? void 0 : init.body) !== void 0 ? init.body : await ((_a2 = input == null ? void 0 : input.clone) == null ? void 0 : _a2.call(input).text());
      if (typeof body !== "string" || !body) {
        return original(input, init);
      }
      try {
        const result = await pipeline.process(body);
        return result.fallback ? fallbackOnce(body, input, init) : new page2.Response(result.body, {
          status: result.status,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        const category = String(error.category || "request").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        return new page2.Response(
          JSON.stringify({
            error: "Your AI could not answer.",
            errorCode: `AI_RELAY_${category || "REQUEST"}`,
            details: error.message
          }),
          {
            status: responseStatus(error.status),
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    function hook(input, init) {
      if (!match(input)) {
        return original(input, init);
      }
      return new page2.Promise(
        (resolve, reject) => route(input, init).then(resolve, reject)
      );
    }
    page2.fetch = typeof globalThis.exportFunction === "function" ? globalThis.exportFunction(hook, page2) : hook;
    page2[marker] = true;
  }

  // src/relay/ui/dom.js
  function text(value) {
    return value === null || value === void 0 ? "" : String(value);
  }
  function h(tag, props = {}, ...children2) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === void 0 || value === null || value === false) {
        continue;
      }
      if (key.startsWith("on") && typeof value === "function") {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "class") {
        element.className = value;
      } else if (key === "value" || key === "checked" || key === "disabled" || key === "open") {
        element[key] = value;
      } else if (value === true) {
        element.setAttribute(key, "");
      } else {
        element.setAttribute(key, String(value));
      }
    }
    append(element, children2);
    return element;
  }
  function append(parent, children2) {
    for (const child of children2) {
      if (Array.isArray(child)) {
        append(parent, child);
      } else if (child === null || child === void 0 || child === false) {
        continue;
      } else {
        parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
      }
    }
    return parent;
  }
  function clear(parent) {
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
  }
  function rerender(container, render) {
    const root = container.getRootNode();
    const active = root && root.activeElement;
    const fid = active && container.contains(active) ? active.getAttribute("data-fid") : null;
    const selection = fid && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
    clear(container);
    render();
    if (!fid) {
      return;
    }
    const next = container.querySelector(`[data-fid="${fid}"]`);
    if (next && !next.disabled) {
      next.focus({ preventScroll: true });
      if (selection && typeof next.setSelectionRange === "function") {
        try {
          next.setSelectionRange(selection[0], selection[1]);
        } catch (e) {
        }
      }
    }
  }
  var idCounter = 0;
  function uid(prefix = "f") {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  }
  function field({ label, control, target = control, hint, error, required }) {
    const id = target.id || uid("fld");
    target.id = id;
    const describedBy = [];
    const wrap = h("div", { class: "field" });
    wrap.append(
      h("label", { for: id }, label, required ? h("span", { class: "req", "aria-hidden": "true" }, " *") : null)
    );
    if (hint) {
      const hintId = `${id}-hint`;
      wrap.append(h("p", { class: "hint", id: hintId }, hint));
      describedBy.push(hintId);
    }
    wrap.append(control);
    if (error) {
      const errorId = `${id}-error`;
      wrap.append(h("p", { class: "field-error", id: errorId, role: "alert" }, error));
      describedBy.push(errorId);
      target.setAttribute("aria-invalid", "true");
    }
    if (describedBy.length) {
      target.setAttribute("aria-describedby", describedBy.join(" "));
    }
    return wrap;
  }
  function checkbox({ label, checked, onChange, hint }) {
    const input = h("input", { type: "checkbox", checked: Boolean(checked) });
    input.addEventListener("change", () => onChange(input.checked));
    return h(
      "label",
      { class: "check" },
      input,
      h("span", {}, label, hint ? h("small", { class: "hint" }, hint) : null)
    );
  }
  function safeErrorMessage(error, secrets = []) {
    let message = text((error == null ? void 0 : error.message) || error).replace(/\s+/g, " ").trim();
    for (const value of secrets) {
      if (value) {
        message = message.split(String(value)).join("[hidden]");
      }
    }
    message = message.replace(/(?:sk-|rk-|pk-|AIza)[A-Za-z0-9_-]{8,}/g, "[hidden]").replace(/(authorization|api[-_ ]?key|token|secret)\s*[:=]\s*[^,\s]+/gi, "$1: [hidden]");
    return message.slice(0, 280) || "The request could not be completed.";
  }

  // src/relay/model-recommendations.js
  var NON_CHAT_ID_PARTS = [
    "embedding",
    "embed",
    "image",
    "audio",
    "tts",
    "veo",
    "imagen",
    "moderation",
    "rerank"
  ];
  var LIGHTWEIGHT_PARTS = [
    "lite",
    "mini",
    "small",
    "flash",
    "haiku",
    "nano",
    "fast"
  ];
  var SPECIALTY_SUFFIXES = [
    "embedding",
    "embed",
    "image",
    "audio",
    "tts",
    "veo",
    "imagen",
    "moderation",
    "rerank",
    "whisper"
  ];
  function numericValue(...values) {
    for (const value of values) {
      if (typeof value === "number") {
        if (Number.isFinite(value)) {
          return value;
        }
        continue;
      }
      if (typeof value !== "string") {
        continue;
      }
      const normalized = value.trim();
      if (!normalized) {
        continue;
      }
      const number = Number(normalized);
      if (Number.isFinite(number)) {
        return number;
      }
    }
    return null;
  }
  function priceValue(...values) {
    const value = numericValue(...values);
    return value !== null && value >= 0 && Number.isFinite(value * 1e6) ? value : null;
  }
  function contextLength(record) {
    const value = numericValue(
      record == null ? void 0 : record.contextLength,
      record == null ? void 0 : record.context_length,
      record == null ? void 0 : record.contextWindow,
      record == null ? void 0 : record.context_window,
      record == null ? void 0 : record.maxContextTokens
    );
    return value !== null && value > 0 ? value : null;
  }
  function inputPrice(record) {
    var _a2, _b2;
    return priceValue(
      (_a2 = record == null ? void 0 : record.pricing) == null ? void 0 : _a2.prompt,
      (_b2 = record == null ? void 0 : record.pricing) == null ? void 0 : _b2.input,
      record == null ? void 0 : record.inputPrice,
      record == null ? void 0 : record.input_price
    );
  }
  function capability(record, name) {
    var _a2;
    return ((_a2 = record == null ? void 0 : record.capabilities) == null ? void 0 : _a2[name]) === true || (record == null ? void 0 : record[name]) === true;
  }
  function explicitlyDisabled(record, name) {
    var _a2;
    return ((_a2 = record == null ? void 0 : record.capabilities) == null ? void 0 : _a2[name]) === false || (record == null ? void 0 : record[name]) === false;
  }
  function explicitlyEnabled(record, name) {
    var _a2;
    return ((_a2 = record == null ? void 0 : record.capabilities) == null ? void 0 : _a2[name]) === true || (record == null ? void 0 : record[name]) === true;
  }
  function modelId(record) {
    if (typeof record === "string") {
      return record.trim();
    }
    if (!record || typeof record !== "object") {
      return "";
    }
    return typeof record.id === "string" ? record.id.trim() : "";
  }
  function hasPart(id, parts) {
    const segments = id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return parts.some((part) => segments.includes(part));
  }
  function hasSpecialtySuffix(id) {
    const lower = id.toLowerCase();
    return SPECIALTY_SUFFIXES.some(
      (part) => lower === part || lower.endsWith(`-${part}`) || lower.endsWith(`_${part}`) || lower.endsWith(`/${part}`) || lower.endsWith(`:${part}`)
    );
  }
  function compareIds(left, right) {
    const a = modelId(left);
    const b = modelId(right);
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }
  function comparableRecords(records) {
    return (Array.isArray(records) ? records : []).filter((record) => modelId(record)).filter((record) => {
      if (explicitlyDisabled(record, "chat")) {
        return false;
      }
      if (explicitlyEnabled(record, "chat")) {
        return true;
      }
      return !hasPart(modelId(record), NON_CHAT_ID_PARTS);
    });
  }
  function bestRecord(records, score) {
    return [...records].sort((left, right) => {
      const leftScore = score(left);
      const rightScore = score(right);
      for (let index = 0; index < leftScore.length; index += 1) {
        if (leftScore[index] !== rightScore[index]) {
          return rightScore[index] - leftScore[index];
        }
      }
      return compareIds(left, right);
    })[0];
  }
  function knownPriceRank(record) {
    const price = inputPrice(record);
    return price === null ? 0 : 1;
  }
  function suggestAssignments(records) {
    const models = comparableRecords(records);
    if (!models.length) {
      return { lightweight: "", conversation: "", advisor: "" };
    }
    const lightweight = bestRecord(models, (record) => [
      explicitlyEnabled(record, "chat") ? 1 : 0,
      hasPart(modelId(record), LIGHTWEIGHT_PARTS) ? 1 : 0,
      knownPriceRank(record),
      inputPrice(record) === null ? 0 : -inputPrice(record)
    ]);
    const conversation = bestRecord(models, (record) => [
      explicitlyEnabled(record, "chat") ? 1 : 0,
      hasSpecialtySuffix(modelId(record)) ? 0 : 1,
      contextLength(record) === null ? 0 : 1,
      contextLength(record) === null ? 0 : contextLength(record)
    ]);
    const advisor = bestRecord(models, (record) => {
      var _a2;
      return [
        explicitlyEnabled(record, "chat") ? 1 : 0,
        capability(record, "jsonSchema") ? 1 : 0,
        capability(record, "jsonMode") ? 1 : 0,
        numericValue(record == null ? void 0 : record.outputTokenLimit) === null ? 0 : 1,
        (_a2 = numericValue(record == null ? void 0 : record.outputTokenLimit)) != null ? _a2 : 0,
        contextLength(record) === null ? 0 : contextLength(record)
      ];
    });
    return {
      lightweight: modelId(lightweight),
      conversation: modelId(conversation),
      advisor: modelId(advisor)
    };
  }

  // src/relay/ui/models.js
  var MODEL_CAPABILITY_FIELDS = Object.freeze([
    "chat",
    "jsonMode",
    "jsonSchema",
    "temperature",
    "maxOutputTokens",
    "vision",
    "tools",
    "reasoningControls",
    "streaming"
  ]);
  var MODEL_STRUCTURED_FIELDS = Object.freeze(["jsonSchema", "jsonMode"]);
  var PROFILE_CAPABILITY_KEYS = Object.freeze([
    "jsonMode",
    "jsonSchema",
    "modelDiscovery",
    "temperature",
    "maxOutputTokens"
  ]);
  function hasOwn(object, key) {
    return object !== null && object !== void 0 && Object.prototype.hasOwnProperty.call(object, key);
  }
  function normalizeModelRecordDetails(record) {
    var _a2, _b2;
    if (typeof record === "string") {
      const id2 = record.trim();
      return id2 ? { record: { id: id2 }, explicitCapabilities: {}, hasObjectRecord: false } : null;
    }
    if (!record || typeof record !== "object") {
      return null;
    }
    const normalized = normalizeModelRecord(record);
    const id = text(normalized.id).trim();
    if (!id) {
      return null;
    }
    const sourceCapabilities = record.capabilities && typeof record.capabilities === "object" ? record.capabilities : {};
    const explicitCapabilities = {};
    for (const key of MODEL_CAPABILITY_FIELDS) {
      const value = (_a2 = sourceCapabilities[key]) != null ? _a2 : record[key];
      if (typeof value === "boolean") {
        explicitCapabilities[key] = value;
      }
    }
    for (const key of MODEL_CAPABILITY_FIELDS) {
      const value = (_b2 = normalized.capabilities) == null ? void 0 : _b2[key];
      if (typeof value === "boolean" && !hasOwn(explicitCapabilities, key)) {
        explicitCapabilities[key] = value;
      }
    }
    return {
      record: { ...normalized, supportedParameters: [...normalized.supportedParameters] },
      explicitCapabilities,
      hasObjectRecord: true
    };
  }
  function mergeNormalizedModelDetails(existing, incoming) {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h, _i, _j, _k;
    const supportedParameters = [
      .../* @__PURE__ */ new Set([
        ...Array.isArray(existing.record.supportedParameters) ? existing.record.supportedParameters : [],
        ...Array.isArray(incoming.record.supportedParameters) ? incoming.record.supportedParameters : []
      ])
    ];
    const explicitCapabilities = { ...existing.explicitCapabilities };
    for (const [key, value] of Object.entries(incoming.explicitCapabilities)) {
      if (!hasOwn(explicitCapabilities, key)) {
        explicitCapabilities[key] = value;
      }
    }
    const hasObjectRecord = existing.hasObjectRecord || incoming.hasObjectRecord;
    if (!hasObjectRecord) {
      return { record: { id: existing.record.id }, explicitCapabilities, hasObjectRecord: false };
    }
    const base = existing.hasObjectRecord ? existing.record : incoming.record;
    const capabilities = {};
    for (const key of MODEL_CAPABILITY_FIELDS) {
      if (hasOwn(explicitCapabilities, key)) {
        capabilities[key] = explicitCapabilities[key];
        continue;
      }
      const value = (_c2 = (_a2 = incoming.record.capabilities) == null ? void 0 : _a2[key]) != null ? _c2 : (_b2 = existing.record.capabilities) == null ? void 0 : _b2[key];
      if (typeof value === "boolean") {
        capabilities[key] = value;
      }
    }
    if (supportedParameters.length) {
      if (!hasOwn(explicitCapabilities, "jsonSchema")) {
        capabilities.jsonSchema = supportedParameters.includes("structured_outputs");
      }
      if (!hasOwn(explicitCapabilities, "jsonMode")) {
        capabilities.jsonMode = supportedParameters.includes("response_format");
      }
    }
    const pick = (key) => {
      var _a3, _b3;
      return (_b3 = (_a3 = existing.record[key]) != null ? _a3 : incoming.record[key]) != null ? _b3 : null;
    };
    const record = {
      ...base,
      id: existing.record.id,
      displayName: existing.record.displayName || incoming.record.displayName || "",
      description: existing.record.description || incoming.record.description || "",
      contextLength: pick("contextLength"),
      maxContextLength: pick("maxContextLength"),
      loadedContextLength: pick("loadedContextLength"),
      contextSource: existing.record.contextSource || incoming.record.contextSource || "",
      outputTokenLimit: pick("outputTokenLimit"),
      inputModalities: [
        .../* @__PURE__ */ new Set([...existing.record.inputModalities || [], ...incoming.record.inputModalities || []])
      ],
      outputModalities: [
        .../* @__PURE__ */ new Set([...existing.record.outputModalities || [], ...incoming.record.outputModalities || []])
      ],
      pricing: {
        prompt: (_g = (_f2 = (_d2 = existing.record.pricing) == null ? void 0 : _d2.prompt) != null ? _f2 : (_e2 = incoming.record.pricing) == null ? void 0 : _e2.prompt) != null ? _g : null,
        completion: (_k = (_j = (_h = existing.record.pricing) == null ? void 0 : _h.completion) != null ? _j : (_i = incoming.record.pricing) == null ? void 0 : _i.completion) != null ? _k : null
      },
      supportedParameters,
      capabilities
    };
    const chat = typeof existing.record.chat === "boolean" ? existing.record.chat : typeof incoming.record.chat === "boolean" ? incoming.record.chat : void 0;
    if (typeof chat === "boolean") {
      record.chat = chat;
    } else {
      delete record.chat;
    }
    return { record, explicitCapabilities, hasObjectRecord: true };
  }
  function normalizeModelRecords(records) {
    const byId = /* @__PURE__ */ new Map();
    for (const input of Array.isArray(records) ? records : []) {
      const details = normalizeModelRecordDetails(input);
      if (!details) {
        continue;
      }
      const existing = byId.get(details.record.id);
      byId.set(details.record.id, existing ? mergeNormalizedModelDetails(existing, details) : details);
    }
    return [...byId.values()].map(({ record }) => record);
  }
  function hasExplicitModelMetadata(record) {
    if (!record || typeof record !== "object") {
      return false;
    }
    return MODEL_STRUCTURED_FIELDS.some(
      (key) => {
        var _a2;
        return typeof record[key] === "boolean" || typeof ((_a2 = record.capabilities) == null ? void 0 : _a2[key]) === "boolean";
      }
    );
  }
  function modelStructuredCapability(record, key) {
    var _a2;
    if (!record || typeof record !== "object") {
      return void 0;
    }
    if (typeof ((_a2 = record.capabilities) == null ? void 0 : _a2[key]) === "boolean") {
      return record.capabilities[key];
    }
    if (typeof record[key] === "boolean") {
      return record[key];
    }
    return void 0;
  }
  function hasStructuredOutput(capabilities) {
    return Boolean((capabilities == null ? void 0 : capabilities.jsonSchema) === true || (capabilities == null ? void 0 : capabilities.jsonMode) === true);
  }
  function effectiveCapabilitiesFor(profile, modelMeta = null) {
    var _a2;
    const providerCapabilities = ((_a2 = registry.providers.get(profile.providerId)) == null ? void 0 : _a2.capabilities) || {};
    const profileCapabilities = profile.capabilities && typeof profile.capabilities === "object" && !Array.isArray(profile.capabilities) ? profile.capabilities : {};
    const capabilities = capabilitiesFor(
      { ...profile, capabilities: { ...providerCapabilities, ...profileCapabilities } },
      modelMeta
    );
    for (const key of PROFILE_CAPABILITY_KEYS) {
      const modelValue = MODEL_STRUCTURED_FIELDS.includes(key) ? modelStructuredCapability(modelMeta, key) : void 0;
      if (modelValue !== void 0) {
        capabilities[key] = modelValue;
      } else if (typeof profileCapabilities[key] === "boolean") {
        capabilities[key] = profileCapabilities[key];
      }
    }
    return capabilities;
  }
  function profileStructuredStatus(profile) {
    const capabilities = effectiveCapabilitiesFor(profile);
    if (hasStructuredOutput(capabilities)) {
      return "supported";
    }
    if (capabilities.jsonSchema === false && capabilities.jsonMode === false) {
      return "unsupported";
    }
    return "unknown";
  }
  function advisorModelStatus(profile, modelId2, record = null) {
    var _a2;
    const id = text(modelId2).trim();
    if (!id) {
      return { available: true, unknown: false, message: "" };
    }
    if ((record == null ? void 0 : record.chat) === false || ((_a2 = record == null ? void 0 : record.capabilities) == null ? void 0 : _a2.chat) === false) {
      return {
        available: false,
        unknown: false,
        message: "This model can't handle chat, so it can't be used for Advisor/actions."
      };
    }
    const capabilities = effectiveCapabilitiesFor(profile, record);
    if (hasExplicitModelMetadata(record)) {
      return hasStructuredOutput(capabilities) ? { available: true, unknown: false, message: "" } : {
        available: false,
        unknown: false,
        message: "This model can't return game actions in the format Pax Historia needs."
      };
    }
    const profileStatus = profileStructuredStatus(profile);
    if (profileStatus === "supported") {
      return {
        available: true,
        unknown: true,
        message: "We couldn't check this model separately, so this connection's settings are used."
      };
    }
    if (profileStatus === "unsupported") {
      return {
        available: false,
        unknown: false,
        message: "This provider can't return game actions in the format Pax Historia needs."
      };
    }
    return {
      available: false,
      unknown: true,
      message: "Couldn't confirm this model works for game actions. Pick one marked Good for actions."
    };
  }
  function modelRecordFor(records, catalog, profile, modelId2) {
    var _a2;
    const id = text(modelId2).trim();
    if (!id) {
      return null;
    }
    const record = (Array.isArray(records) ? records : []).find((entry) => entry.id === id);
    return record || ((_a2 = catalog == null ? void 0 : catalog.peek) == null ? void 0 : _a2.call(catalog, profile, id)) || null;
  }
  function compactTokens(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(value % 1e6 ? 1 : 0)}M`;
    }
    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(value % 1e3 ? 1 : 0)}k`;
    }
    return String(value);
  }
  function modelBadges(record) {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g;
    if (!record) {
      return [];
    }
    const badges = [];
    const context = compactTokens((_a2 = record.contextLength) != null ? _a2 : record.loadedContextLength);
    if (context) {
      badges.push({ label: `${context} context` });
    }
    if (((_b2 = record.capabilities) == null ? void 0 : _b2.jsonSchema) || ((_c2 = record.capabilities) == null ? void 0 : _c2.jsonMode)) {
      badges.push({ label: "Good for actions", tone: "ok" });
    } else if (((_d2 = record.capabilities) == null ? void 0 : _d2.jsonSchema) === false && ((_e2 = record.capabilities) == null ? void 0 : _e2.jsonMode) === false) {
      badges.push({ label: "Not for actions", tone: "warn" });
    }
    const price = (_f2 = record.pricing) == null ? void 0 : _f2.prompt;
    if (price === 0) {
      badges.push({ label: "Free" });
    } else if (Number.isFinite(price)) {
      badges.push({ label: `$${(price * 1e6).toFixed(2)}/M in` });
    }
    if ((_g = record.capabilities) == null ? void 0 : _g.vision) {
      badges.push({ label: "Images" });
    }
    return badges.slice(0, 4);
  }

  // src/relay/ui/state.js
  var ROUTE_KINDS = Object.freeze(["lightweight", "conversation", "advisor"]);
  var ROUTE_LABELS = Object.freeze({
    lightweight: "Emotes",
    conversation: "Conversation",
    advisor: "Advisor / actions"
  });
  var ROUTE_HELP = Object.freeze({
    lightweight: "Short reactions and expressions during play.",
    conversation: "Chat and dialogue during play.",
    advisor: "Planning and game actions. The model must answer in the format the game requires."
  });
  function providerFor(profile) {
    return registry.providers.get(profile == null ? void 0 : profile.providerId) || null;
  }
  function profileLabel(profile) {
    var _a2;
    return text(profile == null ? void 0 : profile.label).trim() || ((_a2 = providerFor(profile)) == null ? void 0 : _a2.label) || "Connection";
  }
  function ensureProfileShape(profile) {
    var _a2;
    const existing = profile.credentials && typeof profile.credentials === "object" && !Array.isArray(profile.credentials) ? profile.credentials : null;
    const headers = profile.headers && typeof profile.headers === "object" && !Array.isArray(profile.headers) ? profile.headers : {};
    const bindingMissing = !text(existing == null ? void 0 : existing.boundEndpoint).trim();
    const hasSecret = Boolean(text(existing == null ? void 0 : existing.secret));
    profile.credentials = existing || { mode: "bearer", name: "", secret: "", boundEndpoint: profile.endpoint || "" };
    (_a2 = profile.credentials).mode || (_a2.mode = "bearer");
    profile.credentials.name = text(profile.credentials.name);
    profile.credentials.secret = text(profile.credentials.secret);
    profile.headers = headers;
    if (bindingMissing && (hasSecret || Object.keys(headers).length > 0)) {
      profile.credentials.secret = "";
      profile.headers = {};
    }
    if (!text(profile.credentials.boundEndpoint).trim()) {
      profile.credentials.boundEndpoint = profile.endpoint || "";
    }
    profile.capabilities || (profile.capabilities = {});
    profile.options || (profile.options = {});
    return profile;
  }
  function ensureRoute(doc, kind) {
    doc.routes || (doc.routes = {});
    const route = doc.routes[kind] || {};
    doc.routes[kind] = {
      ...route,
      profileId: text(route.profileId).trim(),
      model: text(route.model).trim(),
      fallbackModels: [
        ...new Set(
          (Array.isArray(route.fallbackModels) ? route.fallbackModels : []).map((model) => text(model).trim()).filter(Boolean)
        )
      ]
    };
    return doc.routes[kind];
  }
  function routeOwnerId(doc, route) {
    return text(route == null ? void 0 : route.profileId).trim() || text(doc.activeProfileId).trim();
  }
  function clearProfileModelSelections(doc, profile) {
    profile.defaultModel = "";
    for (const kind of ROUTE_KINDS) {
      const route = ensureRoute(doc, kind);
      if (routeOwnerId(doc, route) === profile.id) {
        route.model = "";
        route.fallbackModels = [];
      }
    }
  }
  function clearEndpointBinding(profile, doc) {
    ensureProfileShape(profile);
    profile.credentials.secret = "";
    profile.credentials.boundEndpoint = profile.endpoint || "";
    profile.headers = {};
    clearProfileModelSelections(doc, profile);
  }
  function repairEndpointBinding(profile, doc) {
    const credentials = profile.credentials && typeof profile.credentials === "object" ? profile.credentials : null;
    const bindingMissing = !text(credentials == null ? void 0 : credentials.boundEndpoint).trim();
    const hasSecret = Boolean(text(credentials == null ? void 0 : credentials.secret));
    const hasHeaders = profile.headers && typeof profile.headers === "object" && !Array.isArray(profile.headers) && Object.keys(profile.headers).length > 0;
    ensureProfileShape(profile);
    if (bindingMissing && (hasSecret || hasHeaders)) {
      clearProfileModelSelections(doc, profile);
      return true;
    }
    if (profile.credentials.boundEndpoint === profile.endpoint) {
      return false;
    }
    clearEndpointBinding(profile, doc);
    return true;
  }
  function setSecret(profile, value) {
    ensureProfileShape(profile);
    profile.credentials.secret = value;
    profile.credentials.boundEndpoint = profile.endpoint || "";
  }
  function setEndpoint(profile, doc, value) {
    ensureProfileShape(profile);
    profile.endpoint = value;
    if (profile.endpoint === profile.credentials.boundEndpoint) {
      return false;
    }
    clearEndpointBinding(profile, doc);
    return true;
  }
  function releaseImplicitRoutes(doc) {
    for (const kind of ROUTE_KINDS) {
      const route = ensureRoute(doc, kind);
      if (!route.profileId) {
        route.model = "";
        route.fallbackModels = [];
      }
    }
  }
  function selectProfile(doc, profileId) {
    var _a2;
    if (!((_a2 = doc.profiles) == null ? void 0 : _a2[profileId])) {
      throw new Error("Choose an available connection.");
    }
    if (text(doc.activeProfileId).trim() !== profileId) {
      releaseImplicitRoutes(doc);
      doc.activeProfileId = profileId;
    }
    return doc.profiles[profileId];
  }
  function addProfile(doc, providerId) {
    doc.profiles || (doc.profiles = {});
    const profile = newProfile(providerId || "custom");
    doc.profiles[profile.id] = profile;
    selectProfile(doc, profile.id);
    return profile;
  }
  function removeProfile(doc, profileId) {
    var _a2, _b2;
    if (!((_a2 = doc.profiles) == null ? void 0 : _a2[profileId])) {
      return;
    }
    delete doc.profiles[profileId];
    for (const kind of ROUTE_KINDS) {
      const route = ensureRoute(doc, kind);
      if (route.profileId === profileId) {
        route.profileId = "";
        route.model = "";
        route.fallbackModels = [];
      }
    }
    if (Array.isArray((_b2 = doc.behavior) == null ? void 0 : _b2.fallbackProfiles)) {
      doc.behavior.fallbackProfiles = doc.behavior.fallbackProfiles.filter((id) => id !== profileId);
    }
    if (text(doc.activeProfileId).trim() === profileId) {
      const [next] = Object.keys(doc.profiles);
      doc.activeProfileId = next || "";
      releaseImplicitRoutes(doc);
    }
  }
  function setDefaultModel(doc, profile, modelId2) {
    const previous = text(profile.defaultModel).trim();
    const next = text(modelId2).trim();
    profile.defaultModel = next;
    if (!previous || previous === next) {
      return;
    }
    for (const kind of ROUTE_KINDS) {
      const route = ensureRoute(doc, kind);
      if (routeOwnerId(doc, route) === profile.id && route.model === previous) {
        route.model = "";
      }
    }
  }
  function setRouteModel(doc, kind, profile, modelId2) {
    const route = ensureRoute(doc, kind);
    if (routeOwnerId(doc, route) !== profile.id) {
      route.model = "";
      route.fallbackModels = [];
    }
    route.profileId = profile.id === text(doc.activeProfileId).trim() ? "" : profile.id;
    route.model = text(modelId2).trim();
    const primary = route.model || text(profile.defaultModel).trim();
    route.fallbackModels = route.fallbackModels.filter((model) => model !== primary);
    return route;
  }
  function routesElsewhere(doc, profileId) {
    return ROUTE_KINDS.filter((kind) => {
      var _a2, _b2;
      const owner = text((_b2 = (_a2 = doc.routes) == null ? void 0 : _a2[kind]) == null ? void 0 : _b2.profileId).trim();
      return owner && owner !== profileId;
    });
  }
  function useConnectionForAll(doc, profile) {
    var _a2;
    for (const kind of ROUTE_KINDS) {
      const route = ensureRoute(doc, kind);
      route.profileId = "";
      route.model = "";
      route.fallbackModels = [];
    }
    if (text(doc.activeProfileId).trim() !== profile.id) {
      doc.activeProfileId = profile.id;
    }
    if (((_a2 = doc.behavior) == null ? void 0 : _a2.fallback) === "profiles") {
      doc.behavior.fallback = "error";
      doc.behavior.fallbackProfiles = [];
    }
  }
  function addBackup(doc, kind, profile, modelId2, records, catalog) {
    const id = text(modelId2).trim();
    if (!id) {
      return { ok: false, message: "Enter a model name." };
    }
    if (kind === "advisor") {
      const status = advisorModelStatus(profile, id, modelRecordFor(records, catalog, profile, id));
      if (!status.available) {
        return { ok: false, message: status.message };
      }
    }
    const route = ensureRoute(doc, kind);
    if (routeOwnerId(doc, route) !== profile.id) {
      route.model = "";
      route.fallbackModels = [];
    }
    route.profileId = profile.id === text(doc.activeProfileId).trim() ? "" : profile.id;
    const primary = route.model || text(profile.defaultModel).trim();
    if (id === primary) {
      return { ok: false, message: "That is already the main model." };
    }
    route.fallbackModels = [.../* @__PURE__ */ new Set([...route.fallbackModels, id])];
    return { ok: true };
  }
  function removeBackup(doc, kind, index) {
    ensureRoute(doc, kind).fallbackModels.splice(index, 1);
  }
  function moveBackup(doc, kind, index, delta) {
    const list = ensureRoute(doc, kind).fallbackModels;
    const target = index + delta;
    if (target < 0 || target >= list.length) {
      return;
    }
    [list[index], list[target]] = [list[target], list[index]];
  }
  function isFreshSelection(doc, profile) {
    if (text(profile.defaultModel).trim()) {
      return false;
    }
    return ROUTE_KINDS.every((kind) => {
      const route = ensureRoute(doc, kind);
      return routeOwnerId(doc, route) !== profile.id || !route.model && route.fallbackModels.length === 0;
    });
  }
  function applySuggestions(doc, profile, records, catalog) {
    const suggestions = suggestAssignments(records);
    const main = suggestions.conversation || suggestions.lightweight;
    if (!main) {
      return false;
    }
    setDefaultModel(doc, profile, main);
    const advisorOk = (model) => advisorModelStatus(profile, model, modelRecordFor(records, catalog, profile, model)).available;
    const choose = (kind, model) => setRouteModel(doc, kind, profile, model === main ? "" : model);
    choose("conversation", "");
    choose("lightweight", suggestions.lightweight || "");
    if (advisorOk(main)) {
      choose("advisor", "");
    } else if (suggestions.advisor && advisorOk(suggestions.advisor)) {
      choose("advisor", suggestions.advisor);
    } else {
      choose("advisor", "");
    }
    return true;
  }
  function normalizeRoutes(doc) {
    const active = text(doc.activeProfileId).trim();
    for (const kind of ROUTE_KINDS) {
      const route = ensureRoute(doc, kind);
      if (route.profileId && route.profileId === active) {
        route.profileId = "";
      }
    }
  }

  // src/relay/ui/validate.js
  var AUTH_OPTIONS = Object.freeze([
    ["bearer", "Bearer token"],
    ["header", "API key header"],
    ["query", "Query parameter"],
    ["none", "No authentication"]
  ]);
  var AUTH_MODE_IDS = new Set(AUTH_OPTIONS.map(([id]) => id));
  var AUTH_RESERVED_HEADER = /^(cookie|host|content-length|proxy-authorization)$/i;
  var CUSTOM_RESERVED_HEADER = /^(cookie|host|content-length|authorization|proxy-authorization)$/i;
  var HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
  function ownProfile(profiles, id) {
    return id && Object.prototype.hasOwnProperty.call(profiles, id) ? profiles[id] : null;
  }
  function validateConnection(profile, add) {
    const label = profileLabel(profile);
    const profileId = profile.id;
    const endpointValue = text(profile.endpoint).trim();
    if (!endpointValue) {
      add("endpoint", `${label} needs an API address.`, profileId);
    } else {
      try {
        endpoint(endpointValue);
      } catch (error) {
        add("endpoint", text(error == null ? void 0 : error.message) || "Enter a complete API address.", profileId);
      }
    }
    const credentials = profile.credentials && typeof profile.credentials === "object" && !Array.isArray(profile.credentials) ? profile.credentials : {};
    const mode = credentials.mode ? text(credentials.mode) : "bearer";
    const name = text(credentials.name);
    const secret = text(credentials.secret);
    if (!AUTH_MODE_IDS.has(mode)) {
      add("auth", "Choose how the key is sent.", profileId);
    }
    if (/\r|\n/.test(name + secret) || AUTH_RESERVED_HEADER.test(name)) {
      add("auth", "The key or header name contains an invalid character.", profileId);
    }
    if (mode === "header" || mode === "query") {
      if (!name.trim()) {
        add("auth", "Enter the header or parameter name for the key.", profileId);
      } else if (mode === "header" && !HEADER_NAME.test(name)) {
        add("auth", "The key header name is not valid.", profileId);
      }
    }
    if (profile.headers !== void 0 && (!profile.headers || typeof profile.headers !== "object" || Array.isArray(profile.headers))) {
      add("headers", "Custom headers must be a JSON object.", profileId);
    } else if (profile.headers) {
      for (const [key, value] of Object.entries(profile.headers)) {
        if (CUSTOM_RESERVED_HEADER.test(key) || !HEADER_NAME.test(key) || /\r|\n/.test(key + text(value))) {
          add("headers", "Custom headers contain a reserved or invalid header.", profileId);
          break;
        }
      }
    }
    const protocol = text(profile.protocol).trim();
    if (!registry.protocols.has(protocol)) {
      add(
        "protocol",
        `This version can't connect to ${label} yet.`,
        profileId
      );
    }
  }
  function validateSetup(doc, { records = [], catalog = null } = {}) {
    var _a2, _b2;
    const errors = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (field2, message, profileId = "") => {
      const key = `${field2}|${profileId}|${message}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      errors.push({ field: field2, message, profileId });
    };
    const profiles = (doc == null ? void 0 : doc.profiles) && typeof doc.profiles === "object" && !Array.isArray(doc.profiles) ? doc.profiles : {};
    const activeId = text(doc == null ? void 0 : doc.activeProfileId).trim();
    const active = ownProfile(profiles, activeId);
    if (!active) {
      add("profile", "Choose a provider to connect.");
      return errors;
    }
    const checked = /* @__PURE__ */ new Set();
    const checkProfile = (id) => {
      var _a3;
      const profile = ownProfile(profiles, id);
      if (!profile || checked.has(id)) {
        return profile;
      }
      checked.add(id);
      validateConnection(profile, add);
      const label = profileLabel(profile);
      const credentials = profile.credentials || {};
      if (credentials.mode !== "none" && !text(credentials.secret).trim()) {
        add("key", `${label} needs an API key.`, id);
      }
      const maxTokens = (_a3 = profile.options) == null ? void 0 : _a3.maxOutputTokens;
      if (!Number.isFinite(maxTokens) || maxTokens < 1) {
        add("tokens", `${label} needs a positive output token limit.`, id);
      }
      return profile;
    };
    checkProfile(activeId);
    if (((_a2 = doc == null ? void 0 : doc.behavior) == null ? void 0 : _a2.fallback) === "profiles") {
      for (const raw of Array.isArray(doc.behavior.fallbackProfiles) ? doc.behavior.fallbackProfiles : []) {
        const id = text(raw).trim();
        const profile = ownProfile(profiles, id);
        if (!profile) {
          add("fallback", `Fallback connection "${id || "(missing)"}" is unavailable.`);
          continue;
        }
        checkProfile(id);
        if (!text(profile.defaultModel).trim()) {
          add("fallback", `${profileLabel(profile)} needs a model before it can be used as a fallback.`, id);
        }
      }
    }
    for (const kind of ROUTE_KINDS) {
      const route = ((_b2 = doc == null ? void 0 : doc.routes) == null ? void 0 : _b2[kind]) || {};
      const explicit = text(route.profileId).trim();
      const ownerId = routeOwnerId(doc, route);
      const owner = ownProfile(profiles, ownerId);
      if (!owner) {
        add(`route:${kind}`, `${ROUTE_LABELS[kind]} points to a connection that no longer exists.`);
        continue;
      }
      if (explicit) {
        checkProfile(ownerId);
      }
      const primary = text(route.model).trim() || text(owner.defaultModel).trim();
      if (!primary) {
        add(`route:${kind}`, `Choose a model for ${ROUTE_LABELS[kind]}.`, ownerId);
        continue;
      }
      if (kind !== "advisor") {
        continue;
      }
      const models = [
        ["main", primary],
        ...(Array.isArray(route.fallbackModels) ? route.fallbackModels : []).map((m) => ["backup", text(m).trim()])
      ];
      for (const [role, model] of models) {
        if (!model) {
          continue;
        }
        const status = advisorModelStatus(owner, model, modelRecordFor(records, catalog, owner, model));
        if (!status.available) {
          add(
            "route:advisor",
            `${ROUTE_LABELS.advisor} ${role} model "${model}" can't be used. ${status.message}`,
            ownerId
          );
        }
      }
    }
    return errors;
  }
  function errorsFor(errors, field2, profileId = "") {
    return errors.filter((e) => e.field === field2 && (!e.profileId || !profileId || e.profileId === profileId));
  }

  // src/relay/ui/advanced.js
  var PROTOCOL_LABELS = Object.freeze({
    "openai-chat": "OpenAI-compatible chat",
    "openai-responses": "OpenAI Responses",
    "openrouter-chat": "OpenRouter",
    "gemini-generate-content": "Google Gemini",
    "anthropic-messages": "Anthropic Messages",
    "ollama-native": "Ollama",
    "lmstudio-chat": "LM Studio",
    azure: "Azure AI",
    bedrock: "Amazon Bedrock",
    vertex: "Google Vertex AI",
    replicate: "Replicate",
    cohere: "Cohere",
    "custom-native": "Custom native API"
  });
  var CAPABILITY_FIELDS = Object.freeze([
    ["modelDiscovery", "Can list its models", "Turn off if the provider has no model list."],
    ["jsonSchema", "Supports strict JSON answers", "Needed for Advisor/actions on some providers."],
    ["jsonMode", "Supports JSON mode", "A looser JSON format some providers offer."],
    ["temperature", "Accepts a temperature setting", ""],
    ["maxOutputTokens", "Accepts an output length limit", ""]
  ]);
  var FALLBACK_CHOICES = Object.freeze([
    ["error", "Show an error in the game"],
    ["profiles", "Try my other connections"],
    ["pax", "Use Pax Historia's own AI (may use game credits)"]
  ]);
  function protocolLabel(id) {
    return PROTOCOL_LABELS[id] || id;
  }
  function numberInput(value, { step = "any", min } = {}) {
    return h("input", { type: "number", value: value != null ? value : "", step, min: min != null ? min : null, inputmode: "decimal" });
  }
  function connectionFields(ctx, profile, stack) {
    var _a2, _b2, _c2, _d2, _e2;
    const { doc, errors } = ctx;
    ensureProfileShape(profile);
    const provider = providerFor(profile);
    const endpointShownAbove = ctx.endpointShownAbove(profile);
    const name = h("input", { type: "text", value: profile.label || "" });
    name.addEventListener("input", () => {
      profile.label = name.value;
      ctx.touch();
    });
    stack.append(field({ label: "Connection name", control: name }));
    const protocol = h(
      "select",
      {},
      [.../* @__PURE__ */ new Set([...registry.protocols.keys(), profile.protocol])].map(
        (id) => h("option", { value: id, selected: id === profile.protocol }, protocolLabel(id))
      )
    );
    protocol.addEventListener("change", () => {
      profile.protocol = protocol.value;
      ctx.resetDiscovery();
      ctx.touch();
    });
    stack.append(field({ label: "Connection type", control: protocol, hint: "Match what the provider's API uses. Presets set this for you.", error: (_a2 = errorsFor(errors, "protocol", profile.id)[0]) == null ? void 0 : _a2.message }));
    if (!endpointShownAbove) {
      const endpoint2 = h("input", { type: "url", value: profile.endpoint || "", spellcheck: "false" });
      endpoint2.addEventListener("input", () => {
        const hadKey = Boolean(text(profile.credentials.secret).trim());
        const cleared = setEndpoint(profile, doc, endpoint2.value.trim());
        ctx.resetDiscovery();
        if (cleared && hadKey) {
          ctx.state.notice = "The address changed, so the saved key was cleared. Paste it again.";
          ctx.redraw("connection", "features", "advanced");
        } else {
          ctx.touch();
        }
      });
      stack.append(field({ label: "API address", control: endpoint2, hint: "Changing this clears the saved key so it can't be sent to the wrong place.", error: text(profile.endpoint).trim() ? (_b2 = errorsFor(errors, "endpoint", profile.id)[0]) == null ? void 0 : _b2.message : "" }));
    }
    const mode = h(
      "select",
      {},
      AUTH_OPTIONS.map(([id, label]) => h("option", { value: id, selected: id === profile.credentials.mode }, label))
    );
    const authName = h("input", { type: "text", value: profile.credentials.name || "", spellcheck: "false" });
    const authNameField = field({ label: "Header or parameter name", control: authName, error: (_c2 = errorsFor(errors, "auth", profile.id)[0]) == null ? void 0 : _c2.message });
    authNameField.hidden = !["header", "query"].includes(profile.credentials.mode);
    mode.addEventListener("change", () => {
      profile.credentials.mode = mode.value;
      authNameField.hidden = !["header", "query"].includes(mode.value);
      ctx.resetDiscovery();
      ctx.redraw("connection");
    });
    authName.addEventListener("input", () => {
      profile.credentials.name = authName.value;
      ctx.resetDiscovery();
      ctx.touch();
    });
    stack.append(field({ label: "How the key is sent", control: mode, hint: "Leave this alone unless your provider says otherwise." }), authNameField);
    const completion = h("input", { type: "text", value: profile.completionPath || "", spellcheck: "false" });
    completion.addEventListener("input", () => {
      profile.completionPath = completion.value;
      ctx.resetDiscovery();
    });
    const modelPath = h("input", { type: "text", value: profile.modelPath || "", spellcheck: "false" });
    modelPath.addEventListener("input", () => {
      profile.modelPath = modelPath.value;
      ctx.resetDiscovery();
    });
    stack.append(
      h(
        "div",
        { class: "grid-2" },
        field({ label: "Chat path", control: completion, hint: "Added to the address. Usually blank." }),
        field({ label: "Model list path", control: modelPath, hint: "Added to the address. Usually blank." })
      )
    );
    const headers = h("textarea", { spellcheck: "false" });
    headers.value = JSON.stringify(profile.headers, null, 2);
    const headersError = h("p", { class: "field-error", role: "alert", hidden: true }, "Custom headers must be a JSON object.");
    headers.addEventListener("input", () => {
      try {
        const parsed = JSON.parse(headers.value || "{}");
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          throw new Error("not an object");
        }
        profile.headers = parsed;
        headersError.hidden = true;
        headers.removeAttribute("aria-invalid");
        ctx.resetDiscovery();
        ctx.touch();
      } catch (e) {
        headersError.hidden = false;
        headers.setAttribute("aria-invalid", "true");
      }
    });
    const headersField = field({ label: "Extra headers (JSON)", control: headers, hint: 'Example: {"X-Project": "abc"}. Authorization headers are set above.', error: (_d2 = errorsFor(errors, "headers", profile.id)[0]) == null ? void 0 : _d2.message });
    headersField.append(headersError);
    stack.append(headersField);
    stack.append(
      h(
        "div",
        { class: "stack" },
        CAPABILITY_FIELDS.map(
          ([key, label, hint]) => {
            var _a3, _b3, _c3;
            return checkbox({
              label,
              hint,
              checked: (_c3 = (_b3 = profile.capabilities[key]) != null ? _b3 : (_a3 = provider == null ? void 0 : provider.capabilities) == null ? void 0 : _a3[key]) != null ? _c3 : false,
              onChange: (value) => {
                profile.capabilities[key] = value;
                ctx.resetDiscovery();
                ctx.redraw("features");
              }
            });
          }
        )
      )
    );
    const temperature = numberInput(profile.options.temperature, { step: "0.1", min: 0 });
    temperature.addEventListener("input", () => {
      profile.options.temperature = temperature.value === "" ? profile.options.temperature : Number(temperature.value);
    });
    const maxTokens = numberInput(profile.options.maxOutputTokens, { step: "1", min: 1 });
    maxTokens.addEventListener("input", () => {
      profile.options.maxOutputTokens = maxTokens.value === "" ? NaN : Number(maxTokens.value);
      ctx.touch();
    });
    const timeout = numberInput(Math.round((profile.options.timeoutMs || 12e4) / 1e3), { step: "1", min: 1 });
    timeout.addEventListener("input", () => {
      const seconds = Number(timeout.value);
      if (Number.isFinite(seconds) && seconds > 0) {
        profile.options.timeoutMs = Math.round(seconds * 1e3);
      }
    });
    const current = profile.options.tokenParameter || "max_tokens";
    const tokenParameter = h(
      "select",
      {},
      [.../* @__PURE__ */ new Set(["max_tokens", "max_completion_tokens", current])].map((id) => h("option", { value: id, selected: id === current }, id))
    );
    tokenParameter.addEventListener("change", () => {
      profile.options.tokenParameter = tokenParameter.value;
    });
    stack.append(
      h(
        "div",
        { class: "grid-2" },
        field({ label: "Temperature", control: temperature, hint: "Higher is more creative." }),
        field({ label: "Output length limit (tokens)", control: maxTokens, error: (_e2 = errorsFor(errors, "tokens", profile.id)[0]) == null ? void 0 : _e2.message }),
        field({ label: "Time limit per try (seconds)", control: timeout }),
        field({ label: "Length setting name", control: tokenParameter, hint: "Only change if the provider rejects requests." })
      )
    );
  }
  function behaviorFields(ctx, stack) {
    const { doc, state, diagnostics } = ctx;
    const profiles = Object.values(doc.profiles);
    const others = profiles.filter((p) => p.id !== doc.activeProfileId);
    const choices = FALLBACK_CHOICES.filter(([id]) => id !== "profiles" || others.length > 0 || doc.behavior.fallback === "profiles");
    const select = h("select", { "data-fid": "fallback" }, choices.map(([id, label]) => h("option", { value: id, selected: id === doc.behavior.fallback }, label)));
    select.addEventListener("change", () => {
      doc.behavior.fallback = select.value;
      if (select.value !== "profiles") {
        doc.behavior.fallbackProfiles = [];
      }
      ctx.redraw("advanced");
    });
    stack.append(field({ label: "If your AI can't answer", control: select }));
    if (doc.behavior.fallback === "pax") {
      stack.append(h("p", { class: "notice warn" }, "Failed requests go to Pax Historia's own AI and may use your game account's credits."));
    }
    if (doc.behavior.fallback === "profiles") {
      stack.append(
        h(
          "div",
          { class: "stack" },
          h("p", { class: "hint" }, "Connections to try, in order, each with its main model:"),
          others.map(
            (p) => checkbox({
              label: profileLabel(p),
              checked: doc.behavior.fallbackProfiles.includes(p.id),
              onChange: (on) => {
                const set = new Set(doc.behavior.fallbackProfiles);
                if (on) {
                  set.add(p.id);
                } else {
                  set.delete(p.id);
                }
                doc.behavior.fallbackProfiles = [...set];
                ctx.touch();
              }
            })
          )
        )
      );
    }
    stack.append(
      checkbox({
        label: "Record debug events",
        hint: "Keeps a short log of request timing and status in this tab. It never records keys or messages.",
        checked: doc.behavior.debug,
        onChange: (value) => {
          doc.behavior.debug = value;
          ctx.touch();
        }
      })
    );
    const output = h("pre", { class: "events", hidden: true, tabindex: "0", "aria-label": "Recent debug events" });
    const show = h("button", { type: "button", class: "small", onclick: () => {
      const events = diagnostics.events;
      output.hidden = false;
      output.textContent = events.length ? events.slice(-80).map((x) => `${x.time} ${x.category} ${x.status || ""} ${x.attempt ? `attempt ${x.attempt}` : ""}`.trim()).join("\n") : "No events yet.";
      state.eventsShown = true;
    } }, "Show recent events");
    stack.append(h("div", { class: "row" }, show), output);
  }
  function renderAdvanced(container, ctx) {
    const profile = ctx.profile();
    if (ctx.state.picking && !profile) {
      return;
    }
    const details = h("details", { open: ctx.state.advancedOpen });
    details.addEventListener("toggle", () => {
      ctx.state.advancedOpen = details.open;
    });
    details.append(h("summary", {}, "Advanced settings"));
    const stack = h("div", { class: "stack" });
    if (profile && !ctx.state.picking) {
      connectionFields(ctx, profile, stack);
    }
    behaviorFields(ctx, stack);
    details.append(stack);
    container.append(h("div", { class: "card" }, details));
  }

  // src/relay/ui/detect-key.js
  var PATTERNS = Object.freeze([
    [/^sk-or-/i, "openrouter"],
    [/^sk-ant-/i, "anthropic"],
    [/^AIza[0-9A-Za-z_-]{20,}$/, "google"],
    [/^gsk_/i, "groq"],
    [/^xai-/i, "xai"],
    [/^pplx-/i, "perplexity"],
    [/^csk-/i, "cerebras"],
    [/^hf_/i, "huggingface"],
    [/^nvapi-/i, "nvidia"],
    [/^sk-(proj|svcacct|admin)-/i, "openai"]
  ]);
  function detectProviderFromKey(key) {
    const value = String(key != null ? key : "").trim();
    if (value.length < 12 || /\s/.test(value)) {
      return "";
    }
    for (const [pattern, providerId] of PATTERNS) {
      if (pattern.test(value)) {
        return providerId;
      }
    }
    return "";
  }

  // src/relay/ui/connection.js
  var GROUP_BLURB = Object.freeze({
    "Hosted APIs": "Hosted service",
    Local: "Runs on your computer",
    "Cloud / native setup": "Needs extra setup",
    Advanced: "Any compatible API"
  });
  var GROUP_ORDER = Object.freeze(["Hosted APIs", "Local", "Cloud / native setup", "Advanced"]);
  var QUICK_LOCAL = Object.freeze(["ollama", "lmstudio"]);
  var ENDPOINT_REQUIRED_GROUPS = /* @__PURE__ */ new Set(["Cloud / native setup", "Advanced"]);
  var KEY_HELP = "Create a key in your provider's API or developer settings. Your account password won't work here. The key stays in your userscript manager on this browser and goes only to the provider you chose.";
  function endpointShownInCard(profile) {
    var _a2;
    return ENDPOINT_REQUIRED_GROUPS.has((_a2 = providerFor(profile)) == null ? void 0 : _a2.group) || !text(profile.endpoint).trim();
  }
  function providerSupported(provider) {
    return registry.protocols.has(provider.protocol);
  }
  function providerButton(provider, ctx) {
    const supported2 = providerSupported(provider);
    const button = h(
      "button",
      {
        type: "button",
        class: "provider",
        disabled: !supported2,
        "data-provider": provider.id,
        "data-label": provider.label.toLowerCase()
      },
      h("strong", {}, provider.label),
      h("span", {}, supported2 ? provider.description || GROUP_BLURB[provider.group] || "" : "Not supported yet")
    );
    button.addEventListener("click", () => ctx.chooseProvider(provider.id));
    return button;
  }
  function renderPicker(container, ctx) {
    const { doc } = ctx;
    const providers = [...registry.providers.values()];
    const popular = FEATURED_PROVIDERS.map((id) => registry.providers.get(id)).filter(Boolean);
    const local = QUICK_LOCAL.map((id) => registry.providers.get(id)).filter(Boolean);
    const shown = new Set([...popular, ...local].map((p) => p.id));
    const hasProfiles = Object.keys(doc.profiles).length > 0;
    container.append(
      h(
        "div",
        { class: "card-head" },
        h("h3", {}, "Choose a provider"),
        hasProfiles ? h("button", { type: "button", class: "ghost small", "data-fid": "picker-cancel", onclick: () => ctx.cancelPicker() }, "Cancel") : null
      ),
      h("p", { class: "lede" }, "You need an account and an API key with the provider, or a local AI app running on this computer.")
    );
    const detectHint = h("p", { class: "hint", role: "status" }, "");
    const detectInput = h("input", {
      type: "password",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "Paste a key and we'll find the provider",
      "data-fid": "detect"
    });
    detectInput.addEventListener("input", () => {
      const value = detectInput.value.trim();
      const providerId = detectProviderFromKey(value);
      if (providerId && registry.providers.has(providerId)) {
        ctx.chooseProvider(providerId, { secret: value });
      } else {
        detectHint.textContent = value.length > 12 ? "Couldn't match this key to a provider. Pick one below and paste it again." : "";
      }
    });
    container.append(field({ label: "Already have a key?", control: detectInput }), detectHint);
    container.append(h("p", { class: "group-label" }, "Popular"));
    container.append(h("div", { class: "provider-grid" }, popular.map((p) => providerButton(p, ctx))));
    container.append(h("p", { class: "group-label" }, "On your computer"));
    container.append(h("div", { class: "provider-grid" }, local.map((p) => providerButton(p, ctx))));
    const search = h("input", { type: "search", placeholder: "Search providers", "aria-label": "Search providers", "data-fid": "provider-search" });
    const more = h("details", {}, h("summary", {}, "More providers"));
    const stack = h("div", { class: "stack" }, search);
    const groups = [];
    for (const group of GROUP_ORDER) {
      const members = providers.filter((p) => p.group === group && !shown.has(p.id));
      if (!members.length) {
        continue;
      }
      const label = h("p", { class: "group-label" }, group);
      const grid = h("div", { class: "provider-grid" }, members.map((p) => providerButton(p, ctx)));
      groups.push({ label, grid });
      stack.append(label, grid);
    }
    const empty = h("p", { class: "hint", hidden: true }, "No providers match.");
    stack.append(empty);
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      let any = false;
      for (const { label, grid } of groups) {
        let visible = 0;
        for (const button of grid.children) {
          const match = !query || button.dataset.label.includes(query);
          button.hidden = !match;
          if (match) {
            visible += 1;
          }
        }
        label.hidden = grid.hidden = visible === 0;
        any || (any = visible > 0);
      }
      empty.hidden = any;
    });
    more.append(stack);
    container.append(more);
  }
  function connectionChip(stateName) {
    const labels = { ok: "Connected", bad: "Needs attention", busy: "Connecting" };
    const label = labels[stateName] || "Not tested";
    return h("span", { class: `chip ${stateName}`, "data-chip": "" }, label);
  }
  function statusLine(ctx) {
    const { discovery } = ctx.state;
    const classes = ["conn-status", discovery.state === "ok" ? "ok" : discovery.state === "bad" ? "bad" : discovery.state === "busy" ? "busy" : ""];
    return h("p", { class: classes.filter(Boolean).join(" "), role: "status", "aria-live": "polite", "data-status": "" }, discovery.message || "Not tested yet.");
  }
  function renderConnectionCard(container, ctx, profile) {
    var _a2;
    const { doc, state } = ctx;
    const provider = providerFor(profile);
    const caps = effectiveCapabilitiesFor(profile);
    const canList = caps.modelDiscovery !== false;
    const needsKey = profile.credentials.mode !== "none";
    const profiles = Object.values(doc.profiles);
    const pristine = !text(profile.credentials.secret).trim() && !text(profile.defaultModel).trim();
    const errors = ctx.errors;
    const switcher = profiles.length > 1 ? h(
      "select",
      { "aria-label": "Switch connection", "data-fid": "switch" },
      profiles.map((p) => h("option", { value: p.id, selected: p.id === profile.id }, profileLabel(p)))
    ) : null;
    switcher == null ? void 0 : switcher.addEventListener("change", () => ctx.switchProfile(switcher.value));
    container.append(
      h(
        "div",
        { class: "card-head" },
        h("h3", {}, (provider == null ? void 0 : provider.label) || profileLabel(profile), connectionChip(state.discovery.state)),
        h(
          "div",
          { class: "row" },
          switcher,
          h("button", { type: "button", class: "ghost small", "data-fid": "add-conn", onclick: () => ctx.openPicker() }, pristine ? "Change provider" : "Add another"),
          pristine ? null : h("button", { type: "button", class: "ghost small", "data-fid": "remove-conn", onclick: () => {
            state.confirmRemove = true;
            ctx.redraw("connection");
          } }, "Remove")
        )
      )
    );
    if (state.confirmRemove) {
      container.append(
        h(
          "div",
          { class: "notice bad", role: "alert" },
          `Remove ${profileLabel(profile)}? Its key and model choices are deleted when you save.`,
          h(
            "div",
            { class: "row" },
            h("button", { type: "button", class: "danger small", "data-fid": "remove-yes", onclick: () => ctx.removeCurrent() }, "Remove connection"),
            h("button", { type: "button", class: "small", "data-fid": "remove-no", onclick: () => {
              state.confirmRemove = false;
              ctx.redraw("connection");
            } }, "Keep it")
          )
        )
      );
    }
    if (provider && !providerSupported(provider)) {
      container.append(h("p", { class: "notice warn" }, `This version can't use ${provider.label} yet. Pick another provider.`));
    }
    if (state.notice) {
      container.append(h("p", { class: "notice warn", role: "status" }, state.notice));
    }
    if (endpointShownInCard(profile)) {
      const endpointInput = h("input", { type: "url", value: profile.endpoint || "", placeholder: "https://api.example.com/v1", "data-fid": "endpoint", spellcheck: "false" });
      endpointInput.addEventListener("input", () => {
        const hadKey = Boolean(text(profile.credentials.secret).trim());
        const cleared = setEndpoint(profile, doc, endpointInput.value.trim());
        ctx.resetDiscovery();
        if (cleared && hadKey) {
          state.notice = "The address changed, so the saved key was cleared. Paste it again.";
          ctx.redraw("connection", "features");
        } else {
          ctx.touch();
        }
      });
      container.append(
        field({
          label: "API address",
          control: endpointInput,
          required: true,
          hint: "The base URL from your provider's API documentation.",
          error: text(profile.endpoint).trim() ? (_a2 = errorsFor(errors, "endpoint", profile.id)[0]) == null ? void 0 : _a2.message : ""
        })
      );
    }
    if (needsKey) {
      const keyInput = h("input", {
        type: state.showKey ? "text" : "password",
        value: profile.credentials.secret || "",
        placeholder: "Paste your API key",
        autocomplete: "off",
        spellcheck: "false",
        "data-fid": "key"
      });
      keyInput.addEventListener("input", () => {
        setSecret(profile, keyInput.value);
        state.notice = "";
        ctx.resetDiscovery();
        ctx.touch();
      });
      keyInput.addEventListener("change", () => ctx.autoConnect());
      keyInput.addEventListener("paste", () => setTimeout(() => ctx.autoConnect(), 0));
      const toggle = h(
        "button",
        { type: "button", class: "small", "aria-pressed": String(Boolean(state.showKey)), "data-fid": "key-toggle", onclick: () => {
          state.showKey = !state.showKey;
          ctx.redraw("connection");
        } },
        state.showKey ? "Hide" : "Show"
      );
      container.append(
        field({
          label: "API key",
          control: h("div", { class: "secret" }, keyInput, toggle),
          target: keyInput,
          hint: "Not your account password."
        })
      );
      const detected = detectProviderFromKey(profile.credentials.secret);
      if (detected && detected !== profile.providerId && profile.providerId !== "custom" && registry.providers.has(detected)) {
        container.append(
          h(
            "div",
            { class: "notice warn" },
            `This key looks like a ${registry.providers.get(detected).label} key, not a ${(provider == null ? void 0 : provider.label) || "this provider"} key.`,
            h("div", { class: "row" }, h("button", { type: "button", class: "small", "data-fid": "switch-provider", onclick: () => ctx.chooseProvider(detected, { secret: profile.credentials.secret, replace: profile.id }) }, `Use ${registry.providers.get(detected).label}`))
          )
        );
      }
    } else {
      container.append(h("p", { class: "hint" }, `${(provider == null ? void 0 : provider.label) || "This provider"} runs on your computer and needs no key. Start it, then connect.`));
    }
    container.append(
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            type: "button",
            class: "primary",
            "data-fid": "connect",
            "aria-busy": state.discovery.state === "busy" ? "true" : null,
            disabled: provider && !providerSupported(provider) || needsKey && !text(profile.credentials.secret).trim(),
            onclick: () => ctx.connect()
          },
          canList ? "Connect and load models" : "Test connection"
        )
      ),
      statusLine(ctx)
    );
    if (!canList) {
      container.append(h("p", { class: "hint" }, "This provider has no model list. Type a model name below, then test."));
    }
    container.append(h("details", {}, h("summary", {}, "Where do I get an API key?"), h("p", { class: "hint" }, KEY_HELP)));
  }
  function renderConnection(container, ctx) {
    const profile = ctx.profile();
    if (!profile || ctx.state.picking) {
      renderPicker(container, ctx);
    } else {
      renderConnectionCard(container, ctx, profile);
    }
  }
  function connectionActions(ctx) {
    return {
      chooseProvider(providerId, { secret = "", replace = "" } = {}) {
        const { doc, state } = ctx;
        if (replace) {
          removeProfile(doc, replace);
        }
        const profile = addProfile(doc, providerId);
        if (secret) {
          setSecret(profile, secret);
        }
        state.picking = false;
        state.notice = "";
        state.confirmRemove = false;
        state.showKey = false;
        ctx.resetDiscovery();
        ctx.redraw("connection", "features", "advanced");
        const target = ctx.root.querySelector(secret ? '[data-fid="connect"]' : '[data-fid="key"], [data-fid="endpoint"], [data-fid="connect"]');
        target == null ? void 0 : target.focus({ preventScroll: false });
        if (secret) {
          ctx.autoConnect();
        }
      },
      openPicker() {
        const { doc, state } = ctx;
        const profile = ctx.profile();
        if (profile && !text(profile.credentials.secret).trim() && !text(profile.defaultModel).trim()) {
          removeProfile(doc, profile.id);
        }
        state.picking = true;
        state.confirmRemove = false;
        state.notice = "";
        ctx.resetDiscovery();
        ctx.redraw("connection", "features", "advanced");
      },
      cancelPicker() {
        const { doc, state } = ctx;
        state.picking = false;
        if (!ctx.profile()) {
          const [first] = Object.keys(doc.profiles);
          if (first) {
            selectProfile(doc, first);
          }
        }
        ctx.resetDiscovery();
        ctx.redraw("connection", "features", "advanced");
      },
      switchProfile(id) {
        selectProfile(ctx.doc, id);
        ctx.state.notice = "";
        ctx.state.confirmRemove = false;
        ctx.resetDiscovery();
        ctx.redraw("connection", "features", "advanced");
      },
      removeCurrent() {
        const profile = ctx.profile();
        if (!profile) {
          return;
        }
        removeProfile(ctx.doc, profile.id);
        ctx.state.confirmRemove = false;
        ctx.state.picking = Object.keys(ctx.doc.profiles).length === 0;
        ctx.resetDiscovery();
        ctx.redraw("connection", "features", "advanced");
      }
    };
  }

  // src/relay/ui/features.js
  function badgeList(record) {
    const badges = modelBadges(record);
    if (!badges.length) {
      return null;
    }
    return h(
      "ul",
      { class: "badges", "aria-label": "Model details", title: record.description || "" },
      badges.map((b) => h("li", { class: `badge ${b.tone || ""}`.trim() }, b.label))
    );
  }
  function noticeFor(status, extra) {
    if (status.available && !status.unknown) {
      return null;
    }
    return h("p", { class: `notice ${status.available ? "warn" : "bad"}`, role: "status" }, status.message, extra);
  }
  function modelInput({ value, placeholder, listId, fid, onInput, onChange, label }) {
    const input = h("input", {
      type: "text",
      value: value || "",
      placeholder,
      autocomplete: "off",
      spellcheck: "false",
      list: listId,
      "data-fid": fid,
      "aria-label": label || null
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => onInput(input.value));
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }
  function renderFeatures(container, ctx) {
    const profile = ctx.profile();
    if (!profile || ctx.state.picking) {
      return;
    }
    const { doc, state, catalog } = ctx;
    const records = state.records;
    const listId = uid("models");
    const mainModel = text(profile.defaultModel).trim();
    const elsewhere = routesElsewhere(doc, profile.id);
    container.append(
      h("div", { class: "card-head" }, h("h3", {}, "Model")),
      h(
        "datalist",
        { id: listId },
        records.map((r) => h("option", { value: r.id }, r.displayName && r.displayName !== r.id ? r.displayName : null))
      )
    );
    const mainInput = modelInput({
      value: profile.defaultModel,
      placeholder: records.length ? "Search or type a model name" : "Type a model name",
      listId,
      fid: "main-model",
      onInput: (value) => {
        setDefaultModel(doc, profile, value);
        ctx.touch();
      },
      onChange: () => ctx.redraw("features")
    });
    container.append(
      field({
        label: "Main model",
        control: mainInput,
        hint: records.length ? `${records.length} models available. Start typing to search.` : "Connect above to load the list, or type the exact model name."
      })
    );
    const mainRecord = modelRecordFor(records, catalog, profile, mainModel);
    const mainBadges = badgeList(mainRecord);
    if (mainBadges) {
      container.append(mainBadges);
    }
    if (!records.length) {
      const hints = (modelHintsFor(profile) || []).filter(Boolean);
      if (hints.length && ctx.state.discovery.state === "bad") {
        container.append(
          h("p", { class: "hint" }, "Model names you can try:"),
          h(
            "div",
            { class: "row" },
            hints.map(
              (hint) => h("button", { type: "button", class: "small", onclick: () => {
                setDefaultModel(doc, profile, hint);
                ctx.redraw("features");
              } }, hint)
            )
          )
        );
      }
    } else {
      container.append(
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              type: "button",
              class: "small",
              "data-fid": "suggest",
              onclick: () => {
                if (applySuggestions(doc, profile, records, catalog)) {
                  state.featuresOpen = true;
                  ctx.redraw("features");
                }
              }
            },
            "Suggest models for me"
          )
        )
      );
    }
    if (elsewhere.length) {
      container.append(
        h(
          "div",
          { class: "notice warn" },
          `${elsewhere.map((k) => ROUTE_LABELS[k]).join(", ")} use${elsewhere.length === 1 ? "s" : ""} a different connection.`,
          h(
            "div",
            { class: "row" },
            h(
              "button",
              { type: "button", class: "small", "data-fid": "use-all", onclick: () => {
                useConnectionForAll(doc, profile);
                ctx.redraw("features");
              } },
              `Use ${profileLabel(profile)} for everything`
            )
          )
        )
      );
    }
    const advisorRoute = ensureRoute(doc, "advisor");
    const advisorOwner = routeOwnerId(doc, advisorRoute) === profile.id;
    const advisorModel = text(advisorRoute.model).trim() || mainModel;
    let advisorProblem = false;
    if (advisorOwner && advisorModel) {
      const status = advisorModelStatus(profile, advisorModel, modelRecordFor(records, catalog, profile, advisorModel));
      advisorProblem = !status.available || status.unknown;
      const notice = noticeFor(
        status,
        h(
          "div",
          { class: "row" },
          h("button", { type: "button", class: "small", onclick: () => {
            state.featuresOpen = true;
            ctx.redraw("features");
          } }, "Choose another model for actions")
        )
      );
      if (notice) {
        container.append(notice);
      }
    }
    const hasOverrides = ROUTE_KINDS.some((kind) => {
      const route = ensureRoute(doc, kind);
      return route.model || route.fallbackModels.length > 0;
    });
    const details = h("details", { open: state.featuresOpen || hasOverrides || advisorProblem });
    details.addEventListener("toggle", () => {
      state.featuresOpen = details.open;
    });
    details.append(h("summary", {}, "Per-feature models and backups (optional)"));
    const stack = h("div", { class: "stack" });
    stack.append(h("p", { class: "hint" }, "Leave a feature empty to use the main model. Backups run only if the main model fails, and only the ones you add."));
    for (const kind of ROUTE_KINDS) {
      stack.append(renderFeatureRow(ctx, profile, kind, listId, mainModel));
    }
    details.append(stack);
    container.append(details);
  }
  function renderFeatureRow(ctx, profile, kind, listId, mainModel) {
    var _a2, _b2;
    const { doc, state, catalog } = ctx;
    const records = state.records;
    const route = ensureRoute(doc, kind);
    const owned = routeOwnerId(doc, route) === profile.id;
    const row = h("div", { class: "feature" });
    row.append(
      h("div", { class: "feature-head" }, h("strong", {}, ROUTE_LABELS[kind]), h("span", { class: "hint" }, ROUTE_HELP[kind]))
    );
    if (!owned) {
      const other = doc.profiles[route.profileId];
      row.append(
        h(
          "p",
          { class: "notice warn" },
          other ? `Uses ${profileLabel(other)}.` : "Uses a connection that no longer exists.",
          h(
            "div",
            { class: "row" },
            h("button", { type: "button", class: "small", onclick: () => {
              setRouteModel(doc, kind, profile, "");
              ctx.redraw("features");
            } }, `Use ${profileLabel(profile)} instead`)
          )
        )
      );
      return row;
    }
    row.append(
      modelInput({
        value: route.model,
        placeholder: mainModel ? `Same as main model (${mainModel})` : "Same as main model",
        listId,
        fid: `route-${kind}`,
        label: `${ROUTE_LABELS[kind]} model`,
        onInput: (value) => {
          setRouteModel(doc, kind, profile, value);
          ctx.touch();
        },
        onChange: () => ctx.redraw("features")
      })
    );
    const effective = text(route.model).trim() || mainModel;
    const badges = badgeList(modelRecordFor(records, catalog, profile, effective));
    if (badges) {
      row.append(badges);
    }
    if (kind === "advisor" && effective) {
      const notice = noticeFor(advisorModelStatus(profile, effective, modelRecordFor(records, catalog, profile, effective)));
      if (notice) {
        row.append(notice);
      }
    }
    row.append(h("p", { class: "hint" }, "Backups"));
    if (route.fallbackModels.length) {
      row.append(
        h(
          "ul",
          { class: "backups" },
          route.fallbackModels.map((model, index) => {
            const status = kind === "advisor" ? advisorModelStatus(profile, model, modelRecordFor(records, catalog, profile, model)) : null;
            return h(
              "li",
              { class: "backup" },
              h("span", {}, model, status && (!status.available || status.unknown) ? h("small", { class: "hint" }, ` ${status.message}`) : null),
              h("button", { type: "button", class: "ghost small", "aria-label": `Move ${model} up`, disabled: index === 0, "data-fid": `bk-up-${kind}-${index}`, onclick: () => {
                moveBackup(doc, kind, index, -1);
                ctx.redraw("features");
              } }, "\u2191"),
              h("button", { type: "button", class: "ghost small", "aria-label": `Move ${model} down`, disabled: index === route.fallbackModels.length - 1, "data-fid": `bk-down-${kind}-${index}`, onclick: () => {
                moveBackup(doc, kind, index, 1);
                ctx.redraw("features");
              } }, "\u2193"),
              h("button", { type: "button", class: "ghost small", "aria-label": `Remove ${model} from ${ROUTE_LABELS[kind]} backups`, "data-fid": `bk-rm-${kind}-${index}`, onclick: () => {
                removeBackup(doc, kind, index);
                ctx.redraw("features");
              } }, "\u2715")
            );
          })
        )
      );
    }
    const addInput = h("input", { type: "text", list: listId, placeholder: "Add a backup model", autocomplete: "off", spellcheck: "false", "aria-label": `Add a backup model for ${ROUTE_LABELS[kind]}`, "data-fid": `bk-add-${kind}` });
    const message = h("p", { class: "field-error", role: "alert", hidden: !((_a2 = state.backupMessage) == null ? void 0 : _a2[kind]) }, ((_b2 = state.backupMessage) == null ? void 0 : _b2[kind]) || "");
    const add = () => {
      const result = addBackup(doc, kind, profile, addInput.value, records, catalog);
      state.backupMessage = { ...state.backupMessage || {}, [kind]: result.ok ? "" : result.message };
      ctx.redraw("features");
    };
    addInput.addEventListener("focus", () => addInput.select());
    addInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        add();
      }
    });
    row.append(h("div", { class: "secret" }, addInput, h("button", { type: "button", class: "small", onclick: add }, "Add")), message);
    return row;
  }

  // src/relay/ui/dialog.js
  var idle = () => ({ state: "idle", message: "" });
  function newUiState(doc) {
    return {
      picking: Object.keys(doc.profiles).length === 0,
      records: [],
      discovery: idle(),
      token: 0,
      lastKey: "",
      notice: "",
      confirmRemove: false,
      showKey: false,
      featuresOpen: false,
      advancedOpen: false,
      backupMessage: {},
      view: "edit",
      saving: false,
      footer: { tone: "", message: "" }
    };
  }
  function prepareDoc(doc) {
    const cleared = [];
    doc.profiles || (doc.profiles = {});
    doc.behavior || (doc.behavior = { fallback: "error", fallbackProfiles: [], debug: false });
    for (const profile of Object.values(doc.profiles)) {
      ensureProfileShape(profile);
      if (repairEndpointBinding(profile, doc)) {
        cleared.push(profileLabel(profile));
      }
    }
    if (!doc.profiles[doc.activeProfileId]) {
      doc.activeProfileId = Object.keys(doc.profiles)[0] || "";
    }
    for (const kind of ROUTE_KINDS) {
      ensureRoute(doc, kind);
    }
    normalizeRoutes(doc);
    return cleared;
  }
  function createDialog({ root, store, catalog, http, diagnostics, onClosed }) {
    const titleId = uid("title");
    const dialog = h("dialog", { "aria-labelledby": titleId });
    const closeButton = h("button", { type: "button", class: "ghost icon-btn", "aria-label": "Close", title: "Close" }, "\u2715");
    const main = h("div", { class: "dlg-main" });
    const message = h("section", { class: "card", hidden: true });
    const sections = {
      connection: h("section", { class: "card", "aria-label": "Connection" }),
      features: h("section", { class: "card", "aria-label": "Model" }),
      advanced: h("div")
    };
    const done = h("section", { class: "card", hidden: true, "aria-live": "polite" });
    main.append(message, sections.connection, sections.features, sections.advanced, done);
    const status = h("p", { class: "foot-status", role: "status", "aria-live": "polite" });
    const todo = h("ul", { class: "todo", "aria-label": "Still needed before saving" });
    const cancelButton = h("button", { type: "button", class: "ghost" }, "Cancel");
    const saveButton = h("button", { type: "button", class: "primary" }, "Save");
    const doneButton = h("button", { type: "button", class: "primary", hidden: true }, "Done");
    const editAgain = h("button", { type: "button", hidden: true }, "Edit settings");
    const discardText = h("span", { class: "foot-status bad" }, "Discard your unsaved changes?");
    const keepButton = h("button", { type: "button" }, "Keep editing");
    const discardButton = h("button", { type: "button", class: "danger" }, "Discard");
    const discardBar = h("div", { class: "foot-row", hidden: true, role: "alert" }, discardText, h("div", { class: "foot-actions" }, keepButton, discardButton));
    const actions = h("div", { class: "foot-actions" }, cancelButton, editAgain, saveButton, doneButton);
    const footer = h("div", { class: "dlg-foot" }, todo, h("div", { class: "foot-row" }, status, actions), discardBar);
    const header = h(
      "div",
      { class: "dlg-head" },
      h("div", {}, h("h2", { id: titleId }, "PaxHistoria AI Manager"), h("p", {}, "Pick the AI your game uses")),
      closeButton
    );
    dialog.append(header, main, footer);
    let sessionId = 0;
    let open = false;
    let ctx = null;
    let returnFocus = null;
    let initial = "";
    const dirty = () => Boolean(ctx) && ctx.state.view === "edit" && JSON.stringify(ctx.doc) !== initial;
    function showMessage(title, detail, retry) {
      for (const el of [sections.connection, sections.features, sections.advanced, done]) {
        el.hidden = true;
      }
      message.hidden = false;
      message.replaceChildren(
        h("h3", {}, title),
        h("p", { class: "lede" }, detail),
        retry ? h("div", { class: "row" }, h("button", { type: "button", class: "primary", onclick: retry }, "Try again")) : null
      );
      todo.replaceChildren();
      saveButton.hidden = true;
      editAgain.hidden = true;
      cancelButton.hidden = true;
      doneButton.hidden = true;
      status.textContent = "";
    }
    function updateFooter() {
      if (!ctx) {
        return;
      }
      const { state } = ctx;
      const editing = state.view === "edit";
      cancelButton.hidden = !editing;
      saveButton.hidden = !editing;
      editAgain.hidden = editing;
      doneButton.hidden = editing;
      todo.hidden = !editing;
      if (editing) {
        const errors = ctx.errors;
        const shown = errors.slice(0, 3).map((e) => h("li", {}, e.message));
        if (errors.length > 3) {
          shown.push(h("li", {}, `+${errors.length - 3} more`));
        }
        todo.replaceChildren(...shown);
        saveButton.disabled = errors.length > 0 || state.saving;
        saveButton.setAttribute("aria-busy", state.saving ? "true" : "false");
      }
      status.className = `foot-status ${state.footer.tone}`.trim();
      status.textContent = state.footer.message;
    }
    function summaryRow(label, value) {
      return h("div", {}, h("dt", {}, label), h("dd", {}, value || "None"));
    }
    function renderDone() {
      const { doc } = ctx;
      const profile = doc.profiles[doc.activeProfileId];
      const rows = ROUTE_KINDS.map((kind) => {
        const route = doc.routes[kind];
        const owner = doc.profiles[routeOwnerId(doc, route)];
        const model = text(route.model).trim() || text(owner == null ? void 0 : owner.defaultModel).trim();
        const backups = route.fallbackModels.length;
        return summaryRow(ROUTE_LABELS[kind], `${model}${backups ? ` (+${backups} backup${backups === 1 ? "" : "s"})` : ""}`);
      });
      done.replaceChildren(
        h("div", { class: "center" }, h("div", { class: "big-check", "aria-hidden": "true" }, "\u2713"), h("h3", {}, "Saved")),
        h("p", { class: "lede center" }, "Pax Historia now uses your AI."),
        h("dl", { class: "summary" }, summaryRow("Connection", profile ? profileLabel(profile) : ""), ...rows)
      );
    }
    function applyView() {
      const editing = ctx.state.view === "edit";
      message.hidden = true;
      done.hidden = editing;
      sections.connection.hidden = !editing;
      sections.advanced.hidden = !editing;
      sections.features.hidden = !editing || sections.features.childElementCount === 0;
      if (!editing) {
        renderDone();
      }
      updateFooter();
    }
    const renderers = {
      connection: renderConnection,
      features: renderFeatures,
      advanced: renderAdvanced
    };
    function refreshErrors() {
      ctx.errors = validateSetup(ctx.doc, { records: ctx.state.records, catalog });
    }
    function redraw(...names) {
      if (!ctx) {
        return;
      }
      refreshErrors();
      for (const name of names) {
        const container = sections[name];
        rerender(container, () => renderers[name](container, ctx));
      }
      sections.features.hidden = ctx.state.view !== "edit" || sections.features.childElementCount === 0;
      updateFooter();
    }
    function touch() {
      if (!ctx) {
        return;
      }
      refreshErrors();
      ctx.state.footer = { tone: "", message: "" };
      updateFooter();
    }
    function setStatusLine() {
      const el = sections.connection.querySelector("[data-status]");
      if (!el) {
        return;
      }
      const { discovery } = ctx.state;
      el.className = `conn-status ${discovery.state === "ok" ? "ok" : discovery.state === "bad" ? "bad" : discovery.state === "busy" ? "busy" : ""}`.trim();
      el.textContent = discovery.message || "Not tested yet.";
      const chip = sections.connection.querySelector("[data-chip]");
      if (chip) {
        chip.className = `chip ${discovery.state}`;
        chip.textContent = { ok: "Connected", bad: "Needs attention", busy: "Connecting" }[discovery.state] || "Not tested";
      }
    }
    function resetDiscovery() {
      if (!ctx) {
        return;
      }
      ctx.state.token += 1;
      ctx.state.records = [];
      ctx.state.discovery = idle();
      ctx.state.lastKey = "";
      setStatusLine();
    }
    async function connect() {
      const current = ctx;
      const profile = current == null ? void 0 : current.profile();
      if (!profile || current.state.discovery.state === "busy") {
        return;
      }
      const session = sessionId;
      const token = ++current.state.token;
      const stale = () => !open || session !== sessionId || current !== ctx || token !== current.state.token || current.profile() !== profile;
      const secrets = [profile.credentials.secret, ...Object.values(profile.headers || {})];
      const canList = effectiveCapabilitiesFor(profile).modelDiscovery !== false;
      current.state.discovery = { state: "busy", message: "Connecting\u2026" };
      current.state.notice = "";
      redraw("connection");
      try {
        if (!canList) {
          if (!text(profile.defaultModel).trim()) {
            throw new Error("This provider can't list its models. Type a model name below, then test again.");
          }
          await registry.adapter(profile).complete(
            { messages: [{ role: "user", content: "Reply OK" }], outputContract: null },
            { profile: { ...profile, options: { ...profile.options, maxOutputTokens: 32 } }, model: profile.defaultModel, http }
          );
          if (stale()) {
            return;
          }
          current.state.discovery = { state: "ok", message: "Connected. A small test message worked." };
        } else {
          const records = normalizeModelRecords(await catalog.list(profile, true));
          if (stale()) {
            return;
          }
          current.state.records = records;
          let note = "";
          if (records.length && isFreshSelection(current.doc, profile) && applySuggestions(current.doc, profile, records, catalog)) {
            note = " We picked models for you. Change them below.";
            current.state.featuresOpen = ROUTE_KINDS.some((k) => current.doc.routes[k].model);
          }
          current.state.discovery = records.length ? { state: "ok", message: `Connected. ${records.length} models available.${note}` } : { state: "ok", message: "Connected, but the provider returned no models. Type a model name below." };
        }
        current.state.lastKey = text(profile.credentials.secret);
      } catch (error) {
        if (stale()) {
          return;
        }
        current.state.records = [];
        current.state.discovery = { state: "bad", message: safeErrorMessage(error, secrets) };
      }
      redraw("connection", "features", "advanced");
    }
    function autoConnect() {
      const profile = ctx == null ? void 0 : ctx.profile();
      if (!profile || ctx.state.picking || ctx.state.discovery.state === "busy") {
        return;
      }
      const provider = providerFor(profile);
      if (!provider || !registry.protocols.has(profile.protocol)) {
        return;
      }
      const secret = text(profile.credentials.secret).trim();
      if (profile.credentials.mode !== "none" && !secret) {
        return;
      }
      if (profile.credentials.mode === "none") {
        return;
      }
      if (ctx.state.discovery.state === "ok" && ctx.state.lastKey === text(profile.credentials.secret)) {
        return;
      }
      connect();
    }
    async function save() {
      if (!ctx || ctx.state.saving) {
        return;
      }
      refreshErrors();
      if (ctx.errors.length) {
        return;
      }
      const current = ctx;
      const session = sessionId;
      current.state.saving = true;
      current.state.footer = { tone: "", message: "Saving\u2026" };
      updateFooter();
      try {
        normalizeRoutes(current.doc);
        const saved = await store.write(current.doc);
        if (!open || session !== sessionId || current !== ctx) {
          return;
        }
        if (saved && saved !== current.doc) {
          for (const key of Object.keys(current.doc)) {
            delete current.doc[key];
          }
          Object.assign(current.doc, saved);
        }
        initial = JSON.stringify(current.doc);
        current.state.view = "done";
        current.state.footer = { tone: "", message: "" };
        applyView();
        doneButton.focus();
      } catch (error) {
        if (!open || session !== sessionId || current !== ctx) {
          return;
        }
        current.state.footer = { tone: "bad", message: `Couldn't save: ${safeErrorMessage(error)}` };
      } finally {
        current.state.saving = false;
        if (ctx === current) {
          updateFooter();
        }
      }
    }
    function requestClose() {
      if (!dialog.open) {
        return;
      }
      if (dirty()) {
        discardBar.hidden = false;
        keepButton.focus();
        return;
      }
      dialog.close();
    }
    async function begin() {
      returnFocus = root.activeElement || document.activeElement;
      const session = ++sessionId;
      open = true;
      ctx = null;
      discardBar.hidden = true;
      showMessage("Loading your settings", "One moment.");
      if (!dialog.open) {
        dialog.showModal();
      }
      closeButton.focus();
      try {
        const doc = await store.read();
        if (!open || session !== sessionId) {
          return;
        }
        const cleared = prepareDoc(doc);
        const state = newUiState(doc);
        if (cleared.length) {
          state.notice = `The address for ${cleared.join(", ")} changed, so its saved key was cleared. Paste it again.`;
        }
        ctx = {
          root,
          doc,
          state,
          catalog,
          http,
          diagnostics,
          errors: [],
          profile: () => doc.profiles[doc.activeProfileId] || null,
          touch,
          redraw,
          resetDiscovery,
          connect,
          autoConnect,
          endpointShownAbove: endpointShownInCard
        };
        Object.assign(ctx, connectionActions(ctx));
        initial = JSON.stringify(doc);
        applyView();
        redraw("connection", "features", "advanced");
        main.scrollTop = 0;
        const first = sections.connection.querySelector("[data-fid]");
        first == null ? void 0 : first.focus({ preventScroll: true });
      } catch (error) {
        if (!open || session !== sessionId) {
          return;
        }
        showMessage(
          "Couldn't open your settings",
          "Reload Pax Historia and try again. Nothing was changed.",
          begin
        );
      }
    }
    closeButton.addEventListener("click", requestClose);
    cancelButton.addEventListener("click", requestClose);
    keepButton.addEventListener("click", () => {
      discardBar.hidden = true;
    });
    discardButton.addEventListener("click", () => dialog.close());
    saveButton.addEventListener("click", save);
    doneButton.addEventListener("click", () => dialog.close());
    editAgain.addEventListener("click", () => {
      ctx.state.view = "edit";
      applyView();
      redraw("connection", "features", "advanced");
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      requestClose();
    });
    dialog.addEventListener("close", () => {
      open = false;
      sessionId += 1;
      ctx = null;
      discardBar.hidden = true;
      onClosed == null ? void 0 : onClosed(returnFocus);
      returnFocus = null;
    });
    return { element: dialog, open: begin, close: () => dialog.open && dialog.close() };
  }

  // src/relay/ui/launcher.js
  var FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    "iframe",
    "object",
    "embed",
    "[contenteditable=true]",
    "[tabindex]"
  ].join(",");
  function isFocusable(element) {
    var _a2, _b2, _c2, _d2;
    if (!element || element.isConnected !== true || typeof element.focus !== "function" || element.disabled === true || element.hidden === true || ((_a2 = element.getAttribute) == null ? void 0 : _a2.call(element, "aria-hidden")) === "true") {
      return false;
    }
    if ((_b2 = element.matches) == null ? void 0 : _b2.call(element, ":disabled")) {
      return false;
    }
    const view = (_c2 = element.ownerDocument) == null ? void 0 : _c2.defaultView;
    if (typeof (view == null ? void 0 : view.getComputedStyle) === "function") {
      const style = view.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }
    return ((_d2 = element.matches) == null ? void 0 : _d2.call(element, FOCUSABLE_SELECTOR)) === true;
  }
  function findTopNavigationPlacement(documentRef, launcher) {
    const view = documentRef.defaultView;
    const viewportWidth = (view == null ? void 0 : view.innerWidth) || documentRef.documentElement.clientWidth;
    const buttonRect = launcher.getBoundingClientRect();
    const buttonWidth = buttonRect.width || (viewportWidth <= 600 ? 42 : 62);
    const buttonHeight = buttonRect.height || 36;
    const selector = 'a[href], button, [role="button"]';
    const controls = Array.from(documentRef.querySelectorAll(selector)).filter((element) => {
      var _a2;
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== documentRef.body) {
        if (ancestor.matches(selector)) {
          return false;
        }
        ancestor = ancestor.parentElement;
      }
      const rect = element.getBoundingClientRect();
      const style = (_a2 = view == null ? void 0 : view.getComputedStyle) == null ? void 0 : _a2.call(view, element);
      return rect.width > 0 && rect.height > 0 && rect.top < 100 && rect.bottom > 0 && (style == null ? void 0 : style.display) !== "none" && (style == null ? void 0 : style.visibility) !== "hidden";
    }).map((element) => ({ element, rect: element.getBoundingClientRect() }));
    const navigationFor = (element) => element.closest('nav, [role="navigation"], header, [role="banner"]') || element.parentElement;
    const normalizeLabel = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
    const navigationItems = [
      ["spolecznosc", 4],
      ["community", 4],
      ["flagi", 3],
      ["flags", 3],
      ["presety", 2],
      ["presets", 2],
      ["gry", 1],
      ["games", 1]
    ];
    const labeled = controls.map(({ element, rect }) => {
      const label = normalizeLabel(
        element.getAttribute("aria-label") || element.innerText || element.textContent
      );
      const match = navigationItems.find(
        ([name]) => label === name || label.endsWith(` ${name}`)
      );
      return match ? { element, rect, priority: match[1], watch: navigationFor(element) } : null;
    }).filter(Boolean).sort(
      (left2, right) => right.priority - left2.priority || right.rect.right - left2.rect.right
    );
    const fitAfter = (item) => {
      const next = controls.filter(
        ({ element, rect }) => element !== item.element && rect.left >= item.rect.right - 1
      ).sort((left3, right) => left3.rect.left - right.rect.left)[0];
      const rightEdge = next ? next.rect.left - 8 : viewportWidth - 8;
      const left2 = item.rect.right + 8;
      if (left2 + buttonWidth > rightEdge) {
        return null;
      }
      return {
        left: left2,
        top: item.rect.top + (item.rect.height - buttonHeight) / 2,
        watch: item.watch
      };
    };
    for (const item of labeled) {
      const placement = fitAfter(item);
      if (placement) {
        return placement;
      }
    }
    const sorted = controls.slice().sort((left2, right) => left2.rect.left - right.rect.left);
    const groups = [];
    for (const item of sorted) {
      const group = groups[groups.length - 1];
      if (group && item.rect.left - group.right <= Math.max(72, viewportWidth * 0.045)) {
        group.items.push(item);
        group.right = Math.max(group.right, item.rect.right);
        group.bottom = Math.max(group.bottom, item.rect.bottom);
        group.top = Math.min(group.top, item.rect.top);
      } else {
        groups.push({
          items: [item],
          left: item.rect.left,
          right: item.rect.right,
          top: item.rect.top,
          bottom: item.rect.bottom
        });
      }
    }
    const centralGroup = groups.filter((group) => group.items.length >= 2).sort((left2, right) => {
      const leftCenter = (left2.left + left2.right) / 2;
      const rightCenter = (right.left + right.right) / 2;
      return right.items.length * 100 - Math.abs(rightCenter - viewportWidth / 2) - (left2.items.length * 100 - Math.abs(leftCenter - viewportWidth / 2));
    })[0];
    if (centralGroup) {
      const nextGroup = groups.filter((group) => group.left >= centralGroup.right).sort((left3, right) => left3.left - right.left)[0];
      const left2 = centralGroup.right + 8;
      const rightEdge = nextGroup ? nextGroup.left - 8 : viewportWidth - 8;
      if (left2 + buttonWidth <= rightEdge) {
        return {
          left: left2,
          top: (centralGroup.top + centralGroup.bottom - buttonHeight) / 2,
          watch: navigationFor(centralGroup.items[centralGroup.items.length - 1].element)
        };
      }
    }
    const bars = Array.from(
      documentRef.querySelectorAll('nav, header, [role="navigation"], [role="banner"]')
    ).map((element) => ({ element, rect: element.getBoundingClientRect() })).filter(({ rect }) => rect.width >= viewportWidth * 0.4 && rect.top <= 80 && rect.height >= 28 && rect.height <= 120).sort((left2, right) => right.rect.width - left2.rect.width);
    const bar = bars[0];
    const left = Math.max(8, Math.min(viewportWidth * 0.62, viewportWidth - buttonWidth - 8));
    return {
      left,
      top: bar ? bar.rect.top + (bar.rect.height - buttonHeight) / 2 : 7,
      watch: (bar == null ? void 0 : bar.element) || null
    };
  }
  function createLauncher(documentRef, host, launcher) {
    const view = documentRef.defaultView;
    let observedNavigation = null;
    let scheduled = false;
    let destroyed = false;
    host.classList.add("relay-launcher-fallback");
    (documentRef.body || documentRef.documentElement).append(host);
    const place = () => {
      if (destroyed) {
        return false;
      }
      if (!host.isConnected) {
        (documentRef.body || documentRef.documentElement).append(host);
      }
      const placement = findTopNavigationPlacement(documentRef, launcher);
      if (!placement) {
        host.classList.remove("relay-launcher-positioned");
        host.classList.add("relay-launcher-fallback");
        host.style.left = "";
        host.style.top = "";
        observedNavigation = null;
        return false;
      }
      host.classList.add("relay-launcher-positioned");
      host.classList.remove("relay-launcher-fallback");
      host.style.left = `${Math.round(placement.left)}px`;
      host.style.top = `${Math.round(placement.top)}px`;
      observedNavigation = placement.watch;
      return true;
    };
    const schedule = () => {
      if (scheduled || destroyed) {
        return;
      }
      scheduled = true;
      const run = () => {
        scheduled = false;
        place();
      };
      if (typeof (view == null ? void 0 : view.requestAnimationFrame) === "function") {
        view.requestAnimationFrame(run);
      } else {
        setTimeout(run, 30);
      }
    };
    const touches = (node) => {
      var _a2, _b2;
      return node === observedNavigation || ((_a2 = node.contains) == null ? void 0 : _a2.call(node, observedNavigation)) || ((_b2 = observedNavigation == null ? void 0 : observedNavigation.contains) == null ? void 0 : _b2.call(observedNavigation, node));
    };
    const Observer = view == null ? void 0 : view.MutationObserver;
    const observer = Observer ? new Observer((records) => {
      const relevant = !host.isConnected || !observedNavigation || records.some(
        (r) => touches(r.target) || [...r.removedNodes || [], ...r.addedNodes || []].some(touches)
      );
      if (relevant) {
        schedule();
      }
    }) : null;
    observer == null ? void 0 : observer.observe(documentRef.documentElement, { childList: true, subtree: true });
    view == null ? void 0 : view.addEventListener("resize", schedule, { passive: true });
    view == null ? void 0 : view.addEventListener("scroll", schedule, { passive: true });
    place();
    return {
      place,
      observer,
      destroy() {
        destroyed = true;
        observer == null ? void 0 : observer.disconnect();
        view == null ? void 0 : view.removeEventListener("resize", schedule);
        view == null ? void 0 : view.removeEventListener("scroll", schedule);
        host.remove();
      }
    };
  }

  // src/relay/ui/styles.js
  var CSS = `
:host {
  all: initial;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  vertical-align: middle;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: dark;

  --bg: #0f1722;
  --surface: #162131;
  --surface-2: #1d2a3d;
  --border: #2f3d52;
  --border-strong: #4a5b75;
  --fg: #e8edf5;
  --muted: #a3b2c7;
  --accent: #6ea8ff;
  --accent-fg: #07111f;
  --accent-soft: #1b3558;
  --ok: #5fd3a0;
  --ok-soft: #123628;
  --warn: #f0c36b;
  --warn-soft: #3a2f14;
  --danger: #ff8c9a;
  --danger-soft: #3b1d25;
  --shadow: 0 20px 60px rgba(0, 0, 0, .55);
  --radius: 12px;
  --radius-sm: 8px;
  --gap: 12px;
  color: var(--fg);
}

@media (prefers-color-scheme: light) {
  :host {
    color-scheme: light;
    --bg: #f6f8fb;
    --surface: #ffffff;
    --surface-2: #eef2f8;
    --border: #d5dde9;
    --border-strong: #9fb0c8;
    --fg: #172033;
    --muted: #556379;
    --accent: #1f5fd1;
    --accent-fg: #ffffff;
    --accent-soft: #e2ecfd;
    --ok: #137a4d;
    --ok-soft: #dff5ea;
    --warn: #8a5a00;
    --warn-soft: #fdf1d3;
    --danger: #b3261e;
    --danger-soft: #fde8e6;
    --shadow: 0 20px 60px rgba(20, 30, 50, .25);
  }
}

:host(.relay-launcher-positioned),
:host(.relay-launcher-fallback) { position: fixed; z-index: 2147483646; }
:host(.relay-launcher-fallback) {
  top: calc(7px + env(safe-area-inset-top));
  left: min(62vw, calc(100vw - 96px - env(safe-area-inset-right)));
}

* { box-sizing: border-box; min-width: 0; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
[hidden] { display: none !important; }

/* Launcher ---------------------------------------------------------- */
#launch {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 62px; height: 36px; padding: 0 12px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--fg);
  font-family: inherit; font-size: 12px; font-weight: 650; line-height: 1; cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,.4);
  transition: background-color .15s, border-color .15s;
}
#launch:hover { background: var(--surface-2); border-color: var(--accent); }
#launch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Dialog ------------------------------------------------------------ */
dialog {
  width: min(720px, calc(100vw - 24px)); max-height: min(88dvh, 880px);
  padding: 0; margin: auto; overflow: hidden;
  color: var(--fg); background: var(--bg);
  border: 1px solid var(--border); border-radius: 18px; box-shadow: var(--shadow);
  font: inherit;
}
dialog[open] { display: flex; flex-direction: column; }
dialog::backdrop { background: rgba(5, 9, 15, .66); backdrop-filter: blur(2px); }

.dlg-head {
  display: flex; align-items: center; justify-content: space-between; gap: var(--gap);
  padding: 14px 18px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.dlg-head h2 { margin: 0; font-size: 16px; font-weight: 650; }
.dlg-head p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
.dlg-main { flex: 1 1 auto; overflow-y: auto; padding: 18px; display: grid; gap: 16px; align-content: start; overscroll-behavior: contain; }
.dlg-foot {
  display: grid; gap: 8px; padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border); background: var(--surface);
}
.foot-row { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); flex-wrap: wrap; }
.foot-status { margin: 0; color: var(--muted); font-size: 13px; flex: 1 1 200px; overflow-wrap: anywhere; }
.foot-status.ok { color: var(--ok); }
.foot-status.bad { color: var(--danger); }
.foot-actions { display: flex; gap: 8px; margin-left: auto; }
.todo { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.todo li { padding: 3px 10px; border-radius: 999px; background: var(--warn-soft); color: var(--warn); font-size: 12px; }

/* Cards and sections ------------------------------------------------ */
.card { display: grid; gap: var(--gap); padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.card > h3, .card-head h3 { margin: 0; font-size: 15px; font-weight: 650; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); flex-wrap: wrap; }
.chip { display: inline-block; margin-left: 10px; padding: 2px 10px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); font-size: 12px; font-weight: 600; vertical-align: middle; }
.chip.ok { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
.chip.bad { background: var(--danger-soft); color: var(--danger); border-color: transparent; }
.chip.busy { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
.lede, .hint { margin: 0; color: var(--muted); font-size: 13px; }
.hint { font-size: 12px; }
.muted { color: var(--muted); }

/* Forms ------------------------------------------------------------- */
.field { display: grid; gap: 5px; }
.field label { font-weight: 600; font-size: 13px; }
.req { color: var(--danger); }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); }
button, input, select, textarea { font: inherit; color: inherit; }
input:not([type=checkbox]), select, textarea {
  width: 100%; min-height: 40px; padding: 8px 11px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg);
}
textarea { min-height: 84px; resize: vertical; font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; }
input::placeholder { color: var(--muted); opacity: .8; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, summary:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
[aria-invalid="true"] { border-color: var(--danger) !important; }
.field-error { margin: 0; color: var(--danger); font-size: 12.5px; }
.secret { display: flex; gap: 8px; }
.secret input { flex: 1; }
.check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.check input { width: 18px; height: 18px; margin-top: 2px; flex: none; accent-color: var(--accent); }
.check small { display: block; }

/* Buttons ----------------------------------------------------------- */
button {
  min-height: 40px; padding: 8px 16px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: var(--surface-2); cursor: pointer; font-weight: 600; transition: background-color .15s, border-color .15s, opacity .15s;
}
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: .5; cursor: not-allowed; }
button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
button.primary:hover:not(:disabled) { filter: brightness(1.08); }
button.ghost { background: transparent; border-color: transparent; color: var(--muted); }
button.ghost:hover:not(:disabled) { color: var(--fg); background: var(--surface-2); }
button.danger { color: var(--danger); border-color: var(--danger); background: transparent; }
button.small { min-height: 32px; padding: 4px 10px; font-size: 12.5px; }
button[aria-busy="true"] { position: relative; color: transparent; pointer-events: none; }
button[aria-busy="true"]::after {
  content: ""; position: absolute; inset: 0; margin: auto; width: 16px; height: 16px;
  border: 2px solid var(--accent-fg); border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite;
}
button:not(.primary)[aria-busy="true"]::after { border-color: var(--accent); border-right-color: transparent; }
.icon-btn { width: 40px; padding: 0; font-size: 18px; line-height: 1; }
@keyframes spin { to { transform: rotate(360deg); } }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.row.end { justify-content: flex-end; }

/* Provider picker --------------------------------------------------- */
.group-label { margin: 6px 0 0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.provider-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.provider { display: grid; gap: 2px; align-content: start; text-align: left; min-height: 62px; padding: 10px 12px; background: var(--bg); }
.provider strong { font-size: 13.5px; overflow-wrap: anywhere; }
.provider span { color: var(--muted); font-size: 12px; font-weight: 400; overflow-wrap: anywhere; }
.provider[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.provider:disabled { opacity: .55; }

/* Status, notices, badges ------------------------------------------- */
.conn-status { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 13px; overflow-wrap: anywhere; }
.conn-status::before { content: ""; flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--border-strong); }
.conn-status.ok { color: var(--ok); } .conn-status.ok::before { background: var(--ok); }
.conn-status.bad { color: var(--danger); } .conn-status.bad::before { background: var(--danger); }
.conn-status.busy::before { background: var(--accent); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .3; } }
.notice { margin: 0; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 13px; background: var(--surface-2); border: 1px solid var(--border); overflow-wrap: anywhere; }
.notice.warn { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); }
.notice.bad { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
.notice.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.notice .row { margin-top: 8px; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.badge { padding: 2px 9px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); font-size: 12px; }
.badge.ok { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
.badge.warn { background: var(--warn-soft); color: var(--warn); border-color: transparent; }

/* Features ---------------------------------------------------------- */
.feature { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); }
.feature-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.feature-head strong { font-size: 13.5px; }
.backups { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.backup { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--surface-2); }
.backup span { flex: 1; overflow-wrap: anywhere; font-size: 13px; }
.backup button { min-height: 30px; padding: 2px 8px; }

/* Disclosure -------------------------------------------------------- */
details { border-top: 1px solid var(--border); padding-top: 4px; }
details > summary { cursor: pointer; padding: 8px 0; font-weight: 600; color: var(--fg); list-style-position: inside; }
details[open] > summary { margin-bottom: 8px; }
details > .stack, .stack { display: grid; gap: var(--gap); }
.card details:first-of-type { border-top: 0; padding-top: 0; }
pre.events { margin: 0; padding: 10px; max-height: 200px; overflow: auto; border-radius: var(--radius-sm); background: var(--bg); border: 1px solid var(--border); font-size: 12px; white-space: pre-wrap; }

/* Done screen & messages -------------------------------------------- */
.summary { display: grid; gap: 8px; margin: 0; }
.summary div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.summary dt { color: var(--muted); }
.summary dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.center { text-align: center; padding: 8px 0; }
.big-check { width: 52px; height: 52px; margin: 0 auto 8px; display: grid; place-items: center; border-radius: 50%; background: var(--ok-soft); color: var(--ok); font-size: 26px; }

/* Small screens ----------------------------------------------------- */
@media (max-width: 600px) {
  dialog { width: 100vw; max-width: 100vw; max-height: 92dvh; margin: auto 0 0; border-radius: 18px 18px 0 0; border-bottom: 0; }
  .dlg-main { padding: 14px; }
  .dlg-head, .dlg-foot { padding-left: 14px; padding-right: 14px; }
  .grid-2 { grid-template-columns: 1fr; }
  input:not([type=checkbox]), select, textarea { font-size: 16px; }
  button { min-height: 44px; }
  button.small { min-height: 36px; }
  .foot-actions { width: 100%; }
  .foot-actions button { flex: 1; }
  .provider-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition: none !important; }
}
`;

  // src/relay/panel.js
  function mountPanel(store, catalog, http, diagnostics, documentRef = document) {
    const host = documentRef.createElement("historia-ai-settings");
    const root = host.attachShadow({ mode: "closed" });
    const style = documentRef.createElement("style");
    style.textContent = CSS;
    const launcher = documentRef.createElement("button");
    launcher.id = "launch";
    launcher.type = "button";
    launcher.title = "Open AI Manager";
    launcher.textContent = "AI";
    launcher.setAttribute("aria-label", "Open AI Manager");
    const dialog = createDialog({
      root,
      store,
      catalog,
      http,
      diagnostics,
      onClosed: (returnFocus) => {
        const target = isFocusable(returnFocus) ? returnFocus : launcher;
        try {
          target.focus();
        } catch (e) {
          if (target !== launcher) {
            launcher.focus();
          }
        }
      }
    });
    root.append(style, launcher, dialog.element);
    const placement = createLauncher(documentRef, host, launcher);
    launcher.addEventListener("click", dialog.open);
    return {
      host,
      open: dialog.open,
      navigationObserver: placement.observer,
      destroy() {
        dialog.close();
        placement.destroy();
      }
    };
  }

  // src/relay/cloud.js
  function bearer(profile) {
    if (profile.credentials.mode !== "bearer") {
      throw new RelayFailure(
        "configuration",
        "This cloud connection requires a bearer token."
      );
    }
    return profile;
  }
  var AzureProtocol = class extends ChatProtocol {
    complete(request, ctx) {
      if (!/\/openai\/v1\/?$/.test(ctx.profile.endpoint)) {
        throw new RelayFailure(
          "configuration",
          "Use your Azure resource URL ending in /openai/v1. Enter the deployment name as the model."
        );
      }
      if (!["header", "bearer"].includes(ctx.profile.credentials.mode)) {
        throw new RelayFailure(
          "configuration",
          "Azure requires an api-key header or an Entra bearer token."
        );
      }
      return super.complete(request, ctx);
    }
  };
  var VertexProtocol = class extends GeminiProtocol {
    complete(request, ctx) {
      const profile = bearer(ctx.profile);
      if (!/\/projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/?$/.test(
        profile.endpoint
      )) {
        throw new RelayFailure(
          "configuration",
          "Use the Vertex URL through /v1/projects/PROJECT/locations/REGION/publishers/google. Supply a current OAuth access token."
        );
      }
      return super.complete(request, { ...ctx, profile });
    }
  };
  var BedrockProtocol = class {
    async complete(request, ctx) {
      var _a2, _b2;
      const profile = bearer(ctx.profile);
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: [{ text: m.content }]
      }));
      if (request.outputContract) {
        messages.push({
          role: "user",
          content: [
            {
              text: `Return only JSON matching this schema: ${JSON.stringify(request.outputContract)}`
            }
          ]
        });
      }
      const data = await ctx.http.request(
        profile,
        profile.completionPath || `model/${encodeURIComponent(ctx.model)}/converse`,
        {
          messages,
          inferenceConfig: {
            maxTokens: profile.options.maxOutputTokens,
            ...profile.capabilities.temperature && {
              temperature: profile.options.temperature
            }
          }
        },
        ctx
      );
      if (data.stopReason === "max_tokens") {
        throw new RelayFailure(
          "invalid-response",
          "Bedrock reached the output limit before finishing."
        );
      }
      return (((_b2 = (_a2 = data.output) == null ? void 0 : _a2.message) == null ? void 0 : _b2.content) || []).map((x) => x.text || "").join("");
    }
    async listModels() {
      throw new RelayFailure(
        "configuration",
        "Enter the Bedrock model or inference profile ID manually."
      );
    }
  };
  registry.protocol("azure", new AzureProtocol()).protocol("vertex", new VertexProtocol()).protocol("bedrock", new BedrockProtocol());

  // src/relay/bootstrap.js
  var page = globalThis.unsafeWindow || window;
  var _a, _b, _c, _d, _e, _f;
  if (/^(www\.)?paxhistoria\.co$/.test(page.location.hostname)) {
    const get = globalThis.GM_getValue || ((_b = (_a = globalThis.GM) == null ? void 0 : _a.getValue) == null ? void 0 : _b.bind(globalThis.GM));
    const set = globalThis.GM_setValue || ((_d = (_c = globalThis.GM) == null ? void 0 : _c.setValue) == null ? void 0 : _d.bind(globalThis.GM));
    if (!get || !set) {
      throw new Error("AI Manager needs userscript storage permissions.");
    }
    const store = new ConfigStore({
      get: (key) => get(key),
      set: (key, value) => set(key, value)
    });
    const diagnostics = new Diagnostics(), http = new HttpExecutor(diagnostics), catalog = new ModelCatalog(http);
    installInterceptor(page, new RequestPipeline(store, http, catalog, diagnostics));
    let panel;
    const startUi = () => {
      if (!panel) {
        panel = mountPanel(store, catalog, http, diagnostics, document);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startUi, { once: true });
    } else {
      startUi();
    }
    const menu = globalThis.GM_registerMenuCommand || ((_f = (_e = globalThis.GM) == null ? void 0 : _e.registerMenuCommand) == null ? void 0 : _f.bind(globalThis.GM));
    menu == null ? void 0 : menu("AI Manager settings", () => {
      startUi();
      return panel.open();
    });
  }
})();

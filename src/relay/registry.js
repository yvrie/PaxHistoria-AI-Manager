export const FEATURED_PROVIDERS = Object.freeze([
  "google",
  "zai",
  "openrouter",
  "openai",
]);
export const FEATURED_PROVIDER_IDS = FEATURED_PROVIDERS;

export const PROVIDER_DESCRIPTIONS = Object.freeze({
  google: "Google's Gemini AI, with available models found automatically.",
  zai: "Z.ai's GLM models.",
  openrouter: "One account that can connect to models from many providers.",
  openai: "OpenAI's GPT models.",
});

const baseline = {
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
  vision: false,
};
export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.protocols = new Map();
  }

  register(metadata) {
    const enriched =
      !metadata.description && PROVIDER_DESCRIPTIONS[metadata.id]
        ? { ...metadata, description: PROVIDER_DESCRIPTIONS[metadata.id] }
        : metadata;
    this.providers.set(
      enriched.id,
      Object.freeze({
        ...enriched,
        capabilities: { ...baseline, ...enriched.capabilities },
      }),
    );
    return this;
  }
  protocol(id, adapter) {
    this.protocols.set(id, adapter);
    return this;
  }
  adapter(profile) {
    const protocolId =
      profile.providerId === "lmstudio" && profile.protocol === "openai-chat"
        ? "lmstudio-chat"
        : profile.protocol;
    const adapter = this.protocols.get(protocolId);
    if (!adapter)
      {throw new Error(
        `Protocol ${profile.protocol} requires a cloud or provider-specific adapter. It is not available in this build.`,
      );}
    return adapter;
  }
}
export const registry = new ProviderRegistry();
const entries = [
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
    "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
  ],
];
for (const [id, label, endpoint] of entries)
  {registry.register({
    id,
    label,
    endpoint,
    protocol: id === "openrouter" ? "openrouter-chat" : "openai-chat",
    auth: "bearer",
    group: "Hosted APIs",
  });}
registry.register({
  ...registry.providers.get("openai"),
  capabilities: { temperature: false, jsonMode: true, jsonSchema: true },
  tokenParameter: "max_completion_tokens",
});
registry.register({
  ...registry.providers.get("deepseek"),
  capabilities: { jsonMode: true },
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
    "gemini-3-flash",
  ],
  capabilities: { jsonMode: true, jsonSchema: true },
});
registry.register({
  id: "anthropic",
  label: "Anthropic Claude",
  endpoint: "https://api.anthropic.com/v1",
  protocol: "anthropic-messages",
  auth: "header",
  authName: "x-api-key",
  group: "Hosted APIs",
  capabilities: { jsonSchema: true },
});
for (const [id, label, endpoint] of [
  ["ollama", "Ollama", "http://127.0.0.1:11434"],
  ["lmstudio", "LM Studio", "http://127.0.0.1:1234/v1"],
  ["vllm", "vLLM", "http://127.0.0.1:8000/v1"],
  ["llamacpp", "llama.cpp", "http://127.0.0.1:8080/v1"],
  ["localai", "LocalAI", "http://127.0.0.1:8080/v1"],
  ["kobold", "KoboldCpp", "http://127.0.0.1:5001/v1"],
  ["textwebui", "text-generation-webui", "http://127.0.0.1:5000/v1"],
])
  {registry.register({
    id,
    label,
    endpoint,
    protocol: id === "ollama"
      ? "ollama-native"
      : id === "lmstudio"
        ? "lmstudio-chat"
        : "openai-chat",
    auth: "none",
    group: "Local",
    capabilities: { jsonSchema: id === "ollama" || id === "lmstudio" },
  });}
for (const [id, label, protocol] of [
  ["azure", "Azure AI", "azure"],
  ["bedrock", "Amazon Bedrock", "bedrock"],
  ["vertex", "Google Vertex AI", "vertex"],
  ["replicate", "Replicate", "replicate"],
  ["cohere", "Cohere", "cohere"],
  ["baseten", "Baseten", "custom-native"],
  ["cloudflare", "Cloudflare Workers AI", "custom-native"],
])
  {registry.register({
    id,
    label,
    protocol,
    endpoint: "",
    auth: "bearer",
    group: "Cloud / native setup",
    capabilities: { modelDiscovery: false },
  });}
registry.register({
  ...registry.providers.get("azure"),
  auth: "header",
  authName: "api-key",
  capabilities: { modelDiscovery: false, temperature: false },
  tokenParameter: "max_completion_tokens",
});
registry.register({
  id: "custom",
  label: "Custom API",
  protocol: "openai-chat",
  endpoint: "",
  auth: "bearer",
  group: "Advanced",
});

export function providerOptions() {
  const options = [];
  const featured = new Set();
  for (const id of FEATURED_PROVIDERS) {
    const provider = registry.providers.get(id);
    if (provider) {
      options.push(provider);
      featured.add(id);
    }
  }
  for (const provider of registry.providers.values()) {
    if (!featured.has(provider.id)) {options.push(provider);}
  }
  return options;
}

/** `crypto.randomUUID` needs a secure context; the game may be served over http. */
export function randomId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {return globalThis.crypto.randomUUID();}
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function newProfile(providerId = "custom") {
  const preset = registry.providers.get(providerId);
  if (!preset) {throw new Error("Unknown provider preset.");}
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
      boundEndpoint: preset.endpoint,
    },
    defaultModel: "",
    modelHints: [...(preset.modelHints || [])],
    options: {
      temperature: 0.7,
      maxOutputTokens: providerId === "lmstudio" ? 4096 : 16384,
      timeoutMs: 120000,
      tokenParameter: preset.tokenParameter || "max_tokens",
    },
    capabilities: { ...preset.capabilities },
    headers: {},
    completionPath: "",
    modelPath: "",
  };
}

export function modelHintsFor(profile) {
  if (profile.modelHints?.length) {return profile.modelHints;}
  return registry.providers.get(profile.providerId)?.modelHints || [];
}

export function capabilitiesFor(profile, modelMeta = null) {
  const caps = { ...(profile.capabilities || {}) };
  if (profile.providerId === "deepseek") {
    caps.jsonMode = true;
  }
  if (profile.providerId === "lmstudio") {caps.jsonSchema = true;}
  if (profile.providerId === "anthropic") {caps.jsonSchema = true;}
  return { ...caps, ...(modelMeta?.capabilities || {}) };
}

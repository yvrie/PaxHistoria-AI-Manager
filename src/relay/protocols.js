import { capabilitiesFor, registry } from "./registry.js";
import { schemaDialect } from "./contracts.js";
import { RelayFailure } from "./diagnostics.js";
import { normalizeModelRecord } from "./model-metadata.js";
import { requestSizeReport } from "./request-size.js";
const textParts = (parts) =>
  (parts || [])
    .filter((x) => !x.thought)
    .map((x) => x.text || "")
    .join("");
function strategy(request, profile, capabilities) {
  const messages = structuredClone(request.messages);
  let schema;
  if (request.outputContract) {
    const schemaProtocol = profile.providerId === "lmstudio"
      ? "lmstudio-chat"
      : profile.protocol;
    const dialect = schemaDialect(request.outputContract, schemaProtocol);
    const nativeSchema = capabilities.jsonSchema && !dialect.unsupported.length;
    if (nativeSchema) {
      schema = dialect.schema;
    }
    messages.push({
      role: "user",
      content: nativeSchema
        ? "Return only the requested structured result."
        : `Return one JSON value matching this contract. Do not include commentary or code fences.\n${JSON.stringify(request.outputContract)}`,
    });
  }
  return { messages, schema };
}
const settings = (profile, tokenName, capabilities) => ({
  ...(capabilities.temperature && {
    temperature: profile.options.temperature,
  }),
  ...(capabilities.maxOutputTokens && {
    [tokenName]: profile.options.maxOutputTokens,
  }),
});
function chatTokenParameter(profile, modelMeta) {
  const supported = modelMeta?.supportedParameters;
  if (!Array.isArray(supported) || !supported.length)
    {return profile.options.tokenParameter || "max_tokens";}
  const preferred = profile.options.tokenParameter || "max_tokens";
  if (supported.includes(preferred)) {return preferred;}
  if (supported.includes("max_completion_tokens")) {return "max_completion_tokens";}
  if (supported.includes("max_tokens")) {return "max_tokens";}
  return preferred;
}
export class ChatProtocol {
  async complete(request, ctx) {
    const { profile, http } = ctx;
    const capabilities =
      ctx.effectiveCapabilities || capabilitiesFor(profile, ctx.modelMeta);
    const { messages, schema } = strategy(request, profile, capabilities);
    const requestProfile = profile.providerId === "lmstudio"
      ? {
        ...profile,
        options: { ...profile.options, maxOutputTokens: 4096 },
      }
      : profile;
    const requestCapabilities = profile.providerId === "lmstudio"
      ? { ...capabilities, maxOutputTokens: true }
      : capabilities;
    const tokenParameter = chatTokenParameter(profile, ctx.modelMeta);
    const body = {
      model: ctx.model,
      messages,
      stream: false,
      ...settings(
        requestProfile,
        tokenParameter,
        requestCapabilities,
      ),
    };
    if (schema)
      {body.response_format = {
        type: "json_schema",
        json_schema: { name: "game_response", strict: true, schema },
      };}
    else if (request.outputContract && capabilities.jsonMode)
      {body.response_format = { type: "json_object" };}
    if (
      profile.providerId === "openrouter" &&
      request.outputContract &&
      (schema || capabilities.jsonMode)
    )
      {body.provider = {
        ...(profile.options.providerPreferences || {}),
        require_parameters: true,
      };}
    if (
      profile.providerId === "lmstudio" &&
      request.kind === "advisor" &&
      request.outputContract
    ) {
      console.info("[PAX AI] Request size:", requestSizeReport({
        request,
        messages,
        schema,
      }));
    }
    const data = await http.request(
      profile,
      profile.completionPath || "chat/completions",
      body,
      ctx,
    );
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length")
      {throw new RelayFailure(
        "invalid-response",
        "The model stopped at its output limit before finishing. Increase this profile's output token limit or choose a model with more output capacity.",
      );}
    if (choice?.message?.refusal)
      {throw new RelayFailure("refusal", "The model declined this request.");}
    return (
      choice?.message?.parsed ??
      (Array.isArray(choice?.message?.content)
        ? textParts(choice.message.content)
        : choice?.message?.content)
    );
  }
  async listModels(ctx) {
    const data = await ctx.http.request(
      ctx.profile,
      ctx.profile.modelPath || "models",
      undefined,
      ctx,
    );
    return (data.data || []).map((model) => normalizeModelRecord(model));
  }
}
export { normalizeModelRecord } from "./model-metadata.js";

export class OpenRouterProtocol extends ChatProtocol {
  async listModels(ctx) {
    const data = await ctx.http.request(
      ctx.profile,
      ctx.profile.modelPath || "models",
      undefined,
      ctx,
    );
    return (data.data || []).map((model) => normalizeModelRecord(model));
  }
}

export class ResponsesProtocol extends ChatProtocol {
  async complete(request, ctx) {
    const { profile, http } = ctx;
    const capabilities =
      ctx.effectiveCapabilities || capabilitiesFor(profile, ctx.modelMeta);
    const { messages, schema } = strategy(request, profile, capabilities);
    const body = {
      model: ctx.model,
      input: messages,
      ...settings(profile, "max_output_tokens", capabilities),
    };
    if (schema)
      {body.text = {
        format: {
          type: "json_schema",
          name: "game_response",
          strict: true,
          schema,
        },
      };}
    else if (request.outputContract && capabilities.jsonMode)
      {body.text = { format: { type: "json_object" } };}
    const data = await http.request(
      profile,
      profile.completionPath || "responses",
      body,
      ctx,
    );
    if (data.status === "incomplete")
      {throw new RelayFailure(
        "invalid-response",
        "The model response is incomplete.",
      );}
    return (
      data.output_text ??
      textParts((data.output || []).flatMap((x) => x.content || []))
    );
  }
}
export class GeminiProtocol {
  async complete(request, ctx) {
    const { profile, http } = ctx;
    const capabilities =
      ctx.effectiveCapabilities || capabilitiesFor(profile, ctx.modelMeta);
    const { messages, schema } = strategy(request, profile, capabilities);
    const generationConfig = settings(profile, "maxOutputTokens", capabilities);
    if (request.outputContract && capabilities.jsonMode)
      {generationConfig.responseMimeType = "application/json";}
    if (schema) {
      if (ctx.googleSchemaMode === "legacy") {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseJsonSchema = schema;
      } else {
        generationConfig.responseFormat = {
          text: { mimeType: "application/json", schema },
        };
      }
    }
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const data = await http.request(
      profile,
      profile.completionPath ||
        `models/${encodeURIComponent(ctx.model.replace(/^models\//, ""))}:generateContent`,
      { contents, generationConfig },
      ctx,
    );
    const answer = data.candidates?.[0];
    if (answer?.finishReason === "MAX_TOKENS")
      {throw new RelayFailure(
        "invalid-response",
        "Gemini reached the output limit before finishing.",
      );}
    if (
      ["SAFETY", "RECITATION", "PROHIBITED_CONTENT"].includes(
        answer?.finishReason,
      ) ||
      data.promptFeedback?.blockReason
    )
      {throw new RelayFailure("refusal", "Gemini declined this request.");}
    return textParts(answer?.content?.parts);
  }
  async listModels(ctx) {
    let token = "",
      models = [];
    for (let page = 0; page < 20; page++) {
      const data = await ctx.http.request(
        ctx.profile,
        ctx.profile.modelPath ||
          `models${token ? `?pageToken=${encodeURIComponent(token)}` : ""}`,
        undefined,
        ctx,
      );
      models.push(
        ...(data.models || [])
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent"),
          )
          .map((model) => normalizeModelRecord({
            ...model,
            id: model.name,
            contextLength: model.inputTokenLimit,
            outputTokenLimit: model.outputTokenLimit,
            temperatureSupported: typeof model.temperature === "number",
          })),
      );
      token = data.nextPageToken;
      if (!token || ctx.profile.modelPath) {break;}
    }
    return models;
  }
}
class AnthropicProtocol {
  async complete(request, ctx) {
    const capabilities =
      ctx.effectiveCapabilities || capabilitiesFor(ctx.profile, ctx.modelMeta);
    const { messages, schema } = strategy(request, ctx.profile, capabilities);
    const profile = {
      ...ctx.profile,
      headers: {
        ...ctx.profile.headers,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    };
    const body = {
      model: ctx.model,
      messages,
      max_tokens: profile.options.maxOutputTokens,
      ...settings(profile, "max_tokens", capabilities),
    };
    if (schema)
      {body.output_config = {
        format: { type: "json_schema", schema },
      };}
    const data = await ctx.http.request(
      profile,
      profile.completionPath || "messages",
      body,
      ctx,
    );
    if (data.stop_reason === "max_tokens")
      {throw new RelayFailure(
        "invalid-response",
        "Claude reached the output limit before finishing.",
      );}
    return textParts(data.content);
  }
  async listModels(ctx) {
    const profile = {
      ...ctx.profile,
      headers: {
        ...ctx.profile.headers,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    };
    const data = await ctx.http.request(
      profile,
      profile.modelPath || "models",
      undefined,
      ctx,
    );
    return (data.data || []).map((model) => normalizeModelRecord(model));
  }
}
class OllamaProtocol {
  async complete(request, ctx) {
    const capabilities =
      ctx.effectiveCapabilities || capabilitiesFor(ctx.profile, ctx.modelMeta);
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
          num_predict: ctx.profile.options.maxOutputTokens,
        },
        ...(schema && { format: schema }),
      },
      ctx,
    );
    return data.message?.content;
  }
  async listModels(ctx) {
    const data = await ctx.http.request(
      ctx.profile,
      ctx.profile.modelPath || "api/tags",
      undefined,
      ctx,
    );
    return (data.models || []).map((model) => normalizeModelRecord(model));
  }
}
class LMStudioProtocol extends ChatProtocol {
  async listModels(ctx) {
    let data;
    try {
      data = await ctx.http.request(
        ctx.profile,
        ctx.profile.modelPath || "../api/v1/models",
        undefined,
        ctx,
      );
    } catch (error) {
      if (ctx.profile.modelPath || ![404, 405].includes(error.status)) {throw error;}
      return super.listModels(ctx);
    }
    return (data.models || []).map((model) => {
      const isChatModel = model.type === "llm" || model.type === "vlm";
      const loadedContexts = (Array.isArray(model.loaded_instances)
        ? model.loaded_instances
        : [])
        .map((instance) => Number(instance?.config?.context_length))
        .filter((value) => Number.isFinite(value) && value > 0);
      const loadedContextLength = loadedContexts.length
        ? Math.min(...loadedContexts)
        : null;
      return normalizeModelRecord({
        ...model,
        id: model.key || model.id,
        display_name: model.display_name || model.displayName,
        contextSource: "lmstudio",
        max_context_length: model.max_context_length,
        loaded_context_length: loadedContextLength,
        capabilities: {
          ...(model.capabilities || {}),
          chat: isChatModel,
          jsonSchema: isChatModel,
          tools: model.capabilities?.trained_for_tool_use,
          ...(Array.isArray(model.capabilities?.reasoning?.allowed_options)
            ? { reasoningControls: model.capabilities.reasoning.allowed_options.length > 0 }
            : {}),
        },
      });
    });
  }
}
registry
  .protocol("openai-chat", new ChatProtocol())
  .protocol("openrouter-chat", new OpenRouterProtocol())
  .protocol("openai-responses", new ResponsesProtocol())
  .protocol("gemini-generate-content", new GeminiProtocol())
  .protocol("anthropic-messages", new AnthropicProtocol())
  .protocol("ollama-native", new OllamaProtocol())
  .protocol("lmstudio-chat", new LMStudioProtocol());
export class ModelCatalog {
  constructor(http) {
    this.http = http;
    this.cache = new Map();
  }
  keyFor(profile) {
    return [profile.id, profile.endpoint, profile.protocol, profile.modelPath || ""].join("|");
  }
  async list(profile, refresh = false) {
    const key = this.keyFor(profile);
    const cached = this.cache.get(profile.id);
    if (!refresh && cached?.key === key && cached.expires > Date.now())
      {return cached.models;}
    if (!profile.capabilities.modelDiscovery)
      {throw new RelayFailure(
        "configuration",
        "Enter a model manually for this profile.",
      );}
    const models = [
      ...new Map(
        (await registry.adapter(profile).listModels({
          profile,
          http: this.http,
        }))
          .map(normalizeModelRecord)
          .filter((model) => model.id)
          .map((model) => [model.id, model]),
      ).values(),
    ];
    this.cache.set(profile.id, { key, models, expires: Date.now() + 300000 });
    return models;
  }

  peek(profile, modelId) {
    const key = this.keyFor(profile);
    const cached = this.cache.get(profile.id);
    if (!cached || cached.key !== key) {return null;}
    return cached.models.find((model) => model.id === modelId) || null;
  }
}

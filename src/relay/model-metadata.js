function finiteNumber(value) {
  if (value === null || value === undefined || value === "") {return null;}
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringList(value) {
  if (Array.isArray(value))
    {return value.filter((item) => typeof item === "string");}
  if (value && typeof value === "object") {return Object.keys(value);}
  return [];
}

function firstNumber(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null) {return number;}
  }
  return null;
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

function setCapability(target, name, ...values) {
  const value = values.find((item) => typeof item === "boolean");
  if (value !== undefined) {target[name] = value;}
}

/** Keep useful, non-secret metadata while normalizing common provider shapes. */
export function normalizeModelRecord(value) {
  if (typeof value === "string") {return { id: value.trim() };}
  if (!value || typeof value !== "object") {return { id: "" };}

  const architecture = value.architecture || {};
  const id = firstString(value.id, value.key, value.name).replace(/^models\//, "");
  const supportedParameters = stringList(
    value.supported_parameters ?? value.supportedParameters,
  );
  const inputModalities = stringList(
    value.input_modalities ??
      value.inputModalities ??
      value.supportedInputTypes ??
      architecture.input_modalities,
  );
  const outputModalities = stringList(
    value.output_modalities ??
      value.outputModalities ??
      value.supportedOutputTypes ??
      architecture.output_modalities,
  );
  const sourceCapabilities = value.capabilities && typeof value.capabilities === "object"
    ? value.capabilities
    : {};
  const capabilityTags = Array.isArray(value.capabilities)
    ? value.capabilities
    : [];
  const capabilities = {};

  setCapability(capabilities, "chat", sourceCapabilities.chat, value.chat);
  setCapability(capabilities, "jsonSchema", sourceCapabilities.jsonSchema, value.jsonSchema);
  setCapability(capabilities, "jsonMode", sourceCapabilities.jsonMode, value.jsonMode);
  setCapability(
    capabilities,
    "temperature",
    sourceCapabilities.temperature,
    value.temperatureSupported,
  );
  setCapability(
    capabilities,
    "maxOutputTokens",
    sourceCapabilities.maxOutputTokens,
    value.maxOutputTokensSupported,
  );
  setCapability(capabilities, "vision", sourceCapabilities.vision, value.vision);
  setCapability(
    capabilities,
    "tools",
    sourceCapabilities.tools,
    sourceCapabilities.trained_for_tool_use,
    value.trained_for_tool_use,
    value.tools,
  );
  setCapability(
    capabilities,
    "reasoningControls",
    sourceCapabilities.reasoningControls,
    value.reasoningControls,
    typeof value.thinking === "boolean" ? value.thinking : undefined,
  );
  if (capabilityTags.includes("tool_use") && capabilities.tools === undefined)
    {capabilities.tools = true;}
  if (capabilityTags.includes("vision") && capabilities.vision === undefined)
    {capabilities.vision = true;}
  setCapability(
    capabilities,
    "streaming",
    sourceCapabilities.streaming,
    value.supports_streaming,
    value.supportsStreaming,
  );

  const parameterSet = new Set(supportedParameters);
  if (supportedParameters.length) {
    setCapability(capabilities, "jsonSchema", parameterSet.has("structured_outputs"));
    setCapability(capabilities, "jsonMode", parameterSet.has("response_format"));
    setCapability(capabilities, "temperature", parameterSet.has("temperature"));
    setCapability(
      capabilities,
      "maxOutputTokens",
      parameterSet.has("max_tokens") || parameterSet.has("max_completion_tokens"),
    );
    setCapability(
      capabilities,
      "tools",
      parameterSet.has("tools") || parameterSet.has("tool_choice"),
    );
    setCapability(
      capabilities,
      "reasoningControls",
      parameterSet.has("reasoning") || parameterSet.has("reasoning_effort"),
    );
  }

  if (inputModalities.length && capabilities.vision === undefined)
    {capabilities.vision = inputModalities.includes("image");}
  const generationMethods = stringList(value.supportedGenerationMethods);
  const type = firstString(value.type, value.kind).toLowerCase();
  const generatedText = outputModalities.includes("text");
  if (capabilities.chat === undefined) {
    if (type === "embedding" || type === "embeddings") {capabilities.chat = false;}
    else if (type === "llm" || type === "vlm") {capabilities.chat = true;}
    else if (generationMethods.includes("generateContent")) {capabilities.chat = true;}
    else if (generationMethods.length && !generationMethods.includes("generateContent"))
      {capabilities.chat = false;}
    else if (generatedText)
      {capabilities.chat = true;}
    else if (outputModalities.length && !generatedText)
      {capabilities.chat = false;}
  }

  const reasoning = sourceCapabilities.reasoning ?? value.reasoning;
  if (
    typeof value.thinking === "boolean" && value.thinking &&
    capabilities.reasoningControls === undefined
  ) {capabilities.reasoningControls = true;}
  if (
    Array.isArray(reasoning?.allowed_options) && reasoning.allowed_options.length &&
    capabilities.reasoningControls === undefined
  ) {capabilities.reasoningControls = true;}
  if (
    (sourceCapabilities.trained_for_tool_use === true || value.trained_for_tool_use === true) &&
    capabilities.tools === undefined
  ) {capabilities.tools = true;}

  const topProvider = value.top_provider || {};
  const maxContextLength = firstNumber(
    value.maxContextLength,
    value.max_context_length,
  );
  const loadedContextLength = firstNumber(
    value.loadedContextLength,
    value.loaded_context_length,
  );
  const contextLength = value.contextSource === "lmstudio"
    ? loadedContextLength
    : firstNumber(
      loadedContextLength,
      value.contextLength,
      value.context_length,
      value.contextWindow,
      value.context_window,
      maxContextLength,
      value.inputTokenLimit,
      architecture.context_length,
      topProvider.context_length,
    );
  const outputTokenLimit = firstNumber(
    value.outputTokenLimit,
    value.output_token_limit,
    value.max_output_tokens,
    topProvider.max_completion_tokens,
  );
  const pricing = value.pricing || {};
  const record = {
    id,
    displayName: firstString(value.displayName, value.display_name, value.name),
    description: firstString(value.description),
    contextLength,
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
      completion: firstNumber(pricing.completion, pricing.output),
    },
  };
  const details = value.details || {};
  const family = firstString(value.family, value.arch, architecture.family, details.family);
  const parameterSize = firstString(value.parameterSize, value.parameter_size, details.parameter_size);
  const publisher = firstString(value.publisher, value.owned_by);
  const quantization = value.quantization;
  const quantizationName = typeof quantization === "string"
    ? quantization
    : firstString(quantization?.name, value.quantization_level, details.quantization_level);
  if (family) {record.family = family;}
  if (parameterSize) {record.parameterSize = parameterSize;}
  if (publisher) {record.publisher = publisher;}
  if (quantizationName) {record.quantization = quantizationName;}
  if (typeof capabilities.chat === "boolean") {record.chat = capabilities.chat;}
  return record;
}

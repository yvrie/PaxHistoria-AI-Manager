const NON_CHAT_ID_PARTS = [
  "embedding",
  "embed",
  "image",
  "audio",
  "tts",
  "veo",
  "imagen",
  "moderation",
  "rerank",
];

const LIGHTWEIGHT_PARTS = [
  "lite",
  "mini",
  "small",
  "flash",
  "haiku",
  "nano",
  "fast",
];

const SPECIALTY_SUFFIXES = [
  "embedding",
  "embed",
  "image",
  "audio",
  "tts",
  "veo",
  "imagen",
  "moderation",
  "rerank",
  "whisper",
];

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function metadataText(record) {
  if (!record || typeof record !== "object") {return text(record);}
  try {
    return text(JSON.stringify(record));
  } catch {
    return Object.keys(record).join(" ");
  }
}

function numericValue(...values) {
  for (const value of values) {
    if (typeof value === "number") {
      if (Number.isFinite(value)) {return value;}
      continue;
    }
    if (typeof value !== "string") {continue;}
    const normalized = value.trim();
    if (!normalized) {continue;}
    const number = Number(normalized);
    if (Number.isFinite(number)) {return number;}
  }
  return null;
}

function priceValue(...values) {
  const value = numericValue(...values);
  return value !== null && value >= 0 && Number.isFinite(value * 1e6)
    ? value
    : null;
}

function contextLength(record) {
  const value = numericValue(
    record?.contextLength,
    record?.context_length,
    record?.contextWindow,
    record?.context_window,
    record?.maxContextTokens,
  );
  return value !== null && value > 0 ? value : null;
}

function inputPrice(record) {
  return priceValue(
    record?.pricing?.prompt,
    record?.pricing?.input,
    record?.inputPrice,
    record?.input_price,
  );
}

function outputPrice(record) {
  return priceValue(
    record?.pricing?.completion,
    record?.pricing?.output,
    record?.outputPrice,
    record?.output_price,
  );
}

function capability(record, name) {
  return record?.capabilities?.[name] === true || record?.[name] === true;
}

function explicitlyDisabled(record, name) {
  return record?.capabilities?.[name] === false || record?.[name] === false;
}

function explicitlyEnabled(record, name) {
  return record?.capabilities?.[name] === true || record?.[name] === true;
}

function modelId(record) {
  if (typeof record === "string") {return record.trim();}
  if (!record || typeof record !== "object") {return "";}
  return typeof record.id === "string" ? record.id.trim() : "";
}

function hasPart(id, parts) {
  const segments = id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return parts.some((part) => segments.includes(part));
}

function hasSpecialtySuffix(id) {
  const lower = id.toLowerCase();
  return SPECIALTY_SUFFIXES.some(
    (part) =>
      lower === part ||
      lower.endsWith(`-${part}`) ||
      lower.endsWith(`_${part}`) ||
      lower.endsWith(`/${part}`) ||
      lower.endsWith(`:${part}`),
  );
}

function compareIds(left, right) {
  const a = modelId(left);
  const b = modelId(right);
  if (a < b) {return -1;}
  if (a > b) {return 1;}
  return 0;
}

function comparableRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => modelId(record))
    .filter((record) => {
      if (explicitlyDisabled(record, "chat")) {return false;}
      if (explicitlyEnabled(record, "chat")) {return true;}
      return !hasPart(modelId(record), NON_CHAT_ID_PARTS);
    });
}

function bestRecord(records, score) {
  return [...records].sort((left, right) => {
    const leftScore = score(left);
    const rightScore = score(right);
    for (let index = 0; index < leftScore.length; index += 1) {
      if (leftScore[index] !== rightScore[index])
        {return rightScore[index] - leftScore[index];}
    }
    return compareIds(left, right);
  })[0];
}

function knownPriceRank(record) {
  const price = inputPrice(record);
  return price === null ? 0 : 1;
}

function formatPrice(price) {
  return price === 0 ? "free" : `$${(price * 1e6).toFixed(2)}/M`;
}

function formatTokens(value) {
  if (value === null) {return "Unknown";}
  if (value >= 1_000_000) {return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;}
  if (value >= 1000) {return `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`;}
  return String(value);
}

export function modelLabel(record) {
  const context = contextLength(record);
  const loadedContext = numericValue(record?.loadedContextLength);
  const modelMaxContext = numericValue(record?.maxContextLength);
  const outputLimit = numericValue(record?.outputTokenLimit, record?.output_token_limit);
  const json = capability(record, "jsonSchema")
    ? "JSON Schema"
    : capability(record, "jsonMode")
      ? "JSON mode"
      : explicitlyDisabled(record, "jsonSchema") && explicitlyDisabled(record, "jsonMode")
        ? "No native JSON format"
        : "JSON support unknown";
  const input = inputPrice(record);
  const output = outputPrice(record);
  const inputModalities = Array.isArray(record?.inputModalities)
    ? record.inputModalities
    : [];
  const outputModalities = Array.isArray(record?.outputModalities)
    ? record.outputModalities
    : [];
  const details = [record?.parameterSize, record?.quantization].filter(Boolean);
  const contextLabel = record?.contextSource === "lmstudio"
    ? loadedContext !== null
      ? `Context loaded ${formatTokens(loadedContext)}${modelMaxContext === null ? "" : ` / model max ${formatTokens(modelMaxContext)}`}`
      : modelMaxContext === null
        ? "Context loaded limit unknown"
        : `Context loaded limit unknown / model max ${formatTokens(modelMaxContext)}`
    : `Context ${formatTokens(context)}`;
  const labels = [
    contextLabel,
    ...(outputLimit === null ? [] : [`Output cap ${formatTokens(outputLimit)}`]),
    ...(outputLimit === null && capability(record, "maxOutputTokens")
      ? ["Output limit supported"]
      : []),
    ...(outputLimit === null && explicitlyDisabled(record, "maxOutputTokens")
      ? ["Output limit unavailable"]
      : []),
    json,
    ...(inputModalities.length
      ? [`Input ${inputModalities.map((item) => item.toLowerCase()).join(" + ")}`]
      : capability(record, "vision") ? ["Vision"] : []),
    ...(outputModalities.length
      ? [`Output ${outputModalities.map((item) => item.toLowerCase()).join(" + ")}`]
      : []),
    ...(capability(record, "tools") ? ["Tools"] : []),
    ...(capability(record, "reasoningControls") ? ["Reasoning controls"] : []),
    ...(capability(record, "temperature") ? ["Temperature"] : []),
    ...(capability(record, "streaming") ? ["Streaming"] : []),
    ...details,
    ...(input !== null ? [`Input ${formatPrice(input)}`] : []),
    ...(output !== null ? [`Output ${formatPrice(output)}`] : []),
  ];
  return labels.join(" · ");
}

export function modelSearchText(record) {
  return metadataText(record).toLowerCase();
}

export function filterModels(records, query) {
  const models = comparableRecords(records);
  const search = text(query).trim().toLowerCase();
  if (!search) {return models;}
  return models.filter((record) => modelSearchText(record).includes(search));
}

export function suggestAssignments(records) {
  const models = comparableRecords(records);
  if (!models.length)
    {return { lightweight: "", conversation: "", advisor: "" };}

  const lightweight = bestRecord(models, (record) => [
    explicitlyEnabled(record, "chat") ? 1 : 0,
    hasPart(modelId(record), LIGHTWEIGHT_PARTS) ? 1 : 0,
    knownPriceRank(record),
    inputPrice(record) === null ? 0 : -inputPrice(record),
  ]);

  const conversation = bestRecord(models, (record) => [
    explicitlyEnabled(record, "chat") ? 1 : 0,
    hasSpecialtySuffix(modelId(record)) ? 0 : 1,
    contextLength(record) === null ? 0 : 1,
    contextLength(record) === null ? 0 : contextLength(record),
  ]);

  const advisor = bestRecord(models, (record) => [
    explicitlyEnabled(record, "chat") ? 1 : 0,
    capability(record, "jsonSchema") ? 1 : 0,
    capability(record, "jsonMode") ? 1 : 0,
    numericValue(record?.outputTokenLimit) === null ? 0 : 1,
    numericValue(record?.outputTokenLimit) ?? 0,
    contextLength(record) === null ? 0 : contextLength(record),
  ]);

  return {
    lightweight: modelId(lightweight),
    conversation: modelId(conversation),
    advisor: modelId(advisor),
  };
}

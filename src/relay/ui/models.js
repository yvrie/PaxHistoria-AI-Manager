// Pure model-record helpers: normalisation, capability checks and the
// "can this model drive Advisor/actions" rule. No DOM access.
import { capabilitiesFor, registry } from "../registry.js";
import { normalizeModelRecord } from "../model-metadata.js";
import { text } from "./dom.js";

const MODEL_CAPABILITY_FIELDS = Object.freeze([
  "chat",
  "jsonMode",
  "jsonSchema",
  "temperature",
  "maxOutputTokens",
  "vision",
  "tools",
  "reasoningControls",
  "streaming",
]);
const MODEL_STRUCTURED_FIELDS = Object.freeze(["jsonSchema", "jsonMode"]);
const PROFILE_CAPABILITY_KEYS = Object.freeze([
  "jsonMode",
  "jsonSchema",
  "modelDiscovery",
  "temperature",
  "maxOutputTokens",
]);

function hasOwn(object, key) {
  return object !== null && object !== undefined && Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeModelRecordDetails(record) {
  if (typeof record === "string") {
    const id = record.trim();
    return id ? { record: { id }, explicitCapabilities: {}, hasObjectRecord: false } : null;
  }
  if (!record || typeof record !== "object") {return null;}
  const normalized = normalizeModelRecord(record);
  const id = text(normalized.id).trim();
  if (!id) {return null;}
  const sourceCapabilities =
    record.capabilities && typeof record.capabilities === "object" ? record.capabilities : {};
  const explicitCapabilities = {};
  for (const key of MODEL_CAPABILITY_FIELDS) {
    const value = sourceCapabilities[key] ?? record[key];
    if (typeof value === "boolean") {explicitCapabilities[key] = value;}
  }
  for (const key of MODEL_CAPABILITY_FIELDS) {
    const value = normalized.capabilities?.[key];
    if (typeof value === "boolean" && !hasOwn(explicitCapabilities, key)) {
      explicitCapabilities[key] = value;
    }
  }
  return {
    record: { ...normalized, supportedParameters: [...normalized.supportedParameters] },
    explicitCapabilities,
    hasObjectRecord: true,
  };
}

function mergeNormalizedModelDetails(existing, incoming) {
  const supportedParameters = [
    ...new Set([
      ...(Array.isArray(existing.record.supportedParameters) ? existing.record.supportedParameters : []),
      ...(Array.isArray(incoming.record.supportedParameters) ? incoming.record.supportedParameters : []),
    ]),
  ];
  const explicitCapabilities = { ...existing.explicitCapabilities };
  for (const [key, value] of Object.entries(incoming.explicitCapabilities)) {
    if (!hasOwn(explicitCapabilities, key)) {explicitCapabilities[key] = value;}
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
    const value = incoming.record.capabilities?.[key] ?? existing.record.capabilities?.[key];
    if (typeof value === "boolean") {capabilities[key] = value;}
  }
  if (supportedParameters.length) {
    if (!hasOwn(explicitCapabilities, "jsonSchema")) {
      capabilities.jsonSchema = supportedParameters.includes("structured_outputs");
    }
    if (!hasOwn(explicitCapabilities, "jsonMode")) {
      capabilities.jsonMode = supportedParameters.includes("response_format");
    }
  }
  const pick = (key) => existing.record[key] ?? incoming.record[key] ?? null;
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
      ...new Set([...(existing.record.inputModalities || []), ...(incoming.record.inputModalities || [])]),
    ],
    outputModalities: [
      ...new Set([...(existing.record.outputModalities || []), ...(incoming.record.outputModalities || [])]),
    ],
    pricing: {
      prompt: existing.record.pricing?.prompt ?? incoming.record.pricing?.prompt ?? null,
      completion: existing.record.pricing?.completion ?? incoming.record.pricing?.completion ?? null,
    },
    supportedParameters,
    capabilities,
  };
  const chat =
    typeof existing.record.chat === "boolean"
      ? existing.record.chat
      : typeof incoming.record.chat === "boolean"
        ? incoming.record.chat
        : undefined;
  if (typeof chat === "boolean") {record.chat = chat;}
  else {delete record.chat;}
  return { record, explicitCapabilities, hasObjectRecord: true };
}

/** Return catalog metadata without retaining arbitrary provider response fields. */
export function normalizeModelRecords(records) {
  const byId = new Map();
  for (const input of Array.isArray(records) ? records : []) {
    const details = normalizeModelRecordDetails(input);
    if (!details) {continue;}
    const existing = byId.get(details.record.id);
    byId.set(details.record.id, existing ? mergeNormalizedModelDetails(existing, details) : details);
  }
  return [...byId.values()].map(({ record }) => record);
}

function hasExplicitModelMetadata(record) {
  if (!record || typeof record !== "object") {return false;}
  return MODEL_STRUCTURED_FIELDS.some(
    (key) => typeof record[key] === "boolean" || typeof record.capabilities?.[key] === "boolean",
  );
}

function modelStructuredCapability(record, key) {
  if (!record || typeof record !== "object") {return undefined;}
  if (typeof record.capabilities?.[key] === "boolean") {return record.capabilities[key];}
  if (typeof record[key] === "boolean") {return record[key];}
  return undefined;
}

function hasStructuredOutput(capabilities) {
  return Boolean(capabilities?.jsonSchema === true || capabilities?.jsonMode === true);
}

export function effectiveCapabilitiesFor(profile, modelMeta = null) {
  const providerCapabilities = registry.providers.get(profile.providerId)?.capabilities || {};
  const profileCapabilities =
    profile.capabilities && typeof profile.capabilities === "object" && !Array.isArray(profile.capabilities)
      ? profile.capabilities
      : {};
  const capabilities = capabilitiesFor(
    { ...profile, capabilities: { ...providerCapabilities, ...profileCapabilities } },
    modelMeta,
  );
  for (const key of PROFILE_CAPABILITY_KEYS) {
    const modelValue = MODEL_STRUCTURED_FIELDS.includes(key)
      ? modelStructuredCapability(modelMeta, key)
      : undefined;
    if (modelValue !== undefined) {capabilities[key] = modelValue;}
    else if (typeof profileCapabilities[key] === "boolean") {capabilities[key] = profileCapabilities[key];}
  }
  return capabilities;
}

function profileStructuredStatus(profile) {
  const capabilities = effectiveCapabilitiesFor(profile);
  if (hasStructuredOutput(capabilities)) {return "supported";}
  if (capabilities.jsonSchema === false && capabilities.jsonMode === false) {return "unsupported";}
  return "unknown";
}

/**
 * Can `modelId` produce the structured answers Advisor/actions needs?
 * `available` gates saving; `unknown` means we could not check the model itself.
 */
export function advisorModelStatus(profile, modelId, record = null) {
  const id = text(modelId).trim();
  if (!id) {return { available: true, unknown: false, message: "" };}
  if (record?.chat === false || record?.capabilities?.chat === false) {
    return {
      available: false,
      unknown: false,
      message: "This model can't handle chat, so it can't be used for Advisor/actions.",
    };
  }
  const capabilities = effectiveCapabilitiesFor(profile, record);
  if (hasExplicitModelMetadata(record)) {
    return hasStructuredOutput(capabilities)
      ? { available: true, unknown: false, message: "" }
      : {
          available: false,
          unknown: false,
          message: "This model can't return game actions in the format Pax Historia needs.",
        };
  }
  const profileStatus = profileStructuredStatus(profile);
  if (profileStatus === "supported") {
    return {
      available: true,
      unknown: true,
      message: "We couldn't check this model separately, so this connection's settings are used.",
    };
  }
  if (profileStatus === "unsupported") {
    return {
      available: false,
      unknown: false,
      message: "This provider can't return game actions in the format Pax Historia needs.",
    };
  }
  return {
    available: false,
    unknown: true,
    message: "Couldn't confirm this model works for game actions. Pick one marked Good for actions.",
  };
}

/** Find loaded metadata for a model, falling back to the catalog cache. */
export function modelRecordFor(records, catalog, profile, modelId) {
  const id = text(modelId).trim();
  if (!id) {return null;}
  const record = (Array.isArray(records) ? records : []).find((entry) => entry.id === id);
  return record || catalog?.peek?.(profile, id) || null;
}

function compactTokens(value) {
  if (!Number.isFinite(value)) {return "";}
  if (value >= 1_000_000) {return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;}
  if (value >= 1000) {return `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`;}
  return String(value);
}

/** Up to four short badges for a model: context, game-action support, price. */
export function modelBadges(record) {
  if (!record) {return [];}
  const badges = [];
  const context = compactTokens(record.contextLength ?? record.loadedContextLength);
  if (context) {badges.push({ label: `${context} context` });}
  if (record.capabilities?.jsonSchema || record.capabilities?.jsonMode) {
    badges.push({ label: "Good for actions", tone: "ok" });
  } else if (record.capabilities?.jsonSchema === false && record.capabilities?.jsonMode === false) {
    badges.push({ label: "Not for actions", tone: "warn" });
  }
  const price = record.pricing?.prompt;
  if (price === 0) {badges.push({ label: "Free" });}
  else if (Number.isFinite(price)) {badges.push({ label: `$${(price * 1e6).toFixed(2)}/M in` });}
  if (record.capabilities?.vision) {badges.push({ label: "Images" });}
  return badges.slice(0, 4);
}

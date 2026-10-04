// Pure validation for the draft settings document. Returns every problem
// found as `{ field, message, profileId? }` so the UI can mark each field and
// list what is still missing, instead of reporting only the first error.
import { registry } from "../registry.js";
import { endpoint as transportEndpoint } from "../transport.js";
import { advisorModelStatus, modelRecordFor } from "./models.js";
import { text } from "./dom.js";
import { ROUTE_KINDS, ROUTE_LABELS, profileLabel, routeOwnerId } from "./state.js";

export const AUTH_OPTIONS = Object.freeze([
  ["bearer", "Bearer token"],
  ["header", "API key header"],
  ["query", "Query parameter"],
  ["none", "No authentication"],
]);
const AUTH_MODE_IDS = new Set(AUTH_OPTIONS.map(([id]) => id));
const AUTH_RESERVED_HEADER = /^(cookie|host|content-length|proxy-authorization)$/i;
const CUSTOM_RESERVED_HEADER = /^(cookie|host|content-length|authorization|proxy-authorization)$/i;
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

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
      transportEndpoint(endpointValue);
    } catch (error) {
      add("endpoint", text(error?.message) || "Enter a complete API address.", profileId);
    }
  }

  const credentials =
    profile.credentials && typeof profile.credentials === "object" && !Array.isArray(profile.credentials)
      ? profile.credentials
      : {};
  const mode = credentials.mode ? text(credentials.mode) : "bearer";
  const name = text(credentials.name);
  const secret = text(credentials.secret);
  if (!AUTH_MODE_IDS.has(mode)) {add("auth", "Choose how the key is sent.", profileId);}
  if (/\r|\n/.test(name + secret) || AUTH_RESERVED_HEADER.test(name)) {
    add("auth", "The key or header name contains an invalid character.", profileId);
  }
  if (mode === "header" || mode === "query") {
    if (!name.trim()) {add("auth", "Enter the header or parameter name for the key.", profileId);}
    else if (mode === "header" && !HEADER_NAME.test(name)) {
      add("auth", "The key header name is not valid.", profileId);
    }
  }

  if (profile.headers !== undefined && (!profile.headers || typeof profile.headers !== "object" || Array.isArray(profile.headers))) {
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
      profileId,
    );
  }
}

/** Validate the active connection and every connection a feature or backup uses. */
export function validateSetup(doc, { records = [], catalog = null } = {}) {
  const errors = [];
  const seen = new Set();
  const add = (field, message, profileId = "") => {
    const key = `${field}|${profileId}|${message}`;
    if (seen.has(key)) {return;}
    seen.add(key);
    errors.push({ field, message, profileId });
  };
  const profiles =
    doc?.profiles && typeof doc.profiles === "object" && !Array.isArray(doc.profiles) ? doc.profiles : {};
  const activeId = text(doc?.activeProfileId).trim();
  const active = ownProfile(profiles, activeId);
  if (!active) {
    add("profile", "Choose a provider to connect.");
    return errors;
  }

  const checked = new Set();
  const checkProfile = (id) => {
    const profile = ownProfile(profiles, id);
    if (!profile || checked.has(id)) {return profile;}
    checked.add(id);
    validateConnection(profile, add);
    const label = profileLabel(profile);
    const credentials = profile.credentials || {};
    if (credentials.mode !== "none" && !text(credentials.secret).trim()) {
      add("key", `${label} needs an API key.`, id);
    }
    const maxTokens = profile.options?.maxOutputTokens;
    if (!Number.isFinite(maxTokens) || maxTokens < 1) {
      add("tokens", `${label} needs a positive output token limit.`, id);
    }
    return profile;
  };

  checkProfile(activeId);
  if (doc?.behavior?.fallback === "profiles") {
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
    const route = doc?.routes?.[kind] || {};
    const explicit = text(route.profileId).trim();
    const ownerId = routeOwnerId(doc, route);
    const owner = ownProfile(profiles, ownerId);
    if (!owner) {
      add(`route:${kind}`, `${ROUTE_LABELS[kind]} points to a connection that no longer exists.`);
      continue;
    }
    if (explicit) {checkProfile(ownerId);}
    const primary = text(route.model).trim() || text(owner.defaultModel).trim();
    if (!primary) {
      add(`route:${kind}`, `Choose a model for ${ROUTE_LABELS[kind]}.`, ownerId);
      continue;
    }
    if (kind !== "advisor") {continue;}
    const models = [
      ["main", primary],
      ...(Array.isArray(route.fallbackModels) ? route.fallbackModels : []).map((m) => ["backup", text(m).trim()]),
    ];
    for (const [role, model] of models) {
      if (!model) {continue;}
      const status = advisorModelStatus(owner, model, modelRecordFor(records, catalog, owner, model));
      if (!status.available) {
        add(
          "route:advisor",
          `${ROUTE_LABELS.advisor} ${role} model "${model}" can't be used. ${status.message}`,
          ownerId,
        );
      }
    }
  }
  return errors;
}

export function errorsFor(errors, field, profileId = "") {
  return errors.filter((e) => e.field === field && (!e.profileId || !profileId || e.profileId === profileId));
}

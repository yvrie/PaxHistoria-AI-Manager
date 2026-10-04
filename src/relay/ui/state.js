// Draft-document operations. Every function mutates the draft `doc` in place
// and never touches the DOM, so the rules about credentials, routes and
// backups live in one testable place.
import { newProfile, registry } from "../registry.js";
import { suggestAssignments } from "../model-recommendations.js";
import { advisorModelStatus, modelRecordFor } from "./models.js";
import { text } from "./dom.js";

export const ROUTE_KINDS = Object.freeze(["lightweight", "conversation", "advisor"]);
export const ROUTE_LABELS = Object.freeze({
  lightweight: "Emotes",
  conversation: "Conversation",
  advisor: "Advisor / actions",
});
export const ROUTE_HELP = Object.freeze({
  lightweight: "Short reactions and expressions during play.",
  conversation: "Chat and dialogue during play.",
  advisor: "Planning and game actions. The model must answer in the format the game requires.",
});

export function providerFor(profile) {
  return registry.providers.get(profile?.providerId) || null;
}

export function profileLabel(profile) {
  return text(profile?.label).trim() || providerFor(profile)?.label || "Connection";
}

/** Make sure the nested objects every view reads exist on a profile. */
export function ensureProfileShape(profile) {
  const existing =
    profile.credentials && typeof profile.credentials === "object" && !Array.isArray(profile.credentials)
      ? profile.credentials
      : null;
  const headers =
    profile.headers && typeof profile.headers === "object" && !Array.isArray(profile.headers)
      ? profile.headers
      : {};
  const bindingMissing = !text(existing?.boundEndpoint).trim();
  const hasSecret = Boolean(text(existing?.secret));
  profile.credentials = existing || { mode: "bearer", name: "", secret: "", boundEndpoint: profile.endpoint || "" };
  profile.credentials.mode ||= "bearer";
  profile.credentials.name = text(profile.credentials.name);
  profile.credentials.secret = text(profile.credentials.secret);
  profile.headers = headers;
  // A key with no recorded address could be sent anywhere, so drop it.
  if (bindingMissing && (hasSecret || Object.keys(headers).length > 0)) {
    profile.credentials.secret = "";
    profile.headers = {};
  }
  if (!text(profile.credentials.boundEndpoint).trim()) {
    profile.credentials.boundEndpoint = profile.endpoint || "";
  }
  profile.capabilities ||= {};
  profile.options ||= {};
  return profile;
}

export function ensureRoute(doc, kind) {
  doc.routes ||= {};
  const route = doc.routes[kind] || {};
  doc.routes[kind] = {
    ...route,
    profileId: text(route.profileId).trim(),
    model: text(route.model).trim(),
    fallbackModels: [
      ...new Set(
        (Array.isArray(route.fallbackModels) ? route.fallbackModels : [])
          .map((model) => text(model).trim())
          .filter(Boolean),
      ),
    ],
  };
  return doc.routes[kind];
}

/** The connection a route really uses: its own pick, else the active one. */
export function routeOwnerId(doc, route) {
  return text(route?.profileId).trim() || text(doc.activeProfileId).trim();
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

/** Forget the key and model choices tied to an address that no longer applies. */
export function clearEndpointBinding(profile, doc) {
  ensureProfileShape(profile);
  profile.credentials.secret = "";
  profile.credentials.boundEndpoint = profile.endpoint || "";
  profile.headers = {};
  clearProfileModelSelections(doc, profile);
}

/** Clear credentials and model choices when a stored endpoint no longer matches. */
export function repairEndpointBinding(profile, doc) {
  const credentials =
    profile.credentials && typeof profile.credentials === "object" ? profile.credentials : null;
  const bindingMissing = !text(credentials?.boundEndpoint).trim();
  const hasSecret = Boolean(text(credentials?.secret));
  const hasHeaders =
    profile.headers && typeof profile.headers === "object" && !Array.isArray(profile.headers) &&
    Object.keys(profile.headers).length > 0;
  ensureProfileShape(profile);
  if (bindingMissing && (hasSecret || hasHeaders)) {
    clearProfileModelSelections(doc, profile);
    return true;
  }
  if (profile.credentials.boundEndpoint === profile.endpoint) {return false;}
  clearEndpointBinding(profile, doc);
  return true;
}

/** Store a typed key and bind it to the profile's current address. */
export function setSecret(profile, value) {
  ensureProfileShape(profile);
  profile.credentials.secret = value;
  profile.credentials.boundEndpoint = profile.endpoint || "";
}

/**
 * Change a profile's address. A different address drops the key and model
 * choices so a key is never sent to a server the user did not pick for it.
 * Returns true when something was cleared.
 */
export function setEndpoint(profile, doc, value) {
  ensureProfileShape(profile);
  profile.endpoint = value;
  if (profile.endpoint === profile.credentials.boundEndpoint) {return false;}
  clearEndpointBinding(profile, doc);
  return true;
}

/** Point every route that followed the old active connection at nothing, so it follows the new one. */
function releaseImplicitRoutes(doc) {
  for (const kind of ROUTE_KINDS) {
    const route = ensureRoute(doc, kind);
    if (!route.profileId) {
      route.model = "";
      route.fallbackModels = [];
    }
  }
}

/** Make `profileId` the connection being edited and the one the game uses. */
export function selectProfile(doc, profileId) {
  if (!doc.profiles?.[profileId]) {throw new Error("Choose an available connection.");}
  if (text(doc.activeProfileId).trim() !== profileId) {
    releaseImplicitRoutes(doc);
    doc.activeProfileId = profileId;
  }
  return doc.profiles[profileId];
}

export function addProfile(doc, providerId) {
  doc.profiles ||= {};
  const profile = newProfile(providerId || "custom");
  doc.profiles[profile.id] = profile;
  selectProfile(doc, profile.id);
  return profile;
}

/** Delete a connection and everything that pointed at it. */
export function removeProfile(doc, profileId) {
  if (!doc.profiles?.[profileId]) {return;}
  delete doc.profiles[profileId];
  for (const kind of ROUTE_KINDS) {
    const route = ensureRoute(doc, kind);
    if (route.profileId === profileId) {
      route.profileId = "";
      route.model = "";
      route.fallbackModels = [];
    }
  }
  if (Array.isArray(doc.behavior?.fallbackProfiles)) {
    doc.behavior.fallbackProfiles = doc.behavior.fallbackProfiles.filter((id) => id !== profileId);
  }
  if (text(doc.activeProfileId).trim() === profileId) {
    const [next] = Object.keys(doc.profiles);
    doc.activeProfileId = next || "";
    // Whatever followed the removed connection must not carry its models over.
    releaseImplicitRoutes(doc);
  }
}

/** Set the connection default; routes that used the old default follow the new one. */
export function setDefaultModel(doc, profile, modelId) {
  const previous = text(profile.defaultModel).trim();
  const next = text(modelId).trim();
  profile.defaultModel = next;
  if (!previous || previous === next) {return;}
  for (const kind of ROUTE_KINDS) {
    const route = ensureRoute(doc, kind);
    if (routeOwnerId(doc, route) === profile.id && route.model === previous) {route.model = "";}
  }
}

/** Choose a model for one feature on `profile`. An empty model means "use the default". */
export function setRouteModel(doc, kind, profile, modelId) {
  const route = ensureRoute(doc, kind);
  if (routeOwnerId(doc, route) !== profile.id) {
    route.model = "";
    route.fallbackModels = [];
  }
  route.profileId = profile.id === text(doc.activeProfileId).trim() ? "" : profile.id;
  route.model = text(modelId).trim();
  const primary = route.model || text(profile.defaultModel).trim();
  route.fallbackModels = route.fallbackModels.filter((model) => model !== primary);
  return route;
}

/** Features whose route is assigned to a different connection than `profileId`. */
export function routesElsewhere(doc, profileId) {
  return ROUTE_KINDS.filter((kind) => {
    const owner = text(doc.routes?.[kind]?.profileId).trim();
    return owner && owner !== profileId;
  });
}

/** Send every feature through the selected connection and its default model. */
export function useConnectionForAll(doc, profile) {
  for (const kind of ROUTE_KINDS) {
    const route = ensureRoute(doc, kind);
    route.profileId = "";
    route.model = "";
    route.fallbackModels = [];
  }
  if (text(doc.activeProfileId).trim() !== profile.id) {doc.activeProfileId = profile.id;}
  if (doc.behavior?.fallback === "profiles") {
    doc.behavior.fallback = "error";
    doc.behavior.fallbackProfiles = [];
  }
}

export function addBackup(doc, kind, profile, modelId, records, catalog) {
  const id = text(modelId).trim();
  if (!id) {return { ok: false, message: "Enter a model name." };}
  if (kind === "advisor") {
    const status = advisorModelStatus(profile, id, modelRecordFor(records, catalog, profile, id));
    if (!status.available) {return { ok: false, message: status.message };}
  }
  const route = ensureRoute(doc, kind);
  if (routeOwnerId(doc, route) !== profile.id) {
    route.model = "";
    route.fallbackModels = [];
  }
  route.profileId = profile.id === text(doc.activeProfileId).trim() ? "" : profile.id;
  const primary = route.model || text(profile.defaultModel).trim();
  if (id === primary) {return { ok: false, message: "That is already the main model." };}
  route.fallbackModels = [...new Set([...route.fallbackModels, id])];
  return { ok: true };
}

export function removeBackup(doc, kind, index) {
  ensureRoute(doc, kind).fallbackModels.splice(index, 1);
}

export function moveBackup(doc, kind, index, delta) {
  const list = ensureRoute(doc, kind).fallbackModels;
  const target = index + delta;
  if (target < 0 || target >= list.length) {return;}
  [list[index], list[target]] = [list[target], list[index]];
}

/** True when nothing has been chosen yet for this connection, so suggestions are safe to apply automatically. */
export function isFreshSelection(doc, profile) {
  if (text(profile.defaultModel).trim()) {return false;}
  return ROUTE_KINDS.every((kind) => {
    const route = ensureRoute(doc, kind);
    return routeOwnerId(doc, route) !== profile.id || (!route.model && route.fallbackModels.length === 0);
  });
}

/**
 * Pick sensible models from a loaded list: one main model for everything, with
 * a per-feature override only where the main model is a poor fit (cheaper
 * model for Emotes, or a model that can answer in the Advisor format).
 */
export function applySuggestions(doc, profile, records, catalog) {
  const suggestions = suggestAssignments(records);
  const main = suggestions.conversation || suggestions.lightweight;
  if (!main) {return false;}
  setDefaultModel(doc, profile, main);
  const advisorOk = (model) =>
    advisorModelStatus(profile, model, modelRecordFor(records, catalog, profile, model)).available;
  const choose = (kind, model) => setRouteModel(doc, kind, profile, model === main ? "" : model);
  choose("conversation", "");
  choose("lightweight", suggestions.lightweight || "");
  if (advisorOk(main)) {choose("advisor", "");}
  else if (suggestions.advisor && advisorOk(suggestions.advisor)) {choose("advisor", suggestions.advisor);}
  else {choose("advisor", "");}
  return true;
}

/** Fold explicit route owners that equal the active connection back to "follow active". */
export function normalizeRoutes(doc) {
  const active = text(doc.activeProfileId).trim();
  for (const kind of ROUTE_KINDS) {
    const route = ensureRoute(doc, kind);
    if (route.profileId && route.profileId === active) {route.profileId = "";}
  }
}

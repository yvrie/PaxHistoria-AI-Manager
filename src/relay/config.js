import { newProfile } from "./registry.js";
import { migrateConfiguration } from "./migration.js";
export const CONFIG_KEY = "historia-relay.document.v2";
const routeKinds = ["conversation", "advisor", "lightweight"];
export function normalizeConfiguration(input) {
  const doc = structuredClone(input);
  doc.migrations = { ...(doc.migrations || {}) };
  doc.routes ||= {};
  for (const kind of routeKinds) {
    const route = doc.routes[kind] || {};
    doc.routes[kind] = {
      profileId: String(route.profileId || ""),
      model: String(route.model || ""),
      fallbackModels: [
        ...new Set(
          (Array.isArray(route.fallbackModels) ? route.fallbackModels : [])
            .map((model) => String(model).trim())
            .filter(Boolean),
        ),
      ],
    };
  }
  doc.behavior = {
    fallback: "error",
    fallbackProfiles: [],
    debug: false,
    ...(doc.behavior || {}),
  };
  doc.behavior.fallbackProfiles = [
    ...new Set(
      (Array.isArray(doc.behavior.fallbackProfiles)
        ? doc.behavior.fallbackProfiles
        : []
      ).filter(Boolean),
    ),
  ];
  return doc;
}
export function emptyConfiguration() {
  return {
    version: 2,
    profiles: {},
    activeProfileId: "",
    routes: Object.fromEntries(
      routeKinds.map((kind) => [
        kind,
        { profileId: "", model: "", fallbackModels: [] },
      ]),
    ),
    behavior: { fallback: "error", fallbackProfiles: [], debug: false },
    ui: {},
    migrations: { lmStudioOutputBudgetV1: true },
  };
}
export class ConfigStore {
  constructor(port) {
    this.port = port;
  }
  async read() {
    const saved = await this.port.get(CONFIG_KEY);
    if (saved) {
      if (saved.version !== 2) {throw new Error("Unsupported settings version.");}
      const normalized = normalizeConfiguration(saved);
      if (!normalized.migrations.lmStudioOutputBudgetV1) {
        for (const profile of Object.values(normalized.profiles || {})) {
          if (
            profile?.providerId === "lmstudio" &&
            Number(profile.options?.maxOutputTokens) === 16384
          ) {
            profile.options.maxOutputTokens = 4096;
          }
        }
        normalized.migrations.lmStudioOutputBudgetV1 = true;
        return this.write(normalized);
      }
      return normalized;
    }
    if (!this.migrating)
      {this.migrating = (async () => {
        const doc = await migrateConfiguration(
          this.port,
          emptyConfiguration(),
          newProfile,
        );
        return this.write(doc);
      })().catch((error) => {
        // A failed attempt must not poison every later read this page session.
        this.migrating = undefined;
        throw error;
      });}
    return structuredClone(await this.migrating);
  }
  async write(doc) {
    if (doc.version !== 2 || !doc.profiles || !doc.routes)
      {throw new Error("Invalid settings document.");}
    const normalized = normalizeConfiguration(doc);
    normalized.revision = Number(doc.revision || 0) + 1;
    await this.port.set(CONFIG_KEY, structuredClone(normalized));
    return normalized;
  }
}

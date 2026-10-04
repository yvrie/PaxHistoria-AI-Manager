import { capabilitiesFor, registry } from "./registry.js";
export async function generate(request, context) {
  const adapter = registry.adapter(context.profile);
  const capabilities =
    context.effectiveCapabilities ||
    capabilitiesFor(context.profile, context.modelMeta);
  try {
    return await adapter.complete(request, context);
  } catch (error) {
    if (
      request.outputContract &&
      [400, 422].includes(error.status) &&
      context.profile.protocol === "gemini-generate-content" &&
      context.googleSchemaMode !== "legacy" &&
      context.googleSchemaMode !== "prompt" &&
      capabilities.jsonSchema
    ) {
      try {
        return await adapter.complete(request, {
          ...context,
          googleSchemaMode: "legacy",
        });
      } catch (legacyError) {
        error = legacyError;
      }
    }
    if (
      !request.outputContract ||
      ![400, 422].includes(error.status) ||
      context.profile.providerId === "lmstudio" ||
      (!capabilities.jsonSchema && !capabilities.jsonMode)
    )
      {throw error;}
    // A rejected request did not generate output. Retry once with prompt-only
    // formatting; the original contract remains mandatory at validation time.
    const profile = {
      ...context.profile,
      capabilities: { ...capabilities, jsonSchema: false, jsonMode: false },
    };
    return adapter.complete(request, {
      ...context,
      profile,
      effectiveCapabilities: { ...capabilities, jsonSchema: false, jsonMode: false },
    });
  }
}

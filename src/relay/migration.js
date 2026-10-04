// Compatibility inputs are intentionally confined to this module.
export async function migrateConfiguration(port, doc, makeProfile) {
  const old = await port.get("pax-ai-relay.settings.v1");
  if (!old) {return doc;}
  const active = old.active || old;
  const records = { ...old.profiles, [active.provider]: active };
  const ids = {};
  for (const [provider, record] of Object.entries(records)) {
    if (!record || !provider || provider === "undefined") {continue;}
    const p = makeProfile(provider === "generic" ? "custom" : provider);
    p.endpoint = record.baseUrl || p.endpoint;
    p.defaultModel = record.model || "";
    if (provider === "ollama") {p.protocol = "openai-chat";}
    p.credentials.secret = record.apiKey || "";
    p.credentials.boundEndpoint = p.endpoint;
    p.options = {
      ...p.options,
      temperature: record.temperature ?? 0.7,
      maxOutputTokens:
        record.maxTokens || (p.providerId === "lmstudio" ? 4096 : 16384),
    };
    doc.profiles[p.id] = p;
    ids[provider] = p.id;
  }
  doc.activeProfileId = ids[active.provider] || "";
  doc.behavior.fallback = active.fallbackToPax ? "pax" : "error";
  const routing = old.routing || active.routing;
  if (routing?.enabled)
    {for (const [kind, previous] of [
      ["conversation", "conversation"],
      ["advisor", "advisor"],
      ["lightweight", "emotes"],
    ])
      {doc.routes[kind] = {
        profileId: ids[routing[previous]] || doc.activeProfileId,
        model: routing.models?.[previous] || "",
        fallbackModels: [],
      };}}
  return doc;
}

import { registry } from "./registry.js";
import { ChatProtocol, GeminiProtocol } from "./protocols.js";
import { RelayFailure } from "./diagnostics.js";

// Cloud identities are supplied explicitly. The userscript never obtains cloud
// credentials from the page, environment variables, or another provider profile.
function bearer(profile) {
  if (profile.credentials.mode !== "bearer")
    {throw new RelayFailure(
      "configuration",
      "This cloud connection requires a bearer token.",
    );}
  return profile;
}
class AzureProtocol extends ChatProtocol {
  complete(request, ctx) {
    if (!/\/openai\/v1\/?$/.test(ctx.profile.endpoint))
      {throw new RelayFailure(
        "configuration",
        "Use your Azure resource URL ending in /openai/v1. Enter the deployment name as the model.",
      );}
    if (!["header", "bearer"].includes(ctx.profile.credentials.mode))
      {throw new RelayFailure(
        "configuration",
        "Azure requires an api-key header or an Entra bearer token.",
      );}
    return super.complete(request, ctx);
  }
}
class VertexProtocol extends GeminiProtocol {
  complete(request, ctx) {
    const profile = bearer(ctx.profile);
    if (
      !/\/projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/?$/.test(
        profile.endpoint,
      )
    )
      {throw new RelayFailure(
        "configuration",
        "Use the Vertex URL through /v1/projects/PROJECT/locations/REGION/publishers/google. Supply a current OAuth access token.",
      );}
    return super.complete(request, { ...ctx, profile });
  }
}
class BedrockProtocol {
  async complete(request, ctx) {
    const profile = bearer(ctx.profile);
    const messages = request.messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    }));
    if (request.outputContract)
      {messages.push({
        role: "user",
        content: [
          {
            text: `Return only JSON matching this schema: ${JSON.stringify(request.outputContract)}`,
          },
        ],
      });}
    const data = await ctx.http.request(
      profile,
      profile.completionPath ||
        `model/${encodeURIComponent(ctx.model)}/converse`,
      {
        messages,
        inferenceConfig: {
          maxTokens: profile.options.maxOutputTokens,
          ...(profile.capabilities.temperature && {
            temperature: profile.options.temperature,
          }),
        },
      },
      ctx,
    );
    if (data.stopReason === "max_tokens")
      {throw new RelayFailure(
        "invalid-response",
        "Bedrock reached the output limit before finishing.",
      );}
    return (data.output?.message?.content || [])
      .map((x) => x.text || "")
      .join("");
  }
  async listModels() {
    throw new RelayFailure(
      "configuration",
      "Enter the Bedrock model or inference profile ID manually.",
    );
  }
}
registry
  .protocol("azure", new AzureProtocol())
  .protocol("vertex", new VertexProtocol())
  .protocol("bedrock", new BedrockProtocol());

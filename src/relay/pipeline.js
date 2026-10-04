import { generate } from "./generation.js";
import {
  normalizeContract,
  decodeOutput,
  validateOutput,
} from "./contracts.js";
import { RelayFailure } from "./diagnostics.js";
import { capabilitiesFor, randomId } from "./registry.js";
export function classifyPaxRequest(data) {
  const descriptor = String(
    data.requestType || data.promptStage || data.type || "",
  ).toLowerCase();
  if (/emot|emoji|mood/.test(descriptor)) {return "lightweight";}
  if (/advis|action|decision|order/.test(descriptor)) {return "advisor";}
  return "conversation";
}

function requestDigest(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function coordinationKey(body, doc, request, primary) {
  return JSON.stringify([
    "v2",
    requestDigest(body),
    request.kind,
    primary.profile.id,
    primary.model,
    primary.fallbackModels,
    doc.revision || 0,
  ]);
}

function needsOutputRecovery(error) {
  return (
    error?.category === "decoding" ||
    error?.category === "validation" ||
    (error?.category === "invalid-response" &&
      /incomplete|output limit|exhausted/i.test(error.message || ""))
  );
}

function recoveryProfile(profile) {
  const current =
    Number(profile.options?.maxOutputTokens) ||
    (profile.providerId === "lmstudio" ? 4096 : 16384);
  const maxOutputTokens = profile.providerId === "lmstudio"
    ? Math.min(8192, Math.max(4096, current * 2))
    : Math.min(65536, Math.max(32768, current * 2));
  return {
    ...profile,
    options: {
      ...profile.options,
      maxOutputTokens,
    },
  };
}

function conciseRequest(request) {
  const instruction = request.outputContract
    ? "The previous answer did not satisfy the contract. Return exactly one complete JSON value. Include every required field, use the declared types literally, keep text fields concise, and do not add optional entries."
    : "The previous answer reached its output limit. Give a concise, complete answer and finish all sentences. Do not repeat the prompt or add an introduction.";
  return {
    ...request,
    messages: [
      ...request.messages,
      {
        role: "user",
        content: instruction,
      },
    ],
  };
}

async function completeValue(request, context) {
  const output = await generate(request, context);
  if (output === undefined || output === null || output === "")
    {throw new RelayFailure(
      "invalid-response",
      "The model returned an empty answer.",
    );}
  return request.outputContract
    ? validateOutput(decodeOutput(output), request.outputContract)
    : { message: String(output) };
}

export function decodePax(body) {
  if (typeof body !== "string" || body.length > 2 * 1024 * 1024)
    {throw new RelayFailure(
      "configuration",
      "The game request is too large or unreadable.",
    );}
  const data = JSON.parse(body);
  if (!data || typeof data.prompt !== "string")
    {throw new RelayFailure(
      "configuration",
      "The game request has no text prompt.",
    );}
  const kind = classifyPaxRequest(data);
  return {
    kind,
    messages: [{ role: "user", content: data.prompt }],
    outputContract: normalizeContract(data.jsonSchema),
    generationOptions: {},
    metadata: {
      requestId: randomId(),
      paxPromptChars: data.prompt.length,
    },
  };
}
export class RequestCoordinator {
  constructor() {
    this.jobs = new Map();
  }

  async run(key, operation) {
    let job = this.jobs.get(key);
    if (!job) {
      job = Promise.resolve().then(operation);
      this.jobs.set(key, job);
      job
        .finally(() => {
          if (this.jobs.get(key) === job) {this.jobs.delete(key);}
        })
        .catch(() => {});
    }
    return job;
  }
}
export class RouteResolver {
  resolve(doc, kind) {
    const route = doc.routes[kind] || {};
    const profile = doc.profiles[route.profileId || doc.activeProfileId];
    if (!profile)
      {throw new RelayFailure(
        "configuration",
        "Open AI settings and add a profile.",
      );}
    const model = route.model || profile.defaultModel;
    if (!model)
      {throw new RelayFailure(
        "configuration",
        `Choose a primary model for ${kind} before sending a request.`,
      );}
    return {
      profile,
      model,
      fallbackModels: [
        ...new Set(
          (Array.isArray(route.fallbackModels) ? route.fallbackModels : [])
            .map((value) => String(value).trim())
            .filter((value) => value && value !== model),
        ),
      ],
    };
  }
}
export class FallbackPolicy {
  candidates(doc, primary) {
    const candidates = [
      { profile: primary.profile, model: primary.model },
      ...primary.fallbackModels.map((model) => ({
        profile: primary.profile,
        model,
      })),
    ];
    if (doc.behavior.fallback === "profiles")
      {for (const id of doc.behavior.fallbackProfiles || []) {
        const profile = doc.profiles[id];
        if (profile?.defaultModel)
          {candidates.push({ profile, model: profile.defaultModel });}
      }}
    const seen = new Set();
    return candidates.filter(({ profile, model }) => {
      const key = `${profile.id}:${model}`;
      if (!model || seen.has(key)) {return false;}
      seen.add(key);
      return true;
    });
  }
  finish(doc, error) {
    if (doc.behavior.fallback === "pax" && error.category !== "cancelled")
      {return { fallback: true };}
    throw error;
  }
}
export class RequestPipeline {
  constructor(store, http, catalog, diagnostics) {
    this.coordinator = new RequestCoordinator();
    this.routes = new RouteResolver();
    this.fallback = new FallbackPolicy();
    Object.assign(this, { store, http, catalog, diagnostics });
  }
  async process(body) {
    const doc = await this.store.read();
    try {
      return await this.handle(doc, body);
    } catch (error) {
      // Setup problems (no connection yet, no model, unreadable request) also
      // honour "Use Pax AI", so a fresh install never breaks the game's own AI.
      return this.fallback.finish(doc, error);
    }
  }
  async handle(doc, body) {
    const request = decodePax(body);
    this.diagnostics.enabled = doc.behavior.debug;
    const primary = this.routes.resolve(doc, request.kind);
    // Include the resolved configuration so edits never join an old generation job.
    return this.coordinator.run(
      coordinationKey(body, doc, request, primary),
      async () => {
        let failure;
        let failedChoices = 0;
        for (const route of this.fallback.candidates(doc, primary)) {
          const model = route.model;
          try {
            this.diagnostics.emit("routing", {
              requestId: request.metadata.requestId,
            });
            this.diagnostics.emit("provider", {
              requestId: request.metadata.requestId,
            });
            const context = {
              ...route,
              model,
              modelMeta: this.catalog?.peek?.(route.profile, model),
              effectiveCapabilities: capabilitiesFor(
                route.profile,
                this.catalog?.peek?.(route.profile, model),
              ),
              http: this.http,
              requestId: request.metadata.requestId,
            };
            let value;
            try {
              value = await completeValue(request, context);
            } catch (firstError) {
              if (!needsOutputRecovery(firstError)) {throw firstError;}
              this.diagnostics.emit("fallback", {
                requestId: request.metadata.requestId,
                status: 502,
              });
              value = await completeValue(conciseRequest(request), {
                ...context,
                profile: recoveryProfile(route.profile),
              });
            }
            this.diagnostics.emit("schema", {
              requestId: request.metadata.requestId,
            });
            this.diagnostics.emit("validation", {
              requestId: request.metadata.requestId,
              status: 200,
            });
            return { body: JSON.stringify(value), status: 200 };
          } catch (error) {
            failedChoices += 1;
            if (!failure) {
              const advisorAssignment = doc.routes?.advisor || {};
              const assignedElsewhere =
                request.kind === "advisor" &&
                advisorAssignment.profileId &&
                advisorAssignment.profileId !== doc.activeProfileId;
              const differentAdvisorModel =
                request.kind === "advisor" &&
                advisorAssignment.model &&
                advisorAssignment.model !== route.profile.defaultModel;
              const assignmentHint =
                assignedElsewhere && error.category === "authentication"
                  ? " Advisor/actions is still assigned to this connection. Open AI settings, then Assign, to change it."
                  : differentAdvisorModel && error.category === "authentication"
                    ? " Advisor/actions still uses a separate model. Open AI settings, then Assign, to change it."
                  : "";
              failure = new RelayFailure(
                error.category || "configuration",
                `${route.profile.label} / ${model}: ${error.message}${assignmentHint}`,
                error.status,
              );
            }
            this.diagnostics.emit("fallback", {
              status: error.status,
              requestId: request.metadata.requestId,
            });
          }
        }
        if (failure && failedChoices > 1) {
          failure = new RelayFailure(
            failure.category,
            `${failure.message} ${failedChoices - 1} approved backup choice(s) also failed.`,
            failure.status,
          );
        }
        return this.fallback.finish(
          doc,
          failure ||
            new RelayFailure("configuration", "No approved model is configured."),
        );
      },
    );
  }
}

// Section 3: everything most people never need, collapsed by default.
import { registry } from "../registry.js";
import { h, field, checkbox, text } from "./dom.js";
import { ensureProfileShape, profileLabel, providerFor, setEndpoint } from "./state.js";
import { AUTH_OPTIONS, errorsFor } from "./validate.js";

const PROTOCOL_LABELS = Object.freeze({
  "openai-chat": "OpenAI-compatible chat",
  "openai-responses": "OpenAI Responses",
  "openrouter-chat": "OpenRouter",
  "gemini-generate-content": "Google Gemini",
  "anthropic-messages": "Anthropic Messages",
  "ollama-native": "Ollama",
  "lmstudio-chat": "LM Studio",
  azure: "Azure AI",
  bedrock: "Amazon Bedrock",
  vertex: "Google Vertex AI",
  replicate: "Replicate",
  cohere: "Cohere",
  "custom-native": "Custom native API",
});
const CAPABILITY_FIELDS = Object.freeze([
  ["modelDiscovery", "Can list its models", "Turn off if the provider has no model list."],
  ["jsonSchema", "Supports strict JSON answers", "Needed for Advisor/actions on some providers."],
  ["jsonMode", "Supports JSON mode", "A looser JSON format some providers offer."],
  ["temperature", "Accepts a temperature setting", ""],
  ["maxOutputTokens", "Accepts an output length limit", ""],
]);
const FALLBACK_CHOICES = Object.freeze([
  ["error", "Show an error in the game"],
  ["profiles", "Try my other connections"],
  ["pax", "Use Pax Historia's own AI (may use game credits)"],
]);

function protocolLabel(id) {
  return PROTOCOL_LABELS[id] || id;
}

function numberInput(value, { step = "any", min } = {}) {
  return h("input", { type: "number", value: value ?? "", step, min: min ?? null, inputmode: "decimal" });
}

function connectionFields(ctx, profile, stack) {
  const { doc, errors } = ctx;
  ensureProfileShape(profile);
  const provider = providerFor(profile);
  const endpointShownAbove = ctx.endpointShownAbove(profile);

  const name = h("input", { type: "text", value: profile.label || "" });
  name.addEventListener("input", () => {
    profile.label = name.value;
    ctx.touch();
  });
  stack.append(field({ label: "Connection name", control: name }));

  const protocol = h(
    "select",
    {},
    [...new Set([...registry.protocols.keys(), profile.protocol])].map((id) =>
      h("option", { value: id, selected: id === profile.protocol }, protocolLabel(id)),
    ),
  );
  protocol.addEventListener("change", () => {
    profile.protocol = protocol.value;
    ctx.resetDiscovery();
    ctx.touch();
  });
  stack.append(field({ label: "Connection type", control: protocol, hint: "Match what the provider's API uses. Presets set this for you.", error: errorsFor(errors, "protocol", profile.id)[0]?.message }));

  if (!endpointShownAbove) {
    const endpoint = h("input", { type: "url", value: profile.endpoint || "", spellcheck: "false" });
    endpoint.addEventListener("input", () => {
      const hadKey = Boolean(text(profile.credentials.secret).trim());
      const cleared = setEndpoint(profile, doc, endpoint.value.trim());
      ctx.resetDiscovery();
      if (cleared && hadKey) {
        ctx.state.notice = "The address changed, so the saved key was cleared. Paste it again.";
        ctx.redraw("connection", "features", "advanced");
      } else {
        ctx.touch();
      }
    });
    stack.append(field({ label: "API address", control: endpoint, hint: "Changing this clears the saved key so it can't be sent to the wrong place.", error: text(profile.endpoint).trim() ? errorsFor(errors, "endpoint", profile.id)[0]?.message : "" }));
  }

  const mode = h(
    "select",
    {},
    AUTH_OPTIONS.map(([id, label]) => h("option", { value: id, selected: id === profile.credentials.mode }, label)),
  );
  const authName = h("input", { type: "text", value: profile.credentials.name || "", spellcheck: "false" });
  const authNameField = field({ label: "Header or parameter name", control: authName, error: errorsFor(errors, "auth", profile.id)[0]?.message });
  authNameField.hidden = !["header", "query"].includes(profile.credentials.mode);
  mode.addEventListener("change", () => {
    profile.credentials.mode = mode.value;
    authNameField.hidden = !["header", "query"].includes(mode.value);
    ctx.resetDiscovery();
    ctx.redraw("connection");
  });
  authName.addEventListener("input", () => {
    profile.credentials.name = authName.value;
    ctx.resetDiscovery();
    ctx.touch();
  });
  stack.append(field({ label: "How the key is sent", control: mode, hint: "Leave this alone unless your provider says otherwise." }), authNameField);

  const completion = h("input", { type: "text", value: profile.completionPath || "", spellcheck: "false" });
  completion.addEventListener("input", () => {
    profile.completionPath = completion.value;
    ctx.resetDiscovery();
  });
  const modelPath = h("input", { type: "text", value: profile.modelPath || "", spellcheck: "false" });
  modelPath.addEventListener("input", () => {
    profile.modelPath = modelPath.value;
    ctx.resetDiscovery();
  });
  stack.append(
    h(
      "div",
      { class: "grid-2" },
      field({ label: "Chat path", control: completion, hint: "Added to the address. Usually blank." }),
      field({ label: "Model list path", control: modelPath, hint: "Added to the address. Usually blank." }),
    ),
  );

  const headers = h("textarea", { spellcheck: "false" });
  headers.value = JSON.stringify(profile.headers, null, 2);
  const headersError = h("p", { class: "field-error", role: "alert", hidden: true }, "Custom headers must be a JSON object.");
  headers.addEventListener("input", () => {
    try {
      const parsed = JSON.parse(headers.value || "{}");
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {throw new Error("not an object");}
      profile.headers = parsed;
      headersError.hidden = true;
      headers.removeAttribute("aria-invalid");
      ctx.resetDiscovery();
      ctx.touch();
    } catch {
      headersError.hidden = false;
      headers.setAttribute("aria-invalid", "true");
    }
  });
  const headersField = field({ label: "Extra headers (JSON)", control: headers, hint: 'Example: {"X-Project": "abc"}. Authorization headers are set above.', error: errorsFor(errors, "headers", profile.id)[0]?.message });
  headersField.append(headersError);
  stack.append(headersField);

  stack.append(
    h(
      "div",
      { class: "stack" },
      CAPABILITY_FIELDS.map(([key, label, hint]) =>
        checkbox({
          label,
          hint,
          checked: profile.capabilities[key] ?? provider?.capabilities?.[key] ?? false,
          onChange: (value) => {
            profile.capabilities[key] = value;
            ctx.resetDiscovery();
            ctx.redraw("features");
          },
        }),
      ),
    ),
  );

  const temperature = numberInput(profile.options.temperature, { step: "0.1", min: 0 });
  temperature.addEventListener("input", () => {
    profile.options.temperature = temperature.value === "" ? profile.options.temperature : Number(temperature.value);
  });
  const maxTokens = numberInput(profile.options.maxOutputTokens, { step: "1", min: 1 });
  maxTokens.addEventListener("input", () => {
    profile.options.maxOutputTokens = maxTokens.value === "" ? NaN : Number(maxTokens.value);
    ctx.touch();
  });
  const timeout = numberInput(Math.round((profile.options.timeoutMs || 120000) / 1000), { step: "1", min: 1 });
  timeout.addEventListener("input", () => {
    const seconds = Number(timeout.value);
    if (Number.isFinite(seconds) && seconds > 0) {profile.options.timeoutMs = Math.round(seconds * 1000);}
  });
  const current = profile.options.tokenParameter || "max_tokens";
  const tokenParameter = h(
    "select",
    {},
    [...new Set(["max_tokens", "max_completion_tokens", current])].map((id) => h("option", { value: id, selected: id === current }, id)),
  );
  tokenParameter.addEventListener("change", () => {
    profile.options.tokenParameter = tokenParameter.value;
  });
  stack.append(
    h(
      "div",
      { class: "grid-2" },
      field({ label: "Temperature", control: temperature, hint: "Higher is more creative." }),
      field({ label: "Output length limit (tokens)", control: maxTokens, error: errorsFor(errors, "tokens", profile.id)[0]?.message }),
      field({ label: "Time limit per try (seconds)", control: timeout }),
      field({ label: "Length setting name", control: tokenParameter, hint: "Only change if the provider rejects requests." }),
    ),
  );
}

function behaviorFields(ctx, stack) {
  const { doc, state, diagnostics } = ctx;
  const profiles = Object.values(doc.profiles);
  const others = profiles.filter((p) => p.id !== doc.activeProfileId);
  const choices = FALLBACK_CHOICES.filter(([id]) => id !== "profiles" || others.length > 0 || doc.behavior.fallback === "profiles");

  const select = h("select", { "data-fid": "fallback" }, choices.map(([id, label]) => h("option", { value: id, selected: id === doc.behavior.fallback }, label)));
  select.addEventListener("change", () => {
    doc.behavior.fallback = select.value;
    if (select.value !== "profiles") {doc.behavior.fallbackProfiles = [];}
    ctx.redraw("advanced");
  });
  stack.append(field({ label: "If your AI can't answer", control: select }));
  if (doc.behavior.fallback === "pax") {
    stack.append(h("p", { class: "notice warn" }, "Failed requests go to Pax Historia's own AI and may use your game account's credits."));
  }
  if (doc.behavior.fallback === "profiles") {
    stack.append(
      h(
        "div",
        { class: "stack" },
        h("p", { class: "hint" }, "Connections to try, in order, each with its main model:"),
        others.map((p) =>
          checkbox({
            label: profileLabel(p),
            checked: doc.behavior.fallbackProfiles.includes(p.id),
            onChange: (on) => {
              const set = new Set(doc.behavior.fallbackProfiles);
              if (on) {set.add(p.id);} else {set.delete(p.id);}
              doc.behavior.fallbackProfiles = [...set];
              ctx.touch();
            },
          }),
        ),
      ),
    );
  }

  stack.append(
    checkbox({
      label: "Record debug events",
      hint: "Keeps a short log of request timing and status in this tab. It never records keys or messages.",
      checked: doc.behavior.debug,
      onChange: (value) => {
        doc.behavior.debug = value;
        ctx.touch();
      },
    }),
  );
  const output = h("pre", { class: "events", hidden: true, tabindex: "0", "aria-label": "Recent debug events" });
  const show = h("button", { type: "button", class: "small", onclick: () => {
    const events = diagnostics.events;
    output.hidden = false;
    output.textContent = events.length
      ? events.slice(-80).map((x) => `${x.time} ${x.category} ${x.status || ""} ${x.attempt ? `attempt ${x.attempt}` : ""}`.trim()).join("\n")
      : "No events yet.";
    state.eventsShown = true;
  } }, "Show recent events");
  stack.append(h("div", { class: "row" }, show), output);
}

export function renderAdvanced(container, ctx) {
  const profile = ctx.profile();
  if (ctx.state.picking && !profile) {return;}
  const details = h("details", { open: ctx.state.advancedOpen });
  details.addEventListener("toggle", () => {
    ctx.state.advancedOpen = details.open;
  });
  details.append(h("summary", {}, "Advanced settings"));
  const stack = h("div", { class: "stack" });
  if (profile && !ctx.state.picking) {connectionFields(ctx, profile, stack);}
  behaviorFields(ctx, stack);
  details.append(stack);
  container.append(h("div", { class: "card" }, details));
}

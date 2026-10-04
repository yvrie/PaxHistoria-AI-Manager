// Section 1: pick a provider, paste a key, test it and load models.
import { FEATURED_PROVIDERS, registry } from "../registry.js";
import { h, field, text } from "./dom.js";
import { detectProviderFromKey } from "./detect-key.js";
import { effectiveCapabilitiesFor } from "./models.js";
import { addProfile, profileLabel, providerFor, removeProfile, selectProfile, setEndpoint, setSecret } from "./state.js";
import { errorsFor } from "./validate.js";

const GROUP_BLURB = Object.freeze({
  "Hosted APIs": "Hosted service",
  Local: "Runs on your computer",
  "Cloud / native setup": "Needs extra setup",
  Advanced: "Any compatible API",
});
const GROUP_ORDER = Object.freeze(["Hosted APIs", "Local", "Cloud / native setup", "Advanced"]);
const QUICK_LOCAL = Object.freeze(["ollama", "lmstudio"]);
const ENDPOINT_REQUIRED_GROUPS = new Set(["Cloud / native setup", "Advanced"]);
const KEY_HELP =
  "Create a key in your provider's API or developer settings. Your account password won't work here. The key stays in your userscript manager on this browser and goes only to the provider you chose.";

/** Providers with no preset address need it entered up front, above the key. */
export function endpointShownInCard(profile) {
  return ENDPOINT_REQUIRED_GROUPS.has(providerFor(profile)?.group) || !text(profile.endpoint).trim();
}

function providerSupported(provider) {
  return registry.protocols.has(provider.protocol);
}

function providerButton(provider, ctx) {
  const supported = providerSupported(provider);
  const button = h(
    "button",
    {
      type: "button",
      class: "provider",
      disabled: !supported,
      "data-provider": provider.id,
      "data-label": provider.label.toLowerCase(),
    },
    h("strong", {}, provider.label),
    h("span", {}, supported ? provider.description || GROUP_BLURB[provider.group] || "" : "Not supported yet"),
  );
  button.addEventListener("click", () => ctx.chooseProvider(provider.id));
  return button;
}

function renderPicker(container, ctx) {
  const { doc } = ctx;
  const providers = [...registry.providers.values()];
  const popular = FEATURED_PROVIDERS.map((id) => registry.providers.get(id)).filter(Boolean);
  const local = QUICK_LOCAL.map((id) => registry.providers.get(id)).filter(Boolean);
  const shown = new Set([...popular, ...local].map((p) => p.id));
  const hasProfiles = Object.keys(doc.profiles).length > 0;

  container.append(
    h(
      "div",
      { class: "card-head" },
      h("h3", {}, "Choose a provider"),
      hasProfiles
        ? h("button", { type: "button", class: "ghost small", "data-fid": "picker-cancel", onclick: () => ctx.cancelPicker() }, "Cancel")
        : null,
    ),
    h("p", { class: "lede" }, "You need an account and an API key with the provider, or a local AI app running on this computer."),
  );

  const detectHint = h("p", { class: "hint", role: "status" }, "");
  const detectInput = h("input", {
    type: "password",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "Paste a key and we'll find the provider",
    "data-fid": "detect",
  });
  detectInput.addEventListener("input", () => {
    const value = detectInput.value.trim();
    const providerId = detectProviderFromKey(value);
    if (providerId && registry.providers.has(providerId)) {
      ctx.chooseProvider(providerId, { secret: value });
    } else {
      detectHint.textContent = value.length > 12
        ? "Couldn't match this key to a provider. Pick one below and paste it again."
        : "";
    }
  });
  container.append(field({ label: "Already have a key?", control: detectInput }), detectHint);

  container.append(h("p", { class: "group-label" }, "Popular"));
  container.append(h("div", { class: "provider-grid" }, popular.map((p) => providerButton(p, ctx))));
  container.append(h("p", { class: "group-label" }, "On your computer"));
  container.append(h("div", { class: "provider-grid" }, local.map((p) => providerButton(p, ctx))));

  const search = h("input", { type: "search", placeholder: "Search providers", "aria-label": "Search providers", "data-fid": "provider-search" });
  const more = h("details", {}, h("summary", {}, "More providers"));
  const stack = h("div", { class: "stack" }, search);
  const groups = [];
  for (const group of GROUP_ORDER) {
    const members = providers.filter((p) => p.group === group && !shown.has(p.id));
    if (!members.length) {continue;}
    const label = h("p", { class: "group-label" }, group);
    const grid = h("div", { class: "provider-grid" }, members.map((p) => providerButton(p, ctx)));
    groups.push({ label, grid });
    stack.append(label, grid);
  }
  const empty = h("p", { class: "hint", hidden: true }, "No providers match.");
  stack.append(empty);
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    let any = false;
    for (const { label, grid } of groups) {
      let visible = 0;
      for (const button of grid.children) {
        const match = !query || button.dataset.label.includes(query);
        button.hidden = !match;
        if (match) {visible += 1;}
      }
      label.hidden = grid.hidden = visible === 0;
      any ||= visible > 0;
    }
    empty.hidden = any;
  });
  more.append(stack);
  container.append(more);
}

function connectionChip(stateName) {
  const labels = { ok: "Connected", bad: "Needs attention", busy: "Connecting" };
  const label = labels[stateName] || "Not tested";
  return h("span", { class: `chip ${stateName}`, "data-chip": "" }, label);
}

function statusLine(ctx) {
  const { discovery } = ctx.state;
  const classes = ["conn-status", discovery.state === "ok" ? "ok" : discovery.state === "bad" ? "bad" : discovery.state === "busy" ? "busy" : ""];
  return h("p", { class: classes.filter(Boolean).join(" "), role: "status", "aria-live": "polite", "data-status": "" }, discovery.message || "Not tested yet.");
}

function renderConnectionCard(container, ctx, profile) {
  const { doc, state } = ctx;
  const provider = providerFor(profile);
  const caps = effectiveCapabilitiesFor(profile);
  const canList = caps.modelDiscovery !== false;
  const needsKey = profile.credentials.mode !== "none";
  const profiles = Object.values(doc.profiles);
  const pristine = !text(profile.credentials.secret).trim() && !text(profile.defaultModel).trim();
  const errors = ctx.errors;

  const switcher = profiles.length > 1
    ? h(
        "select",
        { "aria-label": "Switch connection", "data-fid": "switch" },
        profiles.map((p) => h("option", { value: p.id, selected: p.id === profile.id }, profileLabel(p))),
      )
    : null;
  switcher?.addEventListener("change", () => ctx.switchProfile(switcher.value));

  container.append(
    h(
      "div",
      { class: "card-head" },
      h("h3", {}, provider?.label || profileLabel(profile), connectionChip(state.discovery.state)),
      h(
        "div",
        { class: "row" },
        switcher,
        h("button", { type: "button", class: "ghost small", "data-fid": "add-conn", onclick: () => ctx.openPicker() }, pristine ? "Change provider" : "Add another"),
        pristine ? null : h("button", { type: "button", class: "ghost small", "data-fid": "remove-conn", onclick: () => { state.confirmRemove = true; ctx.redraw("connection"); } }, "Remove"),
      ),
    ),
  );

  if (state.confirmRemove) {
    container.append(
      h(
        "div",
        { class: "notice bad", role: "alert" },
        `Remove ${profileLabel(profile)}? Its key and model choices are deleted when you save.`,
        h(
          "div",
          { class: "row" },
          h("button", { type: "button", class: "danger small", "data-fid": "remove-yes", onclick: () => ctx.removeCurrent() }, "Remove connection"),
          h("button", { type: "button", class: "small", "data-fid": "remove-no", onclick: () => { state.confirmRemove = false; ctx.redraw("connection"); } }, "Keep it"),
        ),
      ),
    );
  }
  if (provider && !providerSupported(provider)) {
    container.append(h("p", { class: "notice warn" }, `This version can't use ${provider.label} yet. Pick another provider.`));
  }
  if (state.notice) {container.append(h("p", { class: "notice warn", role: "status" }, state.notice));}

  // Address first for providers that have none, so a typed key is bound to it.
  if (endpointShownInCard(profile)) {
    const endpointInput = h("input", { type: "url", value: profile.endpoint || "", placeholder: "https://api.example.com/v1", "data-fid": "endpoint", spellcheck: "false" });
    endpointInput.addEventListener("input", () => {
      const hadKey = Boolean(text(profile.credentials.secret).trim());
      const cleared = setEndpoint(profile, doc, endpointInput.value.trim());
      ctx.resetDiscovery();
      if (cleared && hadKey) {
        state.notice = "The address changed, so the saved key was cleared. Paste it again.";
        ctx.redraw("connection", "features");
      } else {
        ctx.touch();
      }
    });
    container.append(
      field({
        label: "API address",
        control: endpointInput,
        required: true,
        hint: "The base URL from your provider's API documentation.",
        error: text(profile.endpoint).trim() ? errorsFor(errors, "endpoint", profile.id)[0]?.message : "",
      }),
    );
  }

  if (needsKey) {
    const keyInput = h("input", {
      type: state.showKey ? "text" : "password",
      value: profile.credentials.secret || "",
      placeholder: "Paste your API key",
      autocomplete: "off",
      spellcheck: "false",
      "data-fid": "key",
    });
    keyInput.addEventListener("input", () => {
      setSecret(profile, keyInput.value);
      state.notice = "";
      ctx.resetDiscovery();
      ctx.touch();
    });
    keyInput.addEventListener("change", () => ctx.autoConnect());
    keyInput.addEventListener("paste", () => setTimeout(() => ctx.autoConnect(), 0));
    const toggle = h(
      "button",
      { type: "button", class: "small", "aria-pressed": String(Boolean(state.showKey)), "data-fid": "key-toggle", onclick: () => { state.showKey = !state.showKey; ctx.redraw("connection"); } },
      state.showKey ? "Hide" : "Show",
    );
    container.append(
      field({
        label: "API key",
        control: h("div", { class: "secret" }, keyInput, toggle),
        target: keyInput,
        hint: "Not your account password.",
      }),
    );
    const detected = detectProviderFromKey(profile.credentials.secret);
    if (detected && detected !== profile.providerId && profile.providerId !== "custom" && registry.providers.has(detected)) {
      container.append(
        h(
          "div",
          { class: "notice warn" },
          `This key looks like a ${registry.providers.get(detected).label} key, not a ${provider?.label || "this provider"} key.`,
          h("div", { class: "row" }, h("button", { type: "button", class: "small", "data-fid": "switch-provider", onclick: () => ctx.chooseProvider(detected, { secret: profile.credentials.secret, replace: profile.id }) }, `Use ${registry.providers.get(detected).label}`)),
        ),
      );
    }
  } else {
    container.append(h("p", { class: "hint" }, `${provider?.label || "This provider"} runs on your computer and needs no key. Start it, then connect.`));
  }

  container.append(
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          type: "button",
          class: "primary",
          "data-fid": "connect",
          "aria-busy": state.discovery.state === "busy" ? "true" : null,
          disabled: (provider && !providerSupported(provider)) || (needsKey && !text(profile.credentials.secret).trim()),
          onclick: () => ctx.connect(),
        },
        canList ? "Connect and load models" : "Test connection",
      ),
    ),
    statusLine(ctx),
  );
  if (!canList) {
    container.append(h("p", { class: "hint" }, "This provider has no model list. Type a model name below, then test."));
  }
  container.append(h("details", {}, h("summary", {}, "Where do I get an API key?"), h("p", { class: "hint" }, KEY_HELP)));
}

export function renderConnection(container, ctx) {
  const profile = ctx.profile();
  if (!profile || ctx.state.picking) {renderPicker(container, ctx);}
  else {renderConnectionCard(container, ctx, profile);}
}

/** Actions that mutate the draft for the connection section. */
export function connectionActions(ctx) {
  return {
    chooseProvider(providerId, { secret = "", replace = "" } = {}) {
      const { doc, state } = ctx;
      if (replace) {removeProfile(doc, replace);}
      const profile = addProfile(doc, providerId);
      if (secret) {setSecret(profile, secret);}
      state.picking = false;
      state.notice = "";
      state.confirmRemove = false;
      state.showKey = false;
      ctx.resetDiscovery();
      ctx.redraw("connection", "features", "advanced");
      const target = ctx.root.querySelector(secret ? '[data-fid="connect"]' : '[data-fid="key"], [data-fid="endpoint"], [data-fid="connect"]');
      target?.focus({ preventScroll: false });
      if (secret) {ctx.autoConnect();}
    },
    openPicker() {
      const { doc, state } = ctx;
      const profile = ctx.profile();
      // An untouched connection is replaced rather than left behind.
      if (profile && !text(profile.credentials.secret).trim() && !text(profile.defaultModel).trim()) {
        removeProfile(doc, profile.id);
      }
      state.picking = true;
      state.confirmRemove = false;
      state.notice = "";
      ctx.resetDiscovery();
      ctx.redraw("connection", "features", "advanced");
    },
    cancelPicker() {
      const { doc, state } = ctx;
      state.picking = false;
      if (!ctx.profile()) {
        const [first] = Object.keys(doc.profiles);
        if (first) {selectProfile(doc, first);}
      }
      ctx.resetDiscovery();
      ctx.redraw("connection", "features", "advanced");
    },
    switchProfile(id) {
      selectProfile(ctx.doc, id);
      ctx.state.notice = "";
      ctx.state.confirmRemove = false;
      ctx.resetDiscovery();
      ctx.redraw("connection", "features", "advanced");
    },
    removeCurrent() {
      const profile = ctx.profile();
      if (!profile) {return;}
      removeProfile(ctx.doc, profile.id);
      ctx.state.confirmRemove = false;
      ctx.state.picking = Object.keys(ctx.doc.profiles).length === 0;
      ctx.resetDiscovery();
      ctx.redraw("connection", "features", "advanced");
    },
  };
}

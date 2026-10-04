// The settings dialog: owns one editing session at a time (draft document,
// validation, connection test, save) and lays the three sections out.
import { registry } from "../registry.js";
import { h, rerender, safeErrorMessage, text, uid } from "./dom.js";
import { renderAdvanced } from "./advanced.js";
import { connectionActions, endpointShownInCard, renderConnection } from "./connection.js";
import { renderFeatures } from "./features.js";
import { effectiveCapabilitiesFor, normalizeModelRecords } from "./models.js";
import {
  ROUTE_KINDS,
  ROUTE_LABELS,
  applySuggestions,
  ensureProfileShape,
  ensureRoute,
  isFreshSelection,
  normalizeRoutes,
  profileLabel,
  providerFor,
  repairEndpointBinding,
  routeOwnerId,
} from "./state.js";
import { validateSetup } from "./validate.js";

const idle = () => ({ state: "idle", message: "" });

function newUiState(doc) {
  return {
    picking: Object.keys(doc.profiles).length === 0,
    records: [],
    discovery: idle(),
    token: 0,
    lastKey: "",
    notice: "",
    confirmRemove: false,
    showKey: false,
    featuresOpen: false,
    advancedOpen: false,
    backupMessage: {},
    view: "edit",
    saving: false,
    footer: { tone: "", message: "" },
  };
}

/** Normalise a freshly read document so every view can rely on its shape. */
function prepareDoc(doc) {
  const cleared = [];
  doc.profiles ||= {};
  doc.behavior ||= { fallback: "error", fallbackProfiles: [], debug: false };
  for (const profile of Object.values(doc.profiles)) {
    ensureProfileShape(profile);
    if (repairEndpointBinding(profile, doc)) {cleared.push(profileLabel(profile));}
  }
  if (!doc.profiles[doc.activeProfileId]) {
    doc.activeProfileId = Object.keys(doc.profiles)[0] || "";
  }
  for (const kind of ROUTE_KINDS) {ensureRoute(doc, kind);}
  normalizeRoutes(doc);
  return cleared;
}

export function createDialog({ root, store, catalog, http, diagnostics, onClosed }) {
  const titleId = uid("title");
  const dialog = h("dialog", { "aria-labelledby": titleId });
  const closeButton = h("button", { type: "button", class: "ghost icon-btn", "aria-label": "Close", title: "Close" }, "✕");
  const main = h("div", { class: "dlg-main" });
  const message = h("section", { class: "card", hidden: true });
  const sections = {
    connection: h("section", { class: "card", "aria-label": "Connection" }),
    features: h("section", { class: "card", "aria-label": "Model" }),
    advanced: h("div"),
  };
  const done = h("section", { class: "card", hidden: true, "aria-live": "polite" });
  main.append(message, sections.connection, sections.features, sections.advanced, done);

  const status = h("p", { class: "foot-status", role: "status", "aria-live": "polite" });
  const todo = h("ul", { class: "todo", "aria-label": "Still needed before saving" });
  const cancelButton = h("button", { type: "button", class: "ghost" }, "Cancel");
  const saveButton = h("button", { type: "button", class: "primary" }, "Save");
  const doneButton = h("button", { type: "button", class: "primary", hidden: true }, "Done");
  const editAgain = h("button", { type: "button", hidden: true }, "Edit settings");
  const discardText = h("span", { class: "foot-status bad" }, "Discard your unsaved changes?");
  const keepButton = h("button", { type: "button" }, "Keep editing");
  const discardButton = h("button", { type: "button", class: "danger" }, "Discard");
  const discardBar = h("div", { class: "foot-row", hidden: true, role: "alert" }, discardText, h("div", { class: "foot-actions" }, keepButton, discardButton));
  const actions = h("div", { class: "foot-actions" }, cancelButton, editAgain, saveButton, doneButton);
  const footer = h("div", { class: "dlg-foot" }, todo, h("div", { class: "foot-row" }, status, actions), discardBar);
  const header = h(
    "div",
    { class: "dlg-head" },
    h("div", {}, h("h2", { id: titleId }, "PaxHistoria AI Manager"), h("p", {}, "Pick the AI your game uses")),
    closeButton,
  );
  dialog.append(header, main, footer);

  let sessionId = 0;
  let open = false;
  let ctx = null;
  let returnFocus = null;
  let initial = "";

  const dirty = () => Boolean(ctx) && ctx.state.view === "edit" && JSON.stringify(ctx.doc) !== initial;

  function showMessage(title, detail, retry) {
    for (const el of [sections.connection, sections.features, sections.advanced, done]) {el.hidden = true;}
    message.hidden = false;
    message.replaceChildren(
      h("h3", {}, title),
      h("p", { class: "lede" }, detail),
      retry ? h("div", { class: "row" }, h("button", { type: "button", class: "primary", onclick: retry }, "Try again")) : null,
    );
    todo.replaceChildren();
    saveButton.hidden = true;
    editAgain.hidden = true;
    cancelButton.hidden = true;
    doneButton.hidden = true;
    status.textContent = "";
  }

  function updateFooter() {
    if (!ctx) {return;}
    const { state } = ctx;
    const editing = state.view === "edit";
    cancelButton.hidden = !editing;
    saveButton.hidden = !editing;
    editAgain.hidden = editing;
    doneButton.hidden = editing;
    todo.hidden = !editing;
    if (editing) {
      const errors = ctx.errors;
      const shown = errors.slice(0, 3).map((e) => h("li", {}, e.message));
      if (errors.length > 3) {shown.push(h("li", {}, `+${errors.length - 3} more`));}
      todo.replaceChildren(...shown);
      saveButton.disabled = errors.length > 0 || state.saving;
      saveButton.setAttribute("aria-busy", state.saving ? "true" : "false");
    }
    status.className = `foot-status ${state.footer.tone}`.trim();
    status.textContent = state.footer.message;
  }

  function summaryRow(label, value) {
    return h("div", {}, h("dt", {}, label), h("dd", {}, value || "None"));
  }

  function renderDone() {
    const { doc } = ctx;
    const profile = doc.profiles[doc.activeProfileId];
    const rows = ROUTE_KINDS.map((kind) => {
      const route = doc.routes[kind];
      const owner = doc.profiles[routeOwnerId(doc, route)];
      const model = text(route.model).trim() || text(owner?.defaultModel).trim();
      const backups = route.fallbackModels.length;
      return summaryRow(ROUTE_LABELS[kind], `${model}${backups ? ` (+${backups} backup${backups === 1 ? "" : "s"})` : ""}`);
    });
    done.replaceChildren(
      h("div", { class: "center" }, h("div", { class: "big-check", "aria-hidden": "true" }, "✓"), h("h3", {}, "Saved")),
      h("p", { class: "lede center" }, "Pax Historia now uses your AI."),
      h("dl", { class: "summary" }, summaryRow("Connection", profile ? profileLabel(profile) : ""), ...rows),
    );
  }

  function applyView() {
    const editing = ctx.state.view === "edit";
    message.hidden = true;
    done.hidden = editing;
    sections.connection.hidden = !editing;
    sections.advanced.hidden = !editing;
    sections.features.hidden = !editing || sections.features.childElementCount === 0;
    if (!editing) {renderDone();}
    updateFooter();
  }

  const renderers = {
    connection: renderConnection,
    features: renderFeatures,
    advanced: renderAdvanced,
  };

  function refreshErrors() {
    ctx.errors = validateSetup(ctx.doc, { records: ctx.state.records, catalog });
  }

  function redraw(...names) {
    if (!ctx) {return;}
    refreshErrors();
    for (const name of names) {
      const container = sections[name];
      rerender(container, () => renderers[name](container, ctx));
    }
    sections.features.hidden = ctx.state.view !== "edit" || sections.features.childElementCount === 0;
    updateFooter();
  }

  function touch() {
    if (!ctx) {return;}
    refreshErrors();
    ctx.state.footer = { tone: "", message: "" };
    updateFooter();
  }

  function setStatusLine() {
    const el = sections.connection.querySelector("[data-status]");
    if (!el) {return;}
    const { discovery } = ctx.state;
    el.className = `conn-status ${discovery.state === "ok" ? "ok" : discovery.state === "bad" ? "bad" : discovery.state === "busy" ? "busy" : ""}`.trim();
    el.textContent = discovery.message || "Not tested yet.";
    const chip = sections.connection.querySelector("[data-chip]");
    if (chip) {
      chip.className = `chip ${discovery.state}`;
      chip.textContent = { ok: "Connected", bad: "Needs attention", busy: "Connecting" }[discovery.state] || "Not tested";
    }
  }

  function resetDiscovery() {
    if (!ctx) {return;}
    ctx.state.token += 1;
    ctx.state.records = [];
    ctx.state.discovery = idle();
    ctx.state.lastKey = "";
    setStatusLine();
  }

  async function connect() {
    const current = ctx;
    const profile = current?.profile();
    if (!profile || current.state.discovery.state === "busy") {return;}
    const session = sessionId;
    const token = ++current.state.token;
    const stale = () => !open || session !== sessionId || current !== ctx || token !== current.state.token || current.profile() !== profile;
    const secrets = [profile.credentials.secret, ...Object.values(profile.headers || {})];
    const canList = effectiveCapabilitiesFor(profile).modelDiscovery !== false;
    current.state.discovery = { state: "busy", message: "Connecting…" };
    current.state.notice = "";
    redraw("connection");
    try {
      if (!canList) {
        if (!text(profile.defaultModel).trim()) {
          throw new Error("This provider can't list its models. Type a model name below, then test again.");
        }
        await registry.adapter(profile).complete(
          { messages: [{ role: "user", content: "Reply OK" }], outputContract: null },
          { profile: { ...profile, options: { ...profile.options, maxOutputTokens: 32 } }, model: profile.defaultModel, http },
        );
        if (stale()) {return;}
        current.state.discovery = { state: "ok", message: "Connected. A small test message worked." };
      } else {
        const records = normalizeModelRecords(await catalog.list(profile, true));
        if (stale()) {return;}
        current.state.records = records;
        let note = "";
        if (records.length && isFreshSelection(current.doc, profile) && applySuggestions(current.doc, profile, records, catalog)) {
          note = " We picked models for you. Change them below.";
          current.state.featuresOpen = ROUTE_KINDS.some((k) => current.doc.routes[k].model);
        }
        current.state.discovery = records.length
          ? { state: "ok", message: `Connected. ${records.length} models available.${note}` }
          : { state: "ok", message: "Connected, but the provider returned no models. Type a model name below." };
      }
      current.state.lastKey = text(profile.credentials.secret);
    } catch (error) {
      if (stale()) {return;}
      current.state.records = [];
      current.state.discovery = { state: "bad", message: safeErrorMessage(error, secrets) };
    }
    redraw("connection", "features", "advanced");
  }

  function autoConnect() {
    const profile = ctx?.profile();
    if (!profile || ctx.state.picking || ctx.state.discovery.state === "busy") {return;}
    const provider = providerFor(profile);
    if (!provider || !registry.protocols.has(profile.protocol)) {return;}
    const secret = text(profile.credentials.secret).trim();
    if (profile.credentials.mode !== "none" && !secret) {return;}
    if (profile.credentials.mode === "none") {return;}
    if (ctx.state.discovery.state === "ok" && ctx.state.lastKey === text(profile.credentials.secret)) {return;}
    connect();
  }

  async function save() {
    if (!ctx || ctx.state.saving) {return;}
    refreshErrors();
    if (ctx.errors.length) {return;}
    const current = ctx;
    const session = sessionId;
    current.state.saving = true;
    current.state.footer = { tone: "", message: "Saving…" };
    updateFooter();
    try {
      normalizeRoutes(current.doc);
      const saved = await store.write(current.doc);
      if (!open || session !== sessionId || current !== ctx) {return;}
      if (saved && saved !== current.doc) {
        for (const key of Object.keys(current.doc)) {delete current.doc[key];}
        Object.assign(current.doc, saved);
      }
      initial = JSON.stringify(current.doc);
      current.state.view = "done";
      current.state.footer = { tone: "", message: "" };
      applyView();
      doneButton.focus();
    } catch (error) {
      if (!open || session !== sessionId || current !== ctx) {return;}
      current.state.footer = { tone: "bad", message: `Couldn't save: ${safeErrorMessage(error)}` };
    } finally {
      current.state.saving = false;
      if (ctx === current) {updateFooter();}
    }
  }

  function requestClose() {
    if (!dialog.open) {return;}
    if (dirty()) {
      discardBar.hidden = false;
      keepButton.focus();
      return;
    }
    dialog.close();
  }

  async function begin() {
    returnFocus = root.activeElement || document.activeElement;
    const session = ++sessionId;
    open = true;
    ctx = null;
    discardBar.hidden = true;
    showMessage("Loading your settings", "One moment.");
    if (!dialog.open) {dialog.showModal();}
    closeButton.focus();
    try {
      const doc = await store.read();
      if (!open || session !== sessionId) {return;}
      const cleared = prepareDoc(doc);
      const state = newUiState(doc);
      if (cleared.length) {
        state.notice = `The address for ${cleared.join(", ")} changed, so its saved key was cleared. Paste it again.`;
      }
      ctx = {
        root,
        doc,
        state,
        catalog,
        http,
        diagnostics,
        errors: [],
        profile: () => doc.profiles[doc.activeProfileId] || null,
        touch,
        redraw,
        resetDiscovery,
        connect,
        autoConnect,
        endpointShownAbove: endpointShownInCard,
      };
      Object.assign(ctx, connectionActions(ctx));
      initial = JSON.stringify(doc);
      applyView();
      redraw("connection", "features", "advanced");
      main.scrollTop = 0;
      const first = sections.connection.querySelector("[data-fid]");
      first?.focus({ preventScroll: true });
    } catch (error) {
      if (!open || session !== sessionId) {return;}
      showMessage(
        "Couldn't open your settings",
        "Reload Pax Historia and try again. Nothing was changed.",
        begin,
      );
    }
  }

  closeButton.addEventListener("click", requestClose);
  cancelButton.addEventListener("click", requestClose);
  keepButton.addEventListener("click", () => {
    discardBar.hidden = true;
  });
  discardButton.addEventListener("click", () => dialog.close());
  saveButton.addEventListener("click", save);
  doneButton.addEventListener("click", () => dialog.close());
  editAgain.addEventListener("click", () => {
    ctx.state.view = "edit";
    applyView();
    redraw("connection", "features", "advanced");
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("close", () => {
    open = false;
    sessionId += 1;
    ctx = null;
    discardBar.hidden = true;
    onClosed?.(returnFocus);
    returnFocus = null;
  });

  return { element: dialog, open: begin, close: () => dialog.open && dialog.close() };
}

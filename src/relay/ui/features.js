// Section 2: choose the model for the game. One main model covers everything;
// per-feature overrides and backups live in an optional disclosure.
import { modelHintsFor } from "../registry.js";
import { h, field, text, uid } from "./dom.js";
import { advisorModelStatus, modelBadges, modelRecordFor } from "./models.js";
import {
  ROUTE_HELP,
  ROUTE_KINDS,
  ROUTE_LABELS,
  addBackup,
  applySuggestions,
  ensureRoute,
  moveBackup,
  profileLabel,
  removeBackup,
  routeOwnerId,
  routesElsewhere,
  setDefaultModel,
  setRouteModel,
  useConnectionForAll,
} from "./state.js";

function badgeList(record) {
  const badges = modelBadges(record);
  if (!badges.length) {return null;}
  return h(
    "ul",
    { class: "badges", "aria-label": "Model details", title: record.description || "" },
    badges.map((b) => h("li", { class: `badge ${b.tone || ""}`.trim() }, b.label)),
  );
}

function noticeFor(status, extra) {
  if (status.available && !status.unknown) {return null;}
  return h("p", { class: `notice ${status.available ? "warn" : "bad"}`, role: "status" }, status.message, extra);
}

function modelInput({ value, placeholder, listId, fid, onInput, onChange, label }) {
  const input = h("input", {
    type: "text",
    value: value || "",
    placeholder,
    autocomplete: "off",
    spellcheck: "false",
    list: listId,
    "data-fid": fid,
    "aria-label": label || null,
  });
  // Selecting the text lets people open the list again without clearing it by hand.
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => onInput(input.value));
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

export function renderFeatures(container, ctx) {
  const profile = ctx.profile();
  if (!profile || ctx.state.picking) {return;}
  const { doc, state, catalog } = ctx;
  const records = state.records;
  const listId = uid("models");
  const mainModel = text(profile.defaultModel).trim();
  const elsewhere = routesElsewhere(doc, profile.id);

  container.append(
    h("div", { class: "card-head" }, h("h3", {}, "Model")),
    h(
      "datalist",
      { id: listId },
      records.map((r) => h("option", { value: r.id }, r.displayName && r.displayName !== r.id ? r.displayName : null)),
    ),
  );

  const mainInput = modelInput({
    value: profile.defaultModel,
    placeholder: records.length ? "Search or type a model name" : "Type a model name",
    listId,
    fid: "main-model",
    onInput: (value) => {
      setDefaultModel(doc, profile, value);
      ctx.touch();
    },
    onChange: () => ctx.redraw("features"),
  });
  container.append(
    field({
      label: "Main model",
      control: mainInput,
      hint: records.length
        ? `${records.length} models available. Start typing to search.`
        : "Connect above to load the list, or type the exact model name.",
    }),
  );
  const mainRecord = modelRecordFor(records, catalog, profile, mainModel);
  const mainBadges = badgeList(mainRecord);
  if (mainBadges) {container.append(mainBadges);}

  if (!records.length) {
    const hints = (modelHintsFor(profile) || []).filter(Boolean);
    if (hints.length && ctx.state.discovery.state === "bad") {
      container.append(
        h("p", { class: "hint" }, "Model names you can try:"),
        h(
          "div",
          { class: "row" },
          hints.map((hint) =>
            h("button", { type: "button", class: "small", onclick: () => { setDefaultModel(doc, profile, hint); ctx.redraw("features"); } }, hint),
          ),
        ),
      );
    }
  } else {
    container.append(
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            type: "button",
            class: "small",
            "data-fid": "suggest",
            onclick: () => {
              if (applySuggestions(doc, profile, records, catalog)) {
                state.featuresOpen = true;
                ctx.redraw("features");
              }
            },
          },
          "Suggest models for me",
        ),
      ),
    );
  }

  if (elsewhere.length) {
    container.append(
      h(
        "div",
        { class: "notice warn" },
        `${elsewhere.map((k) => ROUTE_LABELS[k]).join(", ")} use${elsewhere.length === 1 ? "s" : ""} a different connection.`,
        h(
          "div",
          { class: "row" },
          h(
            "button",
            { type: "button", class: "small", "data-fid": "use-all", onclick: () => { useConnectionForAll(doc, profile); ctx.redraw("features"); } },
            `Use ${profileLabel(profile)} for everything`,
          ),
        ),
      ),
    );
  }

  // The Advisor needs a model that can answer in a strict format, so check it even with the section closed.
  const advisorRoute = ensureRoute(doc, "advisor");
  const advisorOwner = routeOwnerId(doc, advisorRoute) === profile.id;
  const advisorModel = text(advisorRoute.model).trim() || mainModel;
  let advisorProblem = false;
  if (advisorOwner && advisorModel) {
    const status = advisorModelStatus(profile, advisorModel, modelRecordFor(records, catalog, profile, advisorModel));
    advisorProblem = !status.available || status.unknown;
    const notice = noticeFor(
      status,
      h(
        "div",
        { class: "row" },
        h("button", { type: "button", class: "small", onclick: () => { state.featuresOpen = true; ctx.redraw("features"); } }, "Choose another model for actions"),
      ),
    );
    if (notice) {container.append(notice);}
  }

  const hasOverrides = ROUTE_KINDS.some((kind) => {
    const route = ensureRoute(doc, kind);
    return route.model || route.fallbackModels.length > 0;
  });
  const details = h("details", { open: state.featuresOpen || hasOverrides || advisorProblem });
  details.addEventListener("toggle", () => {
    state.featuresOpen = details.open;
  });
  details.append(h("summary", {}, "Per-feature models and backups (optional)"));
  const stack = h("div", { class: "stack" });
  stack.append(h("p", { class: "hint" }, "Leave a feature empty to use the main model. Backups run only if the main model fails, and only the ones you add."));
  for (const kind of ROUTE_KINDS) {stack.append(renderFeatureRow(ctx, profile, kind, listId, mainModel));}
  details.append(stack);
  container.append(details);
}

function renderFeatureRow(ctx, profile, kind, listId, mainModel) {
  const { doc, state, catalog } = ctx;
  const records = state.records;
  const route = ensureRoute(doc, kind);
  const owned = routeOwnerId(doc, route) === profile.id;
  const row = h("div", { class: "feature" });
  row.append(
    h("div", { class: "feature-head" }, h("strong", {}, ROUTE_LABELS[kind]), h("span", { class: "hint" }, ROUTE_HELP[kind])),
  );
  if (!owned) {
    const other = doc.profiles[route.profileId];
    row.append(
      h(
        "p",
        { class: "notice warn" },
        other ? `Uses ${profileLabel(other)}.` : "Uses a connection that no longer exists.",
        h(
          "div",
          { class: "row" },
          h("button", { type: "button", class: "small", onclick: () => { setRouteModel(doc, kind, profile, ""); ctx.redraw("features"); } }, `Use ${profileLabel(profile)} instead`),
        ),
      ),
    );
    return row;
  }

  row.append(
    modelInput({
      value: route.model,
      placeholder: mainModel ? `Same as main model (${mainModel})` : "Same as main model",
      listId,
      fid: `route-${kind}`,
      label: `${ROUTE_LABELS[kind]} model`,
      onInput: (value) => {
        setRouteModel(doc, kind, profile, value);
        ctx.touch();
      },
      onChange: () => ctx.redraw("features"),
    }),
  );
  const effective = text(route.model).trim() || mainModel;
  const badges = badgeList(modelRecordFor(records, catalog, profile, effective));
  if (badges) {row.append(badges);}
  if (kind === "advisor" && effective) {
    const notice = noticeFor(advisorModelStatus(profile, effective, modelRecordFor(records, catalog, profile, effective)));
    if (notice) {row.append(notice);}
  }

  // Backups: shown, reordered and added in the same place.
  row.append(h("p", { class: "hint" }, "Backups"));
  if (route.fallbackModels.length) {
    row.append(
      h(
        "ul",
        { class: "backups" },
        route.fallbackModels.map((model, index) => {
          const status = kind === "advisor" ? advisorModelStatus(profile, model, modelRecordFor(records, catalog, profile, model)) : null;
          return h(
            "li",
            { class: "backup" },
            h("span", {}, model, status && (!status.available || status.unknown) ? h("small", { class: "hint" }, ` ${status.message}`) : null),
            h("button", { type: "button", class: "ghost small", "aria-label": `Move ${model} up`, disabled: index === 0, "data-fid": `bk-up-${kind}-${index}`, onclick: () => { moveBackup(doc, kind, index, -1); ctx.redraw("features"); } }, "↑"),
            h("button", { type: "button", class: "ghost small", "aria-label": `Move ${model} down`, disabled: index === route.fallbackModels.length - 1, "data-fid": `bk-down-${kind}-${index}`, onclick: () => { moveBackup(doc, kind, index, 1); ctx.redraw("features"); } }, "↓"),
            h("button", { type: "button", class: "ghost small", "aria-label": `Remove ${model} from ${ROUTE_LABELS[kind]} backups`, "data-fid": `bk-rm-${kind}-${index}`, onclick: () => { removeBackup(doc, kind, index); ctx.redraw("features"); } }, "✕"),
          );
        }),
      ),
    );
  }
  const addInput = h("input", { type: "text", list: listId, placeholder: "Add a backup model", autocomplete: "off", spellcheck: "false", "aria-label": `Add a backup model for ${ROUTE_LABELS[kind]}`, "data-fid": `bk-add-${kind}` });
  const message = h("p", { class: "field-error", role: "alert", hidden: !state.backupMessage?.[kind] }, state.backupMessage?.[kind] || "");
  const add = () => {
    const result = addBackup(doc, kind, profile, addInput.value, records, catalog);
    state.backupMessage = { ...(state.backupMessage || {}), [kind]: result.ok ? "" : result.message };
    ctx.redraw("features");
  };
  addInput.addEventListener("focus", () => addInput.select());
  addInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  });
  row.append(h("div", { class: "secret" }, addInput, h("button", { type: "button", class: "small", onclick: add }, "Add")), message);
  return row;
}

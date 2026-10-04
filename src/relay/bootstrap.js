import { ConfigStore } from "./config.js";
import { Diagnostics } from "./diagnostics.js";
import { HttpExecutor } from "./transport.js";
import { ModelCatalog } from "./protocols.js";
import { RequestPipeline } from "./pipeline.js";
import { installInterceptor } from "./interception.js";
import { mountPanel } from "./panel.js";
import "./cloud.js";
const page = globalThis.unsafeWindow || window;
if (/^(www\.)?paxhistoria\.co$/.test(page.location.hostname)) {
  const get =
    globalThis.GM_getValue || globalThis.GM?.getValue?.bind(globalThis.GM);
  const set =
    globalThis.GM_setValue || globalThis.GM?.setValue?.bind(globalThis.GM);
  if (!get || !set)
    {throw new Error("AI Manager needs userscript storage permissions.");}
  const store = new ConfigStore({
    get: (key) => get(key),
    set: (key, value) => set(key, value),
  });
  const diagnostics = new Diagnostics(),
    http = new HttpExecutor(diagnostics),
    catalog = new ModelCatalog(http);
  installInterceptor(page, new RequestPipeline(store, http, catalog, diagnostics));
  let panel;
  const startUi = () => {
    if (!panel) {panel = mountPanel(store, catalog, http, diagnostics, document);}
  };
  if (document.readyState === "loading")
    {document.addEventListener("DOMContentLoaded", startUi, { once: true });}
  else {startUi();}
  const menu =
    globalThis.GM_registerMenuCommand ||
    globalThis.GM?.registerMenuCommand?.bind(globalThis.GM);
  menu?.("AI Manager settings", () => {
    startUi();
    return panel.open();
  });
}

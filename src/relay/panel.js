import { createDialog } from "./ui/dialog.js";
import { createLauncher, isFocusable } from "./ui/launcher.js";
import { CSS } from "./ui/styles.js";

/**
 * Mount the AI Manager launcher and settings dialog inside a closed shadow
 * root so the game's styles and scripts can't reach the panel.
 */
export function mountPanel(store, catalog, http, diagnostics, documentRef = document) {
  const host = documentRef.createElement("historia-ai-settings");
  const root = host.attachShadow({ mode: "closed" });
  const style = documentRef.createElement("style");
  style.textContent = CSS;
  const launcher = documentRef.createElement("button");
  launcher.id = "launch";
  launcher.type = "button";
  launcher.title = "Open AI Manager";
  launcher.textContent = "AI";
  launcher.setAttribute("aria-label", "Open AI Manager");

  const dialog = createDialog({
    root,
    store,
    catalog,
    http,
    diagnostics,
    onClosed: (returnFocus) => {
      const target = isFocusable(returnFocus) ? returnFocus : launcher;
      try {
        target.focus();
      } catch {
        if (target !== launcher) {launcher.focus();}
      }
    },
  });
  root.append(style, launcher, dialog.element);
  const placement = createLauncher(documentRef, host, launcher);
  launcher.addEventListener("click", dialog.open);

  return {
    host,
    open: dialog.open,
    navigationObserver: placement.observer,
    destroy() {
      dialog.close();
      placement.destroy();
    },
  };
}

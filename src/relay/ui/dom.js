// Tiny DOM helpers shared by every view. Everything is built with textContent
// and attributes, never innerHTML, so provider-supplied strings stay inert.

export function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Create an element. `props` may hold attributes (`class`, `aria-*`, `data-*`,
 * `for`), DOM properties (`value`, `checked`, `disabled`, `type`) and `on*`
 * listeners. Children may be strings, nodes or nested arrays; falsy children
 * are skipped so callers can write `cond && node`.
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) {continue;}
    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      element.className = value;
    } else if (key === "value" || key === "checked" || key === "disabled" || key === "open") {
      element[key] = value;
    } else if (value === true) {
      element.setAttribute(key, "");
    } else {
      element.setAttribute(key, String(value));
    }
  }
  append(element, children);
  return element;
}

export function append(parent, children) {
  for (const child of children) {
    if (Array.isArray(child)) {append(parent, child);}
    else if (child === null || child === undefined || child === false) {continue;}
    else {parent.append(child instanceof Node ? child : document.createTextNode(String(child)));}
  }
  return parent;
}

export function clear(parent) {
  while (parent.firstChild) {parent.removeChild(parent.firstChild);}
}

/**
 * Re-render a container without losing keyboard focus. Controls opt in with a
 * stable `data-fid`; after `render()` the same id is focused again.
 */
export function rerender(container, render) {
  const root = container.getRootNode();
  const active = root && root.activeElement;
  const fid = active && container.contains(active) ? active.getAttribute("data-fid") : null;
  const selection =
    fid && typeof active.selectionStart === "number"
      ? [active.selectionStart, active.selectionEnd]
      : null;
  clear(container);
  render();
  if (!fid) {return;}
  const next = container.querySelector(`[data-fid="${fid}"]`);
  if (next && !next.disabled) {
    next.focus({ preventScroll: true });
    if (selection && typeof next.setSelectionRange === "function") {
      try {
        next.setSelectionRange(selection[0], selection[1]);
      } catch {
        // Not every input type supports selection ranges.
      }
    }
  }
}

let idCounter = 0;
export function uid(prefix = "f") {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * A labelled form control with optional hint and inline error slot. `target`
 * is the element that receives the id and aria attributes when `control` is a
 * wrapper around the real input.
 */
export function field({ label, control, target = control, hint, error, required }) {
  const id = target.id || uid("fld");
  target.id = id;
  const describedBy = [];
  const wrap = h("div", { class: "field" });
  wrap.append(
    h("label", { for: id }, label, required ? h("span", { class: "req", "aria-hidden": "true" }, " *") : null),
  );
  if (hint) {
    const hintId = `${id}-hint`;
    wrap.append(h("p", { class: "hint", id: hintId }, hint));
    describedBy.push(hintId);
  }
  wrap.append(control);
  if (error) {
    const errorId = `${id}-error`;
    wrap.append(h("p", { class: "field-error", id: errorId, role: "alert" }, error));
    describedBy.push(errorId);
    target.setAttribute("aria-invalid", "true");
  }
  if (describedBy.length) {target.setAttribute("aria-describedby", describedBy.join(" "));}
  return wrap;
}

export function checkbox({ label, checked, onChange, hint }) {
  const input = h("input", { type: "checkbox", checked: Boolean(checked) });
  input.addEventListener("change", () => onChange(input.checked));
  return h(
    "label",
    { class: "check" },
    input,
    h("span", {}, label, hint ? h("small", { class: "hint" }, hint) : null),
  );
}

/** Strip secrets and keys out of an error before it is shown or announced. */
export function safeErrorMessage(error, secrets = []) {
  let message = text(error?.message || error).replace(/\s+/g, " ").trim();
  for (const value of secrets) {
    if (value) {message = message.split(String(value)).join("[hidden]");}
  }
  message = message
    .replace(/(?:sk-|rk-|pk-|AIza)[A-Za-z0-9_-]{8,}/g, "[hidden]")
    .replace(/(authorization|api[-_ ]?key|token|secret)\s*[:=]\s*[^,\s]+/gi, "$1: [hidden]");
  return message.slice(0, 280) || "The request could not be completed.";
}

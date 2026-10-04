// Launcher button: sits in the game's top navigation when it can be found and
// falls back to a floating button otherwise. Placement is re-checked when the
// page changes, and `destroy()` removes every listener it added.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "iframe",
  "object",
  "embed",
  "[contenteditable=true]",
  "[tabindex]",
].join(",");

export function isFocusable(element) {
  if (
    !element ||
    element.isConnected !== true ||
    typeof element.focus !== "function" ||
    element.disabled === true ||
    element.hidden === true ||
    element.getAttribute?.("aria-hidden") === "true"
  )
    {return false;}
  if (element.matches?.(":disabled")) {return false;}
  const view = element.ownerDocument?.defaultView;
  if (typeof view?.getComputedStyle === "function") {
    const style = view.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {return false;}
  }
  return element.matches?.(FOCUSABLE_SELECTOR) === true;
}

export function findTopNavigationPlacement(documentRef, launcher) {
  const view = documentRef.defaultView;
  const viewportWidth = view?.innerWidth || documentRef.documentElement.clientWidth;
  const buttonRect = launcher.getBoundingClientRect();
  const buttonWidth = buttonRect.width || (viewportWidth <= 600 ? 42 : 62);
  const buttonHeight = buttonRect.height || 36;
  const selector = 'a[href], button, [role="button"]';
  const controls = Array.from(documentRef.querySelectorAll(selector))
    .filter((element) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== documentRef.body) {
        if (ancestor.matches(selector)) {return false;}
        ancestor = ancestor.parentElement;
      }
      const rect = element.getBoundingClientRect();
      const style = view?.getComputedStyle?.(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        rect.top < 100 &&
        rect.bottom > 0 &&
        style?.display !== "none" &&
        style?.visibility !== "hidden";
    })
    .map((element) => ({ element, rect: element.getBoundingClientRect() }));

  const navigationFor = (element) =>
    element.closest('nav, [role="navigation"], header, [role="banner"]') ||
    element.parentElement;
  const normalizeLabel = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const navigationItems = [
    ["spolecznosc", 4],
    ["community", 4],
    ["flagi", 3],
    ["flags", 3],
    ["presety", 2],
    ["presets", 2],
    ["gry", 1],
    ["games", 1],
  ];
  const labeled = controls
    .map(({ element, rect }) => {
      const label = normalizeLabel(
        element.getAttribute("aria-label") || element.innerText || element.textContent,
      );
      const match = navigationItems.find(([name]) =>
        label === name || label.endsWith(` ${name}`),
      );
      return match
        ? { element, rect, priority: match[1], watch: navigationFor(element) }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) =>
      right.priority - left.priority || right.rect.right - left.rect.right,
    );

  const fitAfter = (item) => {
    const next = controls
      .filter(({ element, rect }) =>
        element !== item.element && rect.left >= item.rect.right - 1,
      )
      .sort((left, right) => left.rect.left - right.rect.left)[0];
    const rightEdge = next ? next.rect.left - 8 : viewportWidth - 8;
    const left = item.rect.right + 8;
    if (left + buttonWidth > rightEdge) {return null;}
    return {
      left,
      top: item.rect.top + (item.rect.height - buttonHeight) / 2,
      watch: item.watch,
    };
  };

  for (const item of labeled) {
    const placement = fitAfter(item);
    if (placement) {return placement;}
  }

  const sorted = controls.slice().sort((left, right) => left.rect.left - right.rect.left);
  const groups = [];
  for (const item of sorted) {
    const group = groups[groups.length - 1];
    if (group && item.rect.left - group.right <= Math.max(72, viewportWidth * 0.045)) {
      group.items.push(item);
      group.right = Math.max(group.right, item.rect.right);
      group.bottom = Math.max(group.bottom, item.rect.bottom);
      group.top = Math.min(group.top, item.rect.top);
    } else {
      groups.push({
        items: [item],
        left: item.rect.left,
        right: item.rect.right,
        top: item.rect.top,
        bottom: item.rect.bottom,
      });
    }
  }
  const centralGroup = groups
    .filter((group) => group.items.length >= 2)
    .sort((left, right) => {
      const leftCenter = (left.left + left.right) / 2;
      const rightCenter = (right.left + right.right) / 2;
      return (
        right.items.length * 100 - Math.abs(rightCenter - viewportWidth / 2) -
        (left.items.length * 100 - Math.abs(leftCenter - viewportWidth / 2))
      );
    })[0];
  if (centralGroup) {
    const nextGroup = groups
      .filter((group) => group.left >= centralGroup.right)
      .sort((left, right) => left.left - right.left)[0];
    const left = centralGroup.right + 8;
    const rightEdge = nextGroup ? nextGroup.left - 8 : viewportWidth - 8;
    if (left + buttonWidth <= rightEdge) {
      return {
        left,
        top: (centralGroup.top + centralGroup.bottom - buttonHeight) / 2,
        watch: navigationFor(centralGroup.items[centralGroup.items.length - 1].element),
      };
    }
  }

  const bars = Array.from(
    documentRef.querySelectorAll('nav, header, [role="navigation"], [role="banner"]'),
  )
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width >= viewportWidth * 0.4 && rect.top <= 80 && rect.height >= 28 && rect.height <= 120)
    .sort((left, right) => right.rect.width - left.rect.width);
  const bar = bars[0];
  const left = Math.max(8, Math.min(viewportWidth * 0.62, viewportWidth - buttonWidth - 8));
  return {
    left,
    top: bar ? bar.rect.top + (bar.rect.height - buttonHeight) / 2 : 7,
    watch: bar?.element || null,
  };
}

/** Place `host` in the page and keep it placed. Returns `{ place, destroy }`. */
export function createLauncher(documentRef, host, launcher) {
  const view = documentRef.defaultView;
  let observedNavigation = null;
  let scheduled = false;
  let destroyed = false;
  host.classList.add("relay-launcher-fallback");
  (documentRef.body || documentRef.documentElement).append(host);

  const place = () => {
    if (destroyed) {return false;}
    if (!host.isConnected) {(documentRef.body || documentRef.documentElement).append(host);}
    const placement = findTopNavigationPlacement(documentRef, launcher);
    if (!placement) {
      host.classList.remove("relay-launcher-positioned");
      host.classList.add("relay-launcher-fallback");
      host.style.left = "";
      host.style.top = "";
      observedNavigation = null;
      return false;
    }
    host.classList.add("relay-launcher-positioned");
    host.classList.remove("relay-launcher-fallback");
    host.style.left = `${Math.round(placement.left)}px`;
    host.style.top = `${Math.round(placement.top)}px`;
    observedNavigation = placement.watch;
    return true;
  };
  const schedule = () => {
    if (scheduled || destroyed) {return;}
    scheduled = true;
    const run = () => {
      scheduled = false;
      place();
    };
    if (typeof view?.requestAnimationFrame === "function") {view.requestAnimationFrame(run);}
    else {setTimeout(run, 30);}
  };
  const touches = (node) =>
    node === observedNavigation || node.contains?.(observedNavigation) || observedNavigation?.contains?.(node);
  const Observer = view?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        const relevant =
          !host.isConnected ||
          !observedNavigation ||
          records.some(
            (r) => touches(r.target) || [...(r.removedNodes || []), ...(r.addedNodes || [])].some(touches),
          );
        if (relevant) {schedule();}
      })
    : null;
  observer?.observe(documentRef.documentElement, { childList: true, subtree: true });
  view?.addEventListener("resize", schedule, { passive: true });
  view?.addEventListener("scroll", schedule, { passive: true });
  place();

  return {
    place,
    observer,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      view?.removeEventListener("resize", schedule);
      view?.removeEventListener("scroll", schedule);
      host.remove();
    },
  };
}

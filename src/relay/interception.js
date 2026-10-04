/**
 * Only rate limits and server errors keep their status. Anything else (a
 * provider's 401/403/404, a 2xx, an out-of-range code) becomes 502 so the game
 * never mistakes a provider problem for a problem with its own session, and
 * `new Response` never throws on an invalid status.
 */
export function responseStatus(status) {
  const code = Number(status);
  return code === 429 || (code >= 500 && code <= 599) ? code : 502;
}

export function installInterceptor(page, pipeline) {
  const marker = Symbol.for("historia-relay.interceptor.v2");
  if (page[marker]) {return;}
  const original = page.fetch.bind(page);
  const originals = new Map();
  async function fallbackOnce(body, input, init) {
    const key = JSON.stringify([body, init?.method || input?.method || "POST"]);
    let shared = originals.get(key);
    if (!shared) {
      shared = Promise.resolve().then(() => original(input, init));
      originals.set(key, shared);
      shared
        .finally(() => {
          setTimeout(() => originals.delete(key), 0);
        })
        .catch(() => {});
    }
    return (await shared).clone();
  }
  function match(input) {
    try {
      const u = new URL(
        typeof input === "string" ? input : input?.url || String(input),
        page.location.href,
      );
      return (
        u.origin === page.location.origin && u.pathname === "/api/simple-chat"
      );
    } catch {
      return false;
    }
  }
  async function route(input, init) {
    const body =
      init?.body !== undefined ? init.body : await input?.clone?.().text();
    if (typeof body !== "string" || !body) {return original(input, init);}
    try {
      const result = await pipeline.process(body);
      return result.fallback
        ? fallbackOnce(body, input, init)
        : new page.Response(result.body, {
            status: result.status,
            headers: { "Content-Type": "application/json" },
          });
    } catch (error) {
      const category = String(error.category || "request")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return new page.Response(
        JSON.stringify({
          error: "Your AI could not answer.",
          errorCode: `AI_RELAY_${category || "REQUEST"}`,
          details: error.message,
        }),
        {
          status: responseStatus(error.status),
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }
  function hook(input, init) {
    if (!match(input)) {return original(input, init);}
    return new page.Promise((resolve, reject) =>
      route(input, init).then(resolve, reject),
    );
  }
  page.fetch =
    typeof globalThis.exportFunction === "function"
      ? globalThis.exportFunction(hook, page)
      : hook;
  page[marker] = true;
}

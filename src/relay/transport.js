import { RelayFailure } from "./diagnostics.js";
export function endpoint(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new RelayFailure("configuration", "Enter a complete API URL.");
  }
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.hash
  )
    {throw new RelayFailure(
      "configuration",
      "Use an HTTP or HTTPS URL without embedded credentials or fragments.",
    );}
  return u;
}
export function authenticatedRequest(profile, path) {
  const base = endpoint(profile.endpoint),
    url = new URL(path || "", `${base.href.replace(/\/$/, "")}/`);
  if (url.origin !== base.origin)
    {throw new RelayFailure(
      "configuration",
      "Completion and model endpoints must belong to the profile origin.",
    );}
  const credential = profile.credentials || {},
    headers = { "Content-Type": "application/json" };
  if (
    /[\r\n]/.test(
      String(credential.secret || "") + String(credential.name || ""),
    ) ||
    /^(cookie|host|content-length|proxy-authorization)$/i.test(
      credential.name || "",
    )
  )
    {throw new RelayFailure(
      "configuration",
      "Authentication contains an invalid header or newline.",
    );}
  if (
    (credential.secret || Object.keys(profile.headers || {}).length) &&
    credential.boundEndpoint !== profile.endpoint
  )
    {throw new RelayFailure(
      "configuration",
      "The endpoint changed. Clear the old key and enter credentials for this endpoint.",
    );}
  for (const [key, value] of Object.entries(profile.headers || {})) {
    if (
      /^(cookie|host|content-length|authorization|proxy-authorization)$/i.test(
        key,
      ) ||
      /[\r\n]/.test(key + value)
    )
      {throw new RelayFailure(
        "configuration",
        "Custom headers contain a reserved or invalid header.",
      );}
    headers[key] = String(value);
  }
  if (credential.mode !== "none") {
    if (!credential.secret)
      {throw new RelayFailure(
        "authentication",
        "Enter a key for this profile.",
        401,
      );}
    if (credential.mode === "bearer")
      {headers.Authorization = `Bearer ${credential.secret}`;}
    else if (credential.mode === "header" && credential.name)
      {headers[credential.name] = credential.secret;}
    else if (credential.mode === "query" && credential.name)
      {url.searchParams.set(credential.name, credential.secret);}
    else
      {throw new RelayFailure(
        "configuration",
        "Choose an authentication type and header or parameter name.",
      );}
  }
  return { url: url.href, headers };
}
export function browserHttp(spec) {
  const gm =
    globalThis.GM_xmlhttpRequest ||
    globalThis.GM?.xmlHttpRequest?.bind(globalThis.GM);
  if (!gm)
    {throw new RelayFailure(
      "configuration",
      "Enable the userscript manager HTTP permission.",
    );}
  return new Promise((resolve, reject) => {
    let handle,
      done = false;
    const finish = (fn, value) => {
      if (done) {return;}
      done = true;
      spec.signal?.removeEventListener("abort", abort);
      fn(value);
    };
    const abort = () => {
      if (done) {return;}
      finish(reject, new RelayFailure("cancelled", "Request cancelled."));
      handle?.abort?.();
    };
    if (spec.signal?.aborted) {return abort();}
    spec.signal?.addEventListener("abort", abort, { once: true });
    const sameOrigin = (finalUrl) => {
      try {
        return new URL(finalUrl).origin === new URL(spec.url).origin;
      } catch {
        return false;
      }
    };
    const receive = (r) => {
      if (r.finalUrl && !sameOrigin(r.finalUrl))
        {return finish(
          reject,
          new RelayFailure(
            "configuration",
            "The API redirected to another origin.",
          ),
        );}
      let json;
      try {
        json = JSON.parse(r.responseText);
      } catch {}
      finish(resolve, {
        status: r.status,
        headers: r.responseHeaders,
        json,
        text: r.responseText,
      });
    };
    try {
      handle = gm({
        url: spec.url,
        method: spec.method || "POST",
        headers: spec.headers,
        data: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        timeout: spec.timeoutMs,
        anonymous: true,
        redirect: "error",
        onload: receive,
        onerror: () =>
          finish(
            reject,
            new RelayFailure("network", "The API could not be reached."),
          ),
        ontimeout: () =>
          finish(
            reject,
            new RelayFailure("timeout", "The API did not respond in time."),
          ),
        onabort: abort,
      });
      handle?.then?.(receive, () =>
        finish(reject, new RelayFailure("network", "The API request failed.")),
      );
    } catch {
      finish(
        reject,
        new RelayFailure("network", "The API request could not start."),
      );
    }
  });
}
export function retryDelay(response, now = Date.now()) {
  const header =
    typeof response.headers === "string"
      ? response.headers.match(/^retry-after:\s*(.+)$/im)?.[1]
      : response.headers?.get?.("retry-after");
  const details = response.json?.error?.details || [];
  const hint = details.find((x) =>
    x["@type"]?.endsWith("RetryInfo"),
  )?.retryDelay;
  const message = response.json?.error?.message || "";
  const seconds =
    hint?.match(/^([\d.]+)s$/)?.[1] ??
    message.match(/retry in ([\d.]+)s/i)?.[1];
  const delays = [
    header && !Number.isNaN(Number(header))
      ? Number(header) * 1000
      : Date.parse(header || "") - now,
    Number(seconds) * 1000,
  ].filter(Number.isFinite);
  return Math.max(0, ...delays) + 1000;
}
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new RelayFailure("cancelled", "Request cancelled."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) {abort();}
    else {signal?.addEventListener("abort", abort, { once: true });}
  });
export class HttpExecutor {
  constructor(diagnostics, send = browserHttp, wait = sleep) {
    this.cooldowns = new Map();
    this.log = diagnostics;
    this.send = send;
    this.wait = wait;
  }
  async request(profile, path, body, context = {}) {
    const scope = `${profile.id}:${context.model || ""}`;
    const timeoutMs = Math.min(
      120000,
      Math.max(1000, Number(profile.options.timeoutMs) || 120000),
    );
    for (let attempt = 1; attempt <= 3; attempt++) {
      const delay = Math.max(0, (this.cooldowns.get(scope) || 0) - Date.now());
      if (delay > 0) {await this.wait(delay, context.signal);}
      this.log.emit("transport", { attempt, requestId: context.requestId });
      let response;
      try {
        response = await this.send({
          ...authenticatedRequest(profile, path),
          body,
          method: body === undefined ? "GET" : "POST",
          timeoutMs,
          signal: context.signal,
        });
      } catch (error) {
        if (!["timeout", "network"].includes(error.category) || attempt === 3)
          {throw error;}
        await this.wait(
          Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 500,
          context.signal,
        );
        continue;
      }
      if (response.status >= 200 && response.status < 300) {
        if (!response.json)
          {throw new RelayFailure(
            "invalid-response",
            "The API returned an unreadable response.",
            response.status,
          );}
        return response.json;
      }
      const status = response.status;
      const contextLimitMessage = profile.providerId === "lmstudio"
        ? lmStudioContextLimitMessage(response.json)
        : "";
      const category = contextLimitMessage
        ? "context-limit"
        :
        status === 401 || status === 403
          ? "authentication"
          : status === 429
            ? "rate-limit"
            : [408, 425].includes(status) || status >= 500
              ? "transient"
              : "configuration";
      const daily = (response.json?.error?.details || []).some((d) =>
        (d.violations || []).some((v) =>
          /perday|per_day|daily/i.test(v.quotaId || ""),
        ),
      );
      const backoff = Math.max(
        retryDelay(response),
        Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 500,
      );
      const failure = new RelayFailure(
        category,
        contextLimitMessage || (daily
          ? "Daily quota reached. Wait for its reset or choose a different configured profile."
          : `The API rejected the request (${status}). ${category === "authentication" ? "Check this profile key." : category === "rate-limit" ? "Usage limits are still active." : "Check the model, endpoint and capabilities."}`),
        status,
      );
      if (
        daily ||
        !["rate-limit", "transient"].includes(category) ||
        attempt === 3 ||
        backoff > 120000
      )
        {throw failure;}
      this.cooldowns.set(scope, Date.now() + backoff);
      this.log.emit("transport", { status, delayMs: backoff, attempt });
    }
  }
}

function lmStudioContextLimitMessage(data) {
  const error = data?.error;
  const message = typeof error === "string"
    ? error
    : typeof error?.message === "string"
      ? error.message
      : typeof data?.message === "string"
        ? data.message
        : "";
  if (
    !/context/i.test(message) ||
    !/(?:exceed|too large|overflow|larger than)/i.test(message)
  )
    {return "";}
  const tokenCounts = [...message.matchAll(/([\d,]+)\s*tokens?/gi)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (tokenCounts.length < 2) {return "";}
  const format = (value) => value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : String(value);
  return `LM Studio context limit: this request needs about ${format(tokenCounts[0])} tokens, but the loaded model context is ${format(tokenCounts[1])}. Load the model with a larger context or reduce the request size in Pax Historia.`;
}

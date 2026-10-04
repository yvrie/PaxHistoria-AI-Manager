// Guess a provider from the shape of a pasted API key. This only ever
// *suggests* a provider; an ambiguous key (plain `sk-...`) returns "".

const PATTERNS = Object.freeze([
  [/^sk-or-/i, "openrouter"],
  [/^sk-ant-/i, "anthropic"],
  [/^AIza[0-9A-Za-z_-]{20,}$/, "google"],
  [/^gsk_/i, "groq"],
  [/^xai-/i, "xai"],
  [/^pplx-/i, "perplexity"],
  [/^csk-/i, "cerebras"],
  [/^hf_/i, "huggingface"],
  [/^nvapi-/i, "nvidia"],
  [/^sk-(proj|svcacct|admin)-/i, "openai"],
]);

export function detectProviderFromKey(key) {
  const value = String(key ?? "").trim();
  if (value.length < 12 || /\s/.test(value)) {return "";}
  for (const [pattern, providerId] of PATTERNS) {
    if (pattern.test(value)) {return providerId;}
  }
  return "";
}

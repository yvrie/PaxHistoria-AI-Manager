import { RelayFailure } from "./diagnostics.js";
const maps = new Set([
  "properties",
  "$defs",
  "definitions",
  "patternProperties",
]);
const children = new Set([
  "items",
  "additionalProperties",
  "not",
  "if",
  "then",
  "else",
  "contains",
  "propertyNames",
]);
const lists = new Set(["anyOf", "oneOf", "allOf", "prefixItems"]);
export function visitSchema(schema, visitor, path = "$") {
  if (typeof schema === "boolean") {return visitor(schema, path);}
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    {throw new RelayFailure("schema", `Invalid schema at ${path}.`);}
  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (maps.has(key))
      {result[key] = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [
          name,
          visitSchema(child, visitor, `${path}/${key}/${name}`),
        ]),
      );}
    else if (
      (children.has(key) && typeof value === "object") ||
      (children.has(key) && typeof value === "boolean")
    )
      {result[key] = visitSchema(value, visitor, `${path}/${key}`);}
    else if (lists.has(key))
      {result[key] = value.map((child, i) =>
        visitSchema(child, visitor, `${path}/${key}/${i}`),
      );}
    else {result[key] = structuredClone(value);}
  }
  return visitor(result, path);
}
export function normalizeContract(input) {
  if (!input) {return null;}
  return visitSchema(input.schema ?? input, (node) => {
    if (typeof node === "boolean") {return node;}
    if (node.type)
      {node.type = Array.isArray(node.type)
        ? node.type.map((t) => t.toLowerCase())
        : node.type.toLowerCase();}
    if (node.nullable) {
      delete node.nullable;
      return { anyOf: [node, { type: "null" }] };
    }
    return node;
  });
}
export function schemaDialect(schema, protocol) {
  const unsupported = [];
  const lmStudio = protocol === "lmstudio-chat";
  const allowed = new Set([
    "type",
    "properties",
    "required",
    "items",
    "prefixItems",
    "enum",
    "description",
    "title",
    "$id",
    "$defs",
    "$ref",
    "$anchor",
    "format",
    "pattern",
    "propertyOrdering",
    "nullable",
    "example",
    "anyOf",
    "oneOf",
    "allOf",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minProperties",
    "maxProperties",
    "additionalProperties",
  ]);
  const result = visitSchema(schema, (node, path) => {
    if (typeof node === "boolean") {return node;}
    // propertyOrdering is a Gemini extension, not part of LM Studio's schema dialect.
    if (lmStudio) {delete node.propertyOrdering;}
    if (protocol === "gemini-generate-content")
      {for (const key of Object.keys(node))
        {if (!allowed.has(key)) {unsupported.push(`${path}/${key}`);}}}
    if (
      protocol !== "gemini-generate-content" &&
      !lmStudio &&
      node.propertyOrdering !== undefined
    )
      {unsupported.push(`${path}/propertyOrdering`);}
    if (
      protocol !== "gemini-generate-content" &&
      !lmStudio &&
      node.type === "object" &&
      node.additionalProperties !== false
    )
      {unsupported.push(`${path}/additionalProperties`);}
    return node;
  });
  return { schema: result, unsupported };
}
export function decodeOutput(output) {
  if (output !== null && typeof output === "object") {return output;}
  const text = String(output || "").trim();
  const candidates = [
    text,
    ...Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi), (m) => m[1]),
  ];
  let start = -1,
    stack = [],
    quoted = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) {
      if (c === "{" || c === "[") {
        start = i;
        stack = [c];
      }
      continue;
    }
    if (quoted) {
      if (escaped) {escaped = false;}
      else if (c === "\\") {escaped = true;}
      else if (c === '"') {quoted = false;}
      continue;
    }
    if (c === '"') {quoted = true;}
    else if (c === "{" || c === "[") {stack.push(c);}
    else if (c === "}" || c === "]") {
      const open = stack.pop();
      if ((c === "}" && open !== "{") || (c === "]" && open !== "[")) {
        start = -1;
        stack = [];
      } else if (!stack.length) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  const found = [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.replace(/^\uFEFF/, ""));
      if (!found.some((x) => JSON.stringify(x) === JSON.stringify(parsed)))
        {found.push(parsed);}
    } catch {}
  }
  if (found.length !== 1)
    {throw new RelayFailure(
      "decoding",
      found.length
        ? "The response contains multiple different JSON values."
        : "The response contains no complete JSON value. Truncated output cannot be repaired safely.",
    );}
  return found[0];
}
const supported = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "description",
  "title",
  "format",
  "propertyOrdering",
  "example",
  "default",
  "examples",
  "$schema",
  "$id",
  "$ref",
  "$anchor",
  "$defs",
  "definitions",
]);
export function validateOutput(value, schema) {
  const equal = (a, b) =>
    a === b ||
    (a !== null &&
      b !== null &&
      typeof a === "object" &&
      typeof b === "object" &&
      Array.isArray(a) === Array.isArray(b) &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(
        (key) => Object.hasOwn(b, key) && equal(a[key], b[key]),
      ));
  const failedPaths = new Set();
  const check = (v, s, path, depth = 0) => {
    const valid = evaluate(v, s, path, depth);
    if (!valid) {failedPaths.add(path);}
    return valid;
  };
  const evaluate = (v, s, path, depth = 0) => {
    if (depth > 80)
      {throw new RelayFailure("schema", "Schema recursion limit reached.");}
    if (s === true) {return true;}
    if (s === false) {return false;}
    for (const k of Object.keys(s))
      {if (!supported.has(k))
        {throw new RelayFailure(
          "schema",
          `Unsupported validation keyword: ${k}.`,
        );}}
    if (s.$ref) {
      if (!s.$ref.startsWith("#/"))
        {throw new RelayFailure(
          "schema",
          "External schema references are not supported.",
        );}
      let ref = schema;
      for (const part of s.$ref.slice(2).split("/"))
        {ref = ref?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];}
      if (ref === undefined)
        {throw new RelayFailure("schema", "Unresolved schema reference.");}
      if (!check(v, ref, path, depth + 1)) {return false;}
    }
    const types = {
      null: v === null,
      array: Array.isArray(v),
      object: v !== null && typeof v === "object" && !Array.isArray(v),
      string: typeof v === "string",
      number: typeof v === "number" && Number.isFinite(v),
      integer: Number.isInteger(v),
      boolean: typeof v === "boolean",
    };
    if (s.type && ![s.type].flat().some((t) => types[t])) {return false;}
    if (
      (s.enum && !s.enum.some((x) => equal(x, v))) ||
      (Object.hasOwn(s, "const") && !equal(s.const, v))
    )
      {return false;}
    for (const [key, test] of [
      ["anyOf", (n) => n > 0],
      ["oneOf", (n) => n === 1],
      ["allOf", (n) => n === s.allOf.length],
    ])
      {if (
        s[key] &&
        !test(s[key].filter((x) => check(v, x, path, depth + 1)).length)
      )
        {return false;}}
    if (s.not && check(v, s.not, path, depth + 1)) {return false;}
    if (types.object) {
      const keys = Object.keys(v);
      if (
        s.required?.some((k) => !Object.hasOwn(v, k)) ||
        keys.length < (s.minProperties ?? 0) ||
        keys.length > (s.maxProperties ?? Infinity)
      )
        {return false;}
      for (const key of keys) {
        const child = s.properties?.[key];
        if (child !== undefined) {
          if (!check(v[key], child, `${path}/${key}`, depth + 1)) {return false;}
        } else if (
          s.additionalProperties !== undefined &&
          !check(v[key], s.additionalProperties, `${path}/${key}`, depth + 1)
        )
          {return false;}
      }
    }
    if (types.array) {
      if (
        v.length < (s.minItems ?? 0) ||
        v.length > (s.maxItems ?? Infinity) ||
        (s.uniqueItems &&
          v.some((x, i) => v.slice(0, i).some((y) => equal(x, y))))
      )
        {return false;}
      if (
        s.items !== undefined &&
        !v.every((x, i) => check(x, s.items, `${path}/${i}`, depth + 1))
      )
        {return false;}
    }
    if (types.string) {
      if (
        [...v].length < (s.minLength ?? 0) ||
        [...v].length > (s.maxLength ?? Infinity)
      )
        {return false;}
      if (s.pattern) {
        if (s.pattern.length > 500 || v.length > 100000)
          {throw new RelayFailure(
            "schema",
            "Pattern validation size limit exceeded.",
          );}
        if (!new RegExp(s.pattern, "u").test(v)) {return false;}
      }
    }
    if (
      types.number &&
      (v < (s.minimum ?? -Infinity) ||
        v > (s.maximum ?? Infinity) ||
        v <= (s.exclusiveMinimum ?? -Infinity) ||
        v >= (s.exclusiveMaximum ?? Infinity) ||
        (s.multipleOf &&
          Math.abs(v / s.multipleOf - Math.round(v / s.multipleOf)) > 1e-8))
    )
      {return false;}
    return true;
  };
  if (!check(value, schema, "$"))
    {throw new RelayFailure(
      "validation",
      `The answer does not match the game response contract at ${[...failedPaths].slice(0, 4).join(", ")}.`,
    );}
  return value;
}

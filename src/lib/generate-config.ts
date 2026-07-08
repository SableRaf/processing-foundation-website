import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dump } from "js-yaml";
import { pagesCms } from "../schemas/pages.ts";
import { peopleCms } from "../schemas/people.ts";

/**
 * Generates public/config.yml for Decap CMS by introspecting the Zod schemas in
 * src/schemas/*. Those schemas are the single source of truth; DO NOT hand-edit
 * the generated config.yml — edit the schemas (or `baseConfig` below) instead.
 *
 * Zod 4 exposes a schema's internal definition at `schema._zod.def`, with:
 *   - object   -> { type: "object", shape: { key: schema } }
 *   - union    -> { type: "union", discriminator, options: [objectSchema] }  (discriminatedUnion)
 *   - array    -> { type: "array", element: schema }
 *   - enum     -> { type: "enum", entries: { key: value } }
 *   - literal  -> { type: "literal", values: [value] }
 *   - optional -> { type: "optional", innerType: schema }  (also nullable/default)
 *   - string/number/boolean -> { type: "string" | "number" | "boolean" }
 *
 * A field can override its widget/label with Zod metadata, e.g.
 *   z.string().meta({ widget: "markdown", label: "Body copy" })
 */

type ZodAny = { _zod: { def: any }; meta?: () => Record<string, unknown> | null };
const def = (schema: ZodAny) => schema._zod.def;
const readMeta = (schema: ZodAny): Record<string, unknown> =>
  (typeof schema.meta === "function" ? schema.meta() : null) ?? {};

/** "block1" -> "Block 1", "heroTitle" -> "Hero Title", "call_to_action" -> "Call To Action". */
function humanize(name: string): string {
  return name
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Unwrap optional/nullable/default wrappers, tracking whether the field is required. */
function unwrap(schema: ZodAny): { inner: ZodAny; required: boolean } {
  let inner = schema;
  let required = true;
  let d = def(inner);
  while (d.type === "optional" || d.type === "nullable" || d.type === "default") {
    if (d.type !== "default") required = false;
    inner = d.innerType;
    d = def(inner);
  }
  return { inner, required };
}

/** Map a single Zod scalar type to a Decap widget name. */
function scalarWidget(zodType: string): string {
  switch (zodType) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      console.warn(
        `[generate-config] No Decap widget mapping for Zod type "${zodType}"; falling back to "string".`,
      );
      return "string";
  }
}

/** Build the Decap field entry for a named object property. */
function fieldFromSchema(name: string, schema: ZodAny): Record<string, unknown> {
  const { inner, required } = unwrap(schema);
  const meta = { ...readMeta(inner), ...readMeta(schema) };
  const d = def(inner);
  const base: Record<string, unknown> = {
    name,
    label: (meta.label as string) ?? humanize(name),
  };
  if (!required) base.required = false;

  // Explicit widget override via .meta({ widget: "..." }).
  if (typeof meta.widget === "string") {
    return { ...base, widget: meta.widget, ...(meta.options ? { options: meta.options } : {}) };
  }

  if (d.type === "enum") {
    return { ...base, widget: "select", options: Object.values(d.entries) };
  }

  if (d.type === "array") {
    const element = d.element as ZodAny;
    const ed = def(element);
    if (ed.type === "union") {
      return { ...base, widget: "list", types: variableTypes(element) };
    }
    if (ed.type === "enum") {
      return { ...base, widget: "select", multiple: true, options: Object.values(ed.entries) };
    }
    if (ed.type === "object") {
      return { ...base, widget: "list", fields: fieldsFromObject(element) };
    }
    return { ...base, widget: "list" }; // list of scalars
  }

  if (d.type === "object") {
    return { ...base, widget: "object", fields: fieldsFromObject(inner) };
  }

  return { ...base, widget: scalarWidget(d.type) };
}

/** Build Decap `fields` from a Zod object's shape. */
function fieldsFromObject(objectSchema: ZodAny): Array<Record<string, unknown>> {
  const shape = def(objectSchema).shape as Record<string, ZodAny>;
  return Object.entries(shape).map(([name, schema]) =>
    fieldFromSchema(name, schema),
  );
}

/**
 * Build Decap variable `types` from a discriminated union. Each option is an
 * object whose discriminator literal becomes the type name; that discriminator
 * field is omitted from the fields (Decap stores it automatically as `typeKey`).
 */
function variableTypes(union: ZodAny): Array<Record<string, unknown>> {
  const { discriminator, options } = def(union) as {
    discriminator: string;
    options: ZodAny[];
  };
  return options.map((option) => {
    const shape = def(option).shape as Record<string, ZodAny>;
    const typeName = def(shape[discriminator]).values[0] as string;
    const fields = Object.entries(shape)
      .filter(([name]) => name !== discriminator)
      .map(([name, schema]) => fieldFromSchema(name, schema));
    return { name: typeName, label: humanize(typeName), widget: "object", fields };
  });
}

/**
 * A collection definition as exported from src/schemas/*: Decap collection-level
 * config, a `schema` (Zod) that drives the fields, and optional `extraFields`
 * (Decap fields that can't be expressed as frontmatter Zod, e.g. a markdown body).
 */
type CollectionDef = {
  schema: ZodAny;
  extraFields?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

/** Turn a schema-backed collection definition into a Decap collection object. */
function buildCollection(def: CollectionDef): Record<string, unknown> {
  const { schema, extraFields = [], ...meta } = def;
  return { ...meta, fields: [...fieldsFromObject(schema), ...extraFields] };
}

/** Static parts of the Decap config that aren't tied to a collection schema. */
const baseConfig = {
  backend: {
    name: "github",
    repo: "designsystemsinternational/processing-foundation-website",
    branch: "main",
  },
  // Lets the CMS admin use a local decap-server proxy
  // instead of commiting to Github when it detects it's running localhost.
  local_backend: true,
  media_folder: "src/assets/media",
  public_folder: "src/assets/media",
};

/** Every schema-backed collection, in CMS display order. */
const collectionDefs: CollectionDef[] = [
  peopleCms as unknown as CollectionDef,
  pagesCms as unknown as CollectionDef,
];

/** Build the full Decap config object. */
export function buildConfig() {
  return {
    ...baseConfig,
    collections: collectionDefs.map(buildCollection),
  };
}

/** Serialize the config to YAML with an auto-generated header. */
export function renderConfigYaml(): string {
  const header =
    "# AUTO-GENERATED FROM src/schemas/*.ts — DO NOT EDIT BY HAND.\n" +
    "# Regenerated on every `astro dev` / `astro build`.\n" +
    "# Edit the Zod schemas in src/schemas/ (or baseConfig in\n" +
    "# src/lib/generate-config.ts) instead.\n\n";
  return header + dump(buildConfig(), { lineWidth: -1, noRefs: true });
}

/**
 * Write config.yml. Pass the project root as a file:// URL (Astro integrations
 * get this as `config.root`); when omitted it resolves relative to this file for
 * standalone/CLI use.
 */
export function writeConfig(root?: URL) {
  const outUrl = root
    ? new URL("public/config.yml", root)
    : new URL("../../public/config.yml", import.meta.url);
  writeFileSync(fileURLToPath(outUrl), renderConfigYaml());
}

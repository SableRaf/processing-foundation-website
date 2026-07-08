import { z } from "zod";

/**
 * SINGLE SOURCE OF TRUTH for the People collection.
 *
 * This schema describes the markdown *frontmatter* only. The markdown body is the
 * file's content (not frontmatter), so it isn't part of the Zod schema — it's
 * declared to Decap via `extraFields` in `peopleCms` below.
 *
 * Zod → Decap mapping (see src/lib/generate-config.ts):
 *   - z.string()                 -> widget: string
 *   - z.array(z.enum([...]))     -> widget: select, multiple: true, options: [...]
 */
export const peopleSchema = z.object({
  name: z.string(),
  roles: z.array(z.enum(["Board", "Advisor", "Alumn"])),
});

export type Person = z.infer<typeof peopleSchema>;

/**
 * Decap CMS collection definition. `schema` drives the generated frontmatter
 * fields; `extraFields` are appended verbatim (here, the markdown body, which
 * can't be expressed as frontmatter Zod).
 */
export const peopleCms = {
  name: "people",
  label: "People",
  folder: "src/content/people",
  create: true,
  identifier_field: "name",
  schema: peopleSchema,
  extraFields: [{ name: "body", label: "Body", widget: "markdown" }],
};

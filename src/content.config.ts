import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { pageSchema } from "./schemas/pages.ts";
import { peopleSchema } from "./schemas/people.ts";

const pages = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "src/content/pages" }),
  schema: pageSchema,
});

const people = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "src/content/people" }),
  schema: peopleSchema,
});

export const collections = { pages, people };

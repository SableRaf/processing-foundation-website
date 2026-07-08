# Processing Foundation Website

An [Astro](https://astro.build) static site whose content is edited either
manually or through [Decap CMS](https://decapcms.org). It includes a **page
builder**: editors assemble pages from reusable "blocks" in any order, and Astro
renders them to static HTML.

The defining idea of this codebase: **Zod schemas are the single source of
truth.** You describe content once as a Zod schema, and both Astro's validation
_and_ the Decap CMS admin UI are derived from it.

## Requirements

- Node `>=22.12.0` (the toolchain relies on Node's native TypeScript support)

## Getting started

```bash
npm install
npm run dev
```

- Site: http://localhost:4321
- CMS admin: http://localhost:4321/admin

`astro dev` and `astro build` both regenerate `public/config.yml` automatically
(see "How the CMS config is generated" below).

## How it fits together

```
src/
├── schemas/              ← Single source of truth for the data model
│   ├── pages.ts          ·  Schemas for the page builder
│   └── people.ts         ·  Schema for the people collection
├── lib/
│   └── generate-config.ts ·  Turns zod schemas into the config.yml decap settings file
├── blocks/               ← Astro blocks for the page builder
├── content/
│   ├── pages/*.json      ·  Content for the page builder
│   └── people/*.md       ·  Content for the people collection
└── pages/
    ├── [...slug].astro   ·  Catch-all route to render page builder pages
    ├── index.astro       ·  Home page
    └── admin.html        ·  loads the Decap CMS admin

public/
└── config.yml            ← GENERATED from src/schemas — do not hand-edit
```

See `CLAUDE.md` for dev-server conventions and links to the Astro docs.

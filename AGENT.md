# Card Garden — agent guide

## Product intent

Card Garden helps people make playful board-game cards. The interface should feel warm, encouraging, and accessible to children and families: light backgrounds, clear language, generous spacing, and friendly colours. Avoid dark, overly technical, or intimidating visuals.

## Stack and conventions

- Use Next.js (App Router), React, TypeScript, and CSS.
- Prefer small, readable components and semantic HTML.
- Keep client-side state local until persistence is added.
- Do not introduce LLM calls until explicitly requested.
- Do not add a database dependency before implementing an actual persistence feature. PostgreSQL is the planned store.

## Assets and data

- Artwork intended for cards will live in `assets/cards/`.
- Card descriptions and project metadata should be structured so they can later be persisted in PostgreSQL and exported.
- Keep mock data clearly separated from production integrations when those are introduced.

## Quality checks

Before handing off a change, run when available:

```bash
npm run build
```

Check the main flow at desktop and mobile widths. Preserve the project dashboard and all four creator steps unless the requested change intentionally alters them.

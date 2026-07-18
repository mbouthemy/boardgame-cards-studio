# Boardgame Card Studio

A bright, child-friendly web app for creating board-game card collections. It is currently a UI prototype: users can name a project, establish its theme and atmosphere, sketch a collection of cards, and reach an export-ready state.

## Current scope

- Next.js + React interface
- Project dashboard and guided four-step card-creation flow
- Local mock data, PostgreSQL migrations, and an anonymous browser identity; no account login, uploads, exports, or AI calls yet
- A future-friendly place for supplied artwork: `assets/cards/`

## Getting started

Install Node.js 20+ and then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## PostgreSQL setup

1. Copy `.env.local.example` to `.env.local` and set `DATABASE_URL` to your PostgreSQL connection string.
2. Create a database named `boardgame_card_studio` (or use an existing database).
3. Start the app with `npm run dev`. It automatically runs every unapplied file in `migrations/` before Next.js starts.

Applied migrations are recorded in the `schema_migrations` table. The database client lives in `lib/db.ts` and is server-only. The current UI is still mock-data driven; wire this client into server actions or route handlers when persistence is added to the project flow.

## Anonymous users

On first load, the browser generates a UUID and stores it under `boardgame-card-studio-user-id` in `localStorage`. This is enough to associate projects with one browser while the app remains account-free. It is not secure authentication: clearing browser data or using another device creates a different identity.

## S3 image storage

Set `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` in `.env.local`. The server creates short-lived presigned URLs, so the browser uploads card artwork directly to S3 and PostgreSQL stores only the resulting object key.

The IAM principal needs `s3:PutObject` and `s3:GetObject` for the chosen bucket. Configure the bucket CORS policy so the local app can upload directly:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": []
  }
]
```

Add your deployed app origin to `AllowedOrigins` when deploying. Image reads are served through `/api/images` using a one-hour S3 download URL; keep the bucket private.

After importing cards from CSV, the artwork step accepts up to 20 images at once. Name a file `01.png` or `01.jpg` to attach it to CSV item number `1`; other valid image filenames are kept as general project artwork.

## OpenAI setup

Add `OPENAI_API_KEY` to `.env.local` when enabling AI generation. `OPENAI_IMAGE_MODEL` defaults to `gpt-image-2`. Keep the key server-only; it must never be exposed through a `NEXT_PUBLIC_` variable or committed to Git.

## Planned technical direction

The intended next increment is a lightweight full-stack Next.js app backed by PostgreSQL:

- **Next.js App Router** for pages, server actions, and API routes
- **PostgreSQL** for users, projects, card collections, cards, and asset metadata
- **Local/project asset ingestion** from `assets/cards/` and descriptions
- **Export pipeline** for printable/downloadable card assets

LLM-assisted generation is intentionally out of scope for now. Keep new work deterministic and focused on a friendly, easy-to-follow creation experience.

## Project structure

```text
app/
  page.tsx       # interactive prototype UI
  globals.css    # design system and responsive styles
  layout.tsx     # app metadata and global layout
```

See [AGENT.md](AGENT.md) for contribution conventions.

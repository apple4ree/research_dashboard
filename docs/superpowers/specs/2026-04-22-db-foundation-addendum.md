# DB Foundation Addendum

**Date:** 2026-04-22 (post-MVP)
**Supersedes:** §3 (Non-goals) item "Database, ORM, or API routes"

## Motivation

MVP shipped a UI shell backed by static mock data. User now wants:
- New/edit flows (projects, papers, experiments, discussions, replies) actually persist
- Filter bars on Experiments/Discussions to work
- Extensibility for pulling project metadata from GitHub (and later arXiv, HuggingFace) without redesigning the schema

## Goals

1. Replace `lib/mock/*.ts` as the runtime data source with a real database.
2. Preserve every existing page/component interface — no UI changes in Phase 11.
3. Ship a source-of-origin discriminator on every syncable entity so GitHub mirror, arXiv fetch, etc. can be added later without schema migration.

## Non-goals (still)

- Auth: Phase 11 keeps hardcoded `CURRENT_USER = 'dgu'`. Auth lands in a later phase.
- Realtime updates (websockets, live typing).
- External source sync (GitHub/arXiv). Schema supports it; implementation comes later.

## Tech stack

- **SQLite** via Prisma for MVP+1. File-based (`prisma/dev.db`), zero install, zero ops.
- **Postgres** upgrade path: one-line `provider` change in `schema.prisma` + new `DATABASE_URL`. Schema is compatible.
- **Prisma ORM** — canonical choice for Next.js + TypeScript; migration tooling built in.
- No auth library yet.

## Schema — new columns on every syncable table

Every entity that could be sourced from outside (Project, Paper, Release, Discussion, Reply, possibly Member/Experiment later) gets:

```prisma
source        String   @default("internal")  // 'internal' | 'github' | 'arxiv' | 'huggingface'
externalId    String?  @unique              // e.g., 'gh:example/reasoning-bench-v2'
lastSyncedAt  DateTime?
```

Internal records have `source = 'internal'`. External records have the other values. Upsert by `externalId`.

## Schema — entities

Mirror `lib/types.ts`:

- `Member` — PK `login` (string). Fields as existing type.
- `Project` — PK `slug`. Relations: `members` (M:N), `papers`, `releases`, `runs`, `events`.
- `Paper` — PK `id`. FK `projectSlug`. Authors as M:N to `Member`.
- `Release` — PK `id`. FK `projectSlug`.
- `ExperimentRun` — PK `id`. FK `projectSlug`. FK `triggeredByLogin`.
- `Discussion` — PK `id`. FK `authorLogin`. Has many `Reply`.
- `Reply` — PK UUID. FK `discussionId`, `authorLogin`.
- `Venue` — PK `id`. No source column (always internal).
- `ActivityEvent` — PK `id`. Discriminated `type` column. `payload` as JSON.

## Query layer

- `lib/db.ts` — Prisma client singleton (Next.js hot-reload-safe).
- `lib/queries/*.ts` — async versions of all `lib/mock/index.ts` helpers with identical signatures. E.g., `getProjectBySlug` becomes `async function getProjectBySlug(slug): Promise<Project | null>`.
- All pages import from `@/lib/queries` instead of `@/lib/mock`.
- Existing pages are already `async` server components — only change is `await` before each call.

## Seeding

- `prisma/seed.ts` reads the existing `lib/mock/*.ts` arrays (keep those files as seed fixtures, not as runtime data) and `prisma.entity.createMany(...)`.
- `pnpm db:seed` runs after `prisma migrate dev`.

## Extensibility for later GitHub sync (out of Phase 11 scope, design captured)

- Add column `source`, `externalId`, `lastSyncedAt` in Phase 11.
- Phase 13+ will add: `lib/sync/github.ts` that accepts a repo URL, fetches metadata via GitHub API, upserts with `source: 'github'`.
- UI rule (future): items with `source !== 'internal'` get "View on GitHub" link instead of Edit button.

## Acceptance criteria

- `pnpm db:migrate && pnpm db:seed` populates `prisma/dev.db` with all 12 members, 6 projects, 15 papers, 25 runs, 10 discussions (plus their replies), 9 releases, 12 events, 7 venues.
- All 32 existing Playwright tests still pass, backed by DB instead of mock.
- `pnpm build` clean.
- `pnpm exec tsc --noEmit` clean.
- Dev server renders identically to MVP.
- `lib/mock/*.ts` remain on disk but are only imported by `prisma/seed.ts`.

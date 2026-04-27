# LabHub

Internal research dashboard for **damilab** — a Next.js app that tracks
experiments, journal entries, milestones, todos, papers, releases, and a
project-scoped wiki. Live at **https://labhub.damilab.cc**.

LabHub also ships a Claude Code plugin marketplace with three skills that
researchers run from their own laptops to keep the dashboard in sync with
their daily progress notes.

## What's inside

- **Web app** — Next.js 16 + Prisma 7 (better-sqlite3 driver adapter) +
  NextAuth (GitHub OAuth) + Tailwind. Single SQLite file at
  `prisma/dev.db`.
- **REST API** — Bearer-JWT-authenticated endpoints under `/api/...` for
  every model the skills touch (entries, milestones, todos, runs,
  flow-events, wiki-types, wiki-entities). Tokens are minted by GitHub
  Device Flow at `POST /api/auth/device/exchange`.
- **3 skills** under `skills/`, each its own Claude Code plugin:
  - `labhub` — log experiment runs from chat
  - `labhub-flow-ingest` — sync `progress_*.md` → Flow J view (events + task links)
  - `labhub-wiki-ingest` — sync `progress_*.md` → Wiki entities (LLM-merge upsert)

## For lab members — installing the skills

The marketplace lives on GitHub at `apple4ree/research_dashboard`.

```bash
# 1) Add the marketplace
/plugin marketplace add apple4ree/research_dashboard

# 2) Install whichever skills you want
/plugin install labhub@labhub
/plugin install labhub-flow-ingest@labhub
/plugin install labhub-wiki-ingest@labhub

# 3) Authenticate once (creates ~/.config/labhub/token.json)
/labhub login
```

Token has a long expiry. Re-run `/labhub login` if you see 401s during ingest.

To update the skills after a server-side change:

```bash
/plugin update labhub-flow-ingest@labhub        # explicit update
# or, if update doesn't pick up changes:
/plugin uninstall labhub-flow-ingest@labhub && /plugin install labhub-flow-ingest@labhub
```

`/reload-plugins` alone does **not** fetch updates from GitHub — it only
re-reads the local cache.

## Skill 1: `labhub` (run logging)

Tell Claude in natural language and the skill talks to the API:

```
> labhub: 새 run 시작 — tick-agent에 v4 fresh 25-iter
> labhub: 방금 그 run 성공으로 마감, summary는 "fee 벽 0/80 돌파"
```

Under the hood: `POST /api/runs`, `PATCH /api/runs/:id`. The slug
defaults to whatever the user mentioned in chat; the skill picks tasks
and runs by id from `GET /api/projects/<slug>/todos`.

## Skill 2: `labhub-flow-ingest` (Flow J view)

For projects that capture daily progress as markdown under
`./progress/<researcher>/progress_<YYYYMMDD>_<HHMM>.md`. The skill:

1. Reads `~/.config/labhub/token.json`
2. `GET /api/projects/<slug>/todos` and `/flow-events` (existing context)
3. Globs `./progress/*/progress_*.md` from cwd; diffs against already-ingested sources
4. For each new file: Read tool → LLM extracts `{title, summary, tone, bullets, numbers, taskIds}` → `POST /api/flow-events`
5. Reports which events landed and their task links

Idempotent: re-running on already-ingested files is a no-op. Pass
`overwrite: true` in a single payload to replace a same-source row.

```
> labhub-flow-ingest tick-agent
> tick-agent의 progress 정리해줘
```

Format spec for progress files: see `docs/progress-format.md`.

## Skill 3: `labhub-wiki-ingest` (Wiki)

The wiki counterpart. Same input source (progress markdown), but the
output is a curated, evolving knowledge base of "entities" grouped by
admin-defined "types" (e.g., `attack`, `defense`, `concept`).

1. Auth precheck (same as flow ingest)
2. `GET /api/projects/<slug>/wiki-types`
   - **Empty?** Skill asks the user which categories to bootstrap, then
     creates them via `POST /api/wiki-types`. No need to leave chat.
3. `GET /api/projects/<slug>/wiki-entities` (light list + sourceFiles for dedupe)
4. Walk local `./progress/*/progress_*.md`; subtract files already in any
   entity's `sourceFiles`
5. For each new file:
   - LLM step 1: extract candidates (existing entity match vs new entity)
   - For matches: `GET .../wiki-entities/<id>` for full body → LLM step 2 merges existing + new snippet → `POST /api/wiki-entities` (upsert)
   - For new entities: LLM picks type+slug+name → `POST /api/wiki-entities`

Idempotency: each entity tracks the source filenames that contributed to
it; re-runs skip files already accounted for.

```
> labhub-wiki-ingest tick-agent
> tick-agent의 wiki 정리해줘
```

## Editing from the dashboard

Both Flow events and Wiki entities are **editable in the browser**:

- **Flow** (`/projects/<slug>/flow`) — each event card has 편집 / 삭제
  buttons in the top-right. Edit opens an inline form (title, summary,
  tone, bullets, numbers, linked task). Delete is two-click confirm.
- **Wiki** (`/projects/<slug>/wiki`) — each entity card surfaces 편집 /
  삭제 on hover. The detail page (`/wiki/<id>`) has the same buttons.
  Edit goes to a dedicated `/wiki/<id>/edit` page with side-by-side
  markdown editor + live preview.
- **Wiki types** — there's an inline manager at the top of
  `/projects/<slug>/wiki` for adding/removing types. The same actions
  are also exposed via `POST /api/wiki-types` and `DELETE
  /api/projects/<slug>/wiki-types/<key>` for skill-driven workflows.

## Local development

```bash
pnpm install
pnpm db:push          # creates/updates prisma/dev.db
pnpm dev              # http://localhost:3000

pnpm test             # full Playwright suite (api + cli + smoke)
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm build            # production build
```

If you switch Node versions, rebuild the better-sqlite3 native binding
to match (the prod pm2 process runs on Node v20):

```bash
PATH=/usr/bin:$PATH pnpm rebuild better-sqlite3
```

## Deployment

Production runs under pm2 (process name `labhub-app`) on the lab server,
behind a Cloudflare tunnel that terminates TLS and proxies to localhost.
Redeploy:

```bash
git push origin main
PATH=/usr/bin:$PATH pnpm build
pm2 restart labhub-app
```

## Repo layout

```
app/                  # Next.js app router pages + route handlers
  api/                #   - REST endpoints (Bearer JWT)
  projects/[slug]/    #   - per-project pages (flow, wiki, papers, …)
components/           # React components, organized by domain
lib/
  actions/            # Server actions (NextAuth session-based)
  api/                # Bearer auth helpers + error code union
  queries/            # Prisma read paths
  types.ts            # Shared TypeScript types (events, models)
prisma/schema.prisma  # Single source of truth for the data model
scripts/              # Admin CLIs (e.g. flow-ingest-cli — pre-skill V1 fallback)
skills/               # Claude Code plugins (one folder per skill)
tests/
  api/                # Bearer-API integration tests
  cli/                # CLI integration tests
  smoke/              # Playwright UI smokes
docs/superpowers/specs # Phase-by-phase design specs
```

## Design specs

Each major feature was brainstormed → spec'd → planned before being
built. The specs live in `docs/superpowers/specs/` and double as
historical context for why things look the way they do:

- Phase 5 — `2026-04-27-labhub-flow-ingest-v2.md`
- Phase 6 — `2026-04-27-labhub-wiki-ingest.md`
- Phase 7 — `2026-04-27-flow-wiki-edit.md`

## Status / contact

Dashboard maintained by **Minseok** (`dgu`). For new lab members, the
quickest path is:

1. Sign in to https://labhub.damilab.cc with your GitHub account
2. Ask Minseok to confirm your `Member` row + add you to the project(s)
   you work on
3. Install the skills from this marketplace and run `/labhub login`

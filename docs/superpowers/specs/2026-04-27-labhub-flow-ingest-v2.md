# labhub-flow-ingest V2 — Phase 5

**Date:** 2026-04-27
**Status:** Design draft, awaiting user approval
**References:**
- V1 spec: `docs/superpowers/specs/2026-04-27-labhub-flow-ingest.md`
- V1 implementation: 7 commits, head `08a2591`

## Motivation

V1's CLI binds the skill to one machine — the LabHub server itself.
The CLI uses Prisma directly against `prisma/dev.db` and reads files
under `<Project.localPath>` from the same disk. That works for the
lab admin (who runs Claude Code on the same box as `pm2 labhub-app`)
but excludes every other lab member: their progress markdown lives
on **their** laptop, not the server.

V2 inverts the boundary. The skill becomes a thin HTTP client that:

- Walks progress markdown on the **local** filesystem (the laptop where
  Claude Code runs).
- POSTs each extracted event to the LabHub server via the Bearer-JWT API.

Result: any lab member with `/labhub login` works can ingest their own
project's progress from anywhere. `Project.localPath` and
`Project.githubRepo` cease to be required for ingest (they remain in
the schema as optional metadata / UI source preview helpers).

## Goals

1. Skill works end-to-end from any machine — no LabHub repo clone,
   no Prisma DB access, no `cd $LABHUB_REPO`.
2. Two new HTTP endpoints serve the skill: `POST /api/flow-events`
   (create / overwrite) and `GET /api/projects/:slug/flow-events`
   (light list for idempotency / displays).
3. Token reuse: the same `~/.config/labhub/token.json` minted by
   `/labhub login` authenticates flow-ingest. No second login flow.
4. `localPath` and `githubRepo` become optional everywhere they
   gated functionality:
   - Removed from `POST /api/flow-events` validation
   - Removed from CLI's `get-project` and `list-new-progress` errors
   - Documented as "admin convenience for UI source preview" only

## Non-goals (explicit)

- **Deleting the V1 CLI.** It stays usable as an admin power tool
  (faster than HTTP, useful for one-shot ops on the server). Skill no
  longer calls it.
- **`POST /api/flow-event-task-links` as a separate endpoint.** Links
  ride inside the POST /api/flow-events body (`taskIds[]`), same as
  the CLI apply payload.
- **Changing the UI.** Empty-state copy still references
  `labhub-flow-ingest <slug>` — that string keeps working; we just
  point it at the V2 skill recipe.
- **Cross-project sweep** ("ingest all my projects"). Still one
  invocation per project.
- **Server-side `git pull`** before ingest. Skill assumes the local
  copy already has the files the user wants to ingest. Researcher
  manages their own checkout.
- **Wiki ingest.** Still separate phase.

## Architecture

```
[Lab member's laptop]                              [LabHub server]
   │
   $ cd ~/research/tick-agent
   $ claude
   > labhub-flow-ingest tick-agent
   │
   └── SKILL.md procedure:
       1. read $HOME/.config/labhub/token.json   (set up by /labhub login)
       2. GET /api/me                            ─────────────►  Bearer auth
       3. GET /api/projects/tick-agent/todos     ─────────────►
       4. GET /api/projects/tick-agent/flow-events ───────────►  ingested[] (NEW)
       5. local fs walk: ./progress/*/progress_*.md
       6. for each new file:
          - Read tool → markdown body
          - LLM extracts apply-payload JSON
          - POST /api/flow-events  ───────────────────────────►  insert + links (NEW)
       7. summary report to user
```

**Key invariant:** every step that touches DB goes through the LabHub
HTTP API. The skill never imports Prisma, never touches `prisma/dev.db`,
never needs to know the LabHub server's filesystem layout.

## File-format contract — UNCHANGED

Filename pattern, body markdown structure, extraction JSON schema,
tone taxonomy, task-mapping policy: all identical to V1 spec. A
progress file written for V1 ingests cleanly under V2.

The only relaxation: V2 doesn't require `Project.githubRepo` or
`Project.localPath` to be set in the LabHub DB. The researcher's local
checkout can sit at any path; the skill walks `./progress/` from the
current working directory.

## API endpoints (2 new)

### `POST /api/flow-events`

**Auth:** Bearer JWT.

**Request body** (matches CLI's apply payload exactly):

```jsonc
{
  "projectSlug": "tick-agent",
  "event": {
    "date": "2026-04-27 14:00",
    "source": "progress_20260427_1400.md",
    "title": "≤30 chars",
    "summary": "2-3 sentences",
    "tone": "milestone | result | pivot | design | incident",
    "bullets": ["..."],            // optional
    "numbers": [{ "label": "...", "value": "..." }],  // optional
    "tags": ["..."]                // optional
  },
  "taskIds": [13, 14, 16],          // optional, defaults to []
  "overwrite": false                 // optional, defaults to false
}
```

**Validation:**
- `projectSlug` → 404 `project_not_found` if missing.
- `event.tone` ∈ `{milestone, pivot, result, incident, design}` → 400 `invalid_request` otherwise.
- `taskIds` exist for this project → 400 `invalid_request` listing
  missing ids if any.
- `event.title` non-empty.
- `event.source` non-empty.

**Behavior** (same as CLI `apply`):
- If any `FlowEvent` exists with `(projectSlug, source)` and `overwrite=false` → 409
  `event_already_exists` (NEW error code).
- If `overwrite=true` and existing rows present, delete them (cascades
  to task links), then insert fresh.
- Insert `FlowEvent` row with provided fields, `position = max+1`.
- Insert `FlowEventTaskLink` rows for each `taskId`, `source: 'llm'`.
- `revalidatePath('/projects/<slug>/flow')` and
  `revalidatePath('/')`.

**Response 201:**
```json
{ "ok": true, "eventId": 47, "mode": "created", "taskLinks": 3 }
```

`mode` is `'updated'` when overwrite path was taken.

### `GET /api/projects/:slug/flow-events`

**Auth:** Bearer JWT.

**Behavior:** 404 `project_not_found` if slug missing. Returns light
list of events for the project ordered by `position desc`.

**Response 200:**
```json
{
  "events": [
    { "id": 47, "date": "2026-04-27 14:00", "source": "progress_20260427_1400.md",
      "title": "...", "tone": "result", "position": 12 }
  ]
}
```

(Light shape — omits `bullets/numbers/tags/summary` body. The skill only
needs `source` for idempotency; UI loads detail separately.)

## New error code

`event_already_exists` (status 409) — for `POST /api/flow-events`
duplicate-source attempts without `overwrite`. Added to
`lib/api/errors.ts` `ApiErrorCode` union.

## SKILL.md V2 body

Replace `skills/labhub-flow-ingest/SKILL.md` body. Frontmatter
unchanged (description still mentions trigger keywords). New body:

1. **Auth precheck** (mirrors `/labhub` skill's Step 2):
   - Read `$HOME/.config/labhub/token.json`
   - JSON-parse, verify `expiresAt` not past
   - Failure → tell user to `/labhub login` and stop
2. **Step 1 — Project meta** (replaces V1's `get-project`):
   - `GET $LABHUB_URL/api/me` (sanity / member.login for researcher subdir hint)
   - `GET $LABHUB_URL/api/projects/<slug>/todos` → tasks
   - `GET $LABHUB_URL/api/projects/<slug>/flow-events` → ingested sources (extract `source` field, dedupe)
3. **Step 2 — Walk local progress dir**:
   - From cwd, glob `./progress/*/progress_*.md`
   - Diff against ingested sources → `newFiles[]`
4. **Step 3 — Per file**:
   - Read tool on file path
   - LLM constructs apply-payload JSON (same schema as V1)
   - `POST $LABHUB_URL/api/flow-events` with Bearer
   - On 409 (already exists) → skip and note
   - On 4xx other → report and continue
5. **Step 4 — Summary**:
   - Same format as V1 (count, per-file breakdown, link to /projects/<slug>/flow)

**Constants in skill body:**
- `LABHUB_URL` = `https://labhub.damilab.cc` (or `$LABHUB_URL` env override)
- `TOKEN_FILE` = `$HOME/.config/labhub/token.json`

No `LABHUB_REPO`, no CLI path, no `cd` step. The skill does not need to
know where LabHub is checked out on the user's machine.

## CLI status

Keep as-is. Document in `scripts/flow-ingest-cli.ts` header comment:
"Admin power tool. Runs from the LabHub repo with direct DB access. The
labhub-flow-ingest skill no longer calls this — it goes through HTTP."

CLI's `get-project` and `list-new-progress` no longer require
`githubRepo` (relaxation: only `localPath` is required, since CLI does
walk the filesystem). For full V2 spirit we could relax `localPath` too
but the CLI's whole point is to walk a local checkout, so it stays.

## Schema

No schema changes. `FlowEvent` and `FlowEventTaskLink` are already
multi-event-per-source-tolerant (V2 schema state since PR #3 merge).

## API tests

`tests/api/flow-events.spec.ts` (new):

1. POST: missing bearer → 401.
2. POST: unknown projectSlug → 404 `project_not_found`.
3. POST: invalid tone → 400.
4. POST: unknown taskIds → 400 with list of missing ids.
5. POST: happy path → 201 + `{ok, eventId, mode: 'created', taskLinks}`.
6. POST: duplicate source without overwrite → 409 `event_already_exists`.
7. POST: duplicate source with `overwrite=true` → 200, `mode: 'updated'`,
   deletes prior same-source events.
8. GET list: returns event shape with `source/title/tone/position` keys,
   omits `bullets/numbers/tags/summary`.
9. GET list: unknown project → 404.

CLI tests (`tests/cli/flow-ingest-cli.spec.ts`) unchanged. They still
pass against the unchanged CLI.

## Acceptance criteria

- 9 new flow-events API tests pass.
- All 78 existing tests still pass.
- `tsc --noEmit` / `lint` / `build` clean.
- Updated `skills/labhub-flow-ingest/SKILL.md` references no `cd
  $LABHUB_REPO`, no CLI invocation.
- Manual smoke from a *non-server* machine succeeds: a researcher with
  `/labhub login` done can run `labhub-flow-ingest <slug>` from any
  directory containing `./progress/<self>/progress_*.md` and see the
  events appear at `/projects/<slug>/flow`.
- `Project.localPath` / `Project.githubRepo` not set on a project →
  ingest still works.

## Out-of-scope follow-ups

- Schema cleanup: drop `Project.githubRepo` / `Project.localPath` if
  consensus reaches "no V1 admin path needed anymore". Out of V2 scope.
- Wiki ingest equivalent (Phase 6).
- Skill auto-discovery of project slug from cwd (e.g., parse
  `package.json` or `.labhub/project` config). V2.5 polish.
- Server-side git operations (clone, pull, sync) — would re-introduce
  `localPath`/`githubRepo` dependency; deferred indefinitely.

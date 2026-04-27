# labhub-wiki-ingest — Phase 6

**Date:** 2026-04-27
**Status:** Design draft, awaiting user review
**References:**
- Flow ingest V2 spec: `docs/superpowers/specs/2026-04-27-labhub-flow-ingest-v2.md`

## Motivation

LabHub Wiki (`/projects/<slug>/wiki`) holds curated, evolving knowledge per
project — attacks, defenses, concepts, methods, etc. Today entities are
created and updated by hand through the wiki UI. Researchers already write
daily `progress_*.md` notes; those notes mention wiki-relevant facts (a
new attack variant was tested, a defense parameter was tuned, a concept
was redefined). We want a skill that walks the same progress files and
keeps the wiki in sync automatically.

This is the wiki counterpart to V2 flow-ingest. Same auth, same input
source, different downstream model.

## Goals

1. Skill works end-to-end from any machine — pure HTTP, no LabHub repo
   clone, reuses `~/.config/labhub/token.json` from `/labhub login`.
2. Skill auto-creates new WikiEntity rows and updates existing ones from
   progress markdown.
3. Same entity referenced across multiple progress files accumulates a
   single, well-merged body via LLM-merge (not append).
4. Idempotent: re-running on already-ingested files is a no-op.
5. 4 new HTTP endpoints serve the skill (3 GET, 1 POST upsert).

## Non-goals (explicit)

- **Combining with flow-ingest into one skill.** Separate skill, separate
  invocation. Same progress files get walked twice (once by each skill);
  acceptable trade-off for clean separation and independent re-runs.
- **WikiType creation.** Types are admin-configured in project settings;
  skill stops with a clear message if a project has no types.
- **Entity deletion / status transitions.** Manual via UI.
- **Comments / discussion ingestion.** Out of scope.
- **Cross-project sweep.** One invocation per project.
- **True duplicate detection.** If the LLM creates a new entity for a
  concept that already exists under a different id, the user resolves it
  manually in the wiki UI.

## Architecture

```
[Lab member's laptop]                              [LabHub server]
   │
   $ cd ~/research/tick-agent
   $ claude
   > labhub-wiki-ingest tick-agent
   │
   └── SKILL.md procedure:
       1. read $HOME/.config/labhub/token.json
       2. GET /api/projects/<slug>/wiki-types     ──►  { types[] }            (NEW)
       3. GET /api/projects/<slug>/wiki-entities  ──►  light list             (NEW)
       4. local fs walk: ./progress/*/progress_*.md
       5. union of all entities' sourceFiles → already-ingested set
       6. for each new file:
          - Read tool → markdown body
          - LLM step 1: candidate extraction
              (sees types + light entity list + progress body)
          - For each candidate:
              · existing match:
                  - GET /api/projects/<slug>/wiki-entities/<id>  (NEW)
                  - LLM step 2 (merge): existing body + new snippet → merged body
              · new entity:
                  - LLM picks type + slug-id + name + snippet
              - POST /api/wiki-entities (upsert)               (NEW)
       7. summary report
```

**Key invariant:** every step that touches DB goes through the LabHub HTTP
API. The skill never imports Prisma, never reads from `prisma/dev.db`,
never needs LabHub's filesystem layout.

## Input format — UNCHANGED

The skill walks `./progress/*/progress_*.md` from the user's cwd, exactly
as flow-ingest V2 does. Same file format (`docs/progress-format.md`).
No new sections required — wiki extraction reads the same body.

## API endpoints (4 new)

### `GET /api/projects/:slug/wiki-types`

**Auth:** Bearer JWT.
**Behavior:** 404 `project_not_found` if slug missing. Returns types ordered by `position asc`.
**Response 200:**
```json
{
  "types": [
    { "key": "attack", "label": "Attacks", "description": "..." }
  ]
}
```

### `GET /api/projects/:slug/wiki-entities`

**Auth:** Bearer JWT.
**Behavior:** 404 `project_not_found` if slug missing. Returns light list (no `bodyMarkdown`) ordered by `(type asc, id asc)`.
**Response 200:**
```json
{
  "entities": [
    {
      "id": "trigger_universal",
      "type": "attack",
      "name": "Trigger Universal",
      "status": "active",
      "summaryMarkdown": "...",
      "sourceFiles": ["progress_20260427_1400.md"],
      "lastSyncedAt": "2026-04-27T14:00:00.000Z"
    }
  ]
}
```

`sourceFiles` IS included — the skill needs it for per-file dedupe.

### `GET /api/projects/:slug/wiki-entities/:entityId`

**Auth:** Bearer JWT.
**Behavior:**
- 404 `project_not_found` if slug missing.
- 404 `entity_not_found` if entity id missing within project (NEW error code).
- Otherwise return full entity (same shape as light list + `bodyMarkdown`).

**Response 200:** as light list shape with `bodyMarkdown` added.

### `POST /api/wiki-entities`

**Auth:** Bearer JWT.
**Upsert by composite key `(projectSlug, id)`.**

**Request body:**
```jsonc
{
  "projectSlug": "tick-agent",
  "id": "trigger_universal",         // slug-style /^[a-z0-9_-]+$/
  "type": "attack",                  // must exist in project's WikiTypes
  "name": "Trigger Universal",
  "status": "active",                // optional, default 'active'
  "summaryMarkdown": "...",          // optional, default ''
  "bodyMarkdown": "...",
  "sourceFiles": ["progress_20260427_1400.md"]  // optional, default []
}
```

**Validation:**
- `projectSlug` required → 404 `project_not_found` if not found.
- `id` required, matches `/^[a-z0-9_-]+$/` → 400 `invalid_request` otherwise.
- `name` required, non-empty → 400 `invalid_request`.
- `type` required, must match a `WikiType.key` for this project → 400 `invalid_request` listing valid keys.
- `status`, if present, ∈ `{active, deprecated, superseded}` → 400 `invalid_request`.
- `bodyMarkdown` required (string, may be empty).
- `sourceFiles`, if present, must be an array of strings.

**Behavior:**
- Upsert via `prisma.wikiEntity.upsert` keyed by `{ projectSlug_id: { projectSlug, id } }`.
- `lastSyncedAt = now()`.
- `source = 'wiki-llm'` always (this endpoint represents skill-driven writes).
- `revalidatePath('/projects/<slug>/wiki')`.

**Response:**
- 201 + `{ ok: true, id, mode: 'created' }` when no prior row existed.
- 200 + `{ ok: true, id, mode: 'updated' }` when an existing row was overwritten.

## New error code

`entity_not_found` (status 404) — for `GET /api/projects/:slug/wiki-entities/:entityId` misses. Added to `lib/api/errors.ts` `ApiErrorCode` union.

## SKILL.md body

New skill folder: `skills/labhub-wiki-ingest/SKILL.md`. Frontmatter:
```yaml
---
name: labhub-wiki-ingest
description: |
  Walk a research project's local progress markdown, run LLM extraction,
  and upsert WikiEntity rows in LabHub Wiki via the REST API. Pure HTTP.
  Trigger: "labhub-wiki-ingest <slug>", "wiki ingest <slug>",
  "<slug>의 wiki 정리해줘".
---
```

Body sections:

1. **Step 0 — Auth precheck.** Read `$HOME/.config/labhub/token.json`,
   verify `expiresAt`. Failure → tell user to `/labhub login`, stop.

2. **Step 1 — Wiki context.**
   - `GET $LABHUB_URL/api/projects/<slug>/wiki-types`
   - `GET $LABHUB_URL/api/projects/<slug>/wiki-entities`
   - If types empty → tell user "WikiType 없음. UI에서 분류 먼저 설정", stop.

3. **Step 2 — Walk local progress dir.**
   - From cwd, glob `./progress/*/progress_*.md`.
   - Build `ingestedSet = union of every entity.sourceFiles`.
   - `newFiles = files \ ingestedSet`. If empty → "no new progress", stop.

4. **Step 3 — Per file.**
   - **3a.** Read the file body with the Read tool.
   - **3b. LLM step 1 (candidate extraction).** Prompt includes types,
     existing entity light list, and the progress body. Output:
     ```json
     [
       { "match": "trigger_universal", "newSnippet": "..." },
       { "newEntity": { "type": "concept", "id": "ablation_5way",
                        "name": "5-way ablation", "snippet": "..." } }
     ]
     ```
     Empty array → skip this file, continue.
   - **3c. Per candidate.**
     - **Existing match:** `GET …/wiki-entities/<id>` for full body. **LLM
       step 2 (merge):** existing body + new snippet → merged body and
       updated summary. `sourceFiles = existing + currentFile` (deduped).
       `POST /api/wiki-entities` (upsert).
     - **New entity:** LLM has already supplied type/id/name/snippet.
       Body = snippet, summary = one-sentence summary. `sourceFiles = [currentFile]`.
       `POST /api/wiki-entities`.
   - 4xx with `hint` → fix payload (e.g., drop bad type) and retry once.
     If still fails, skip this candidate, continue.

5. **Step 4 — Summary report.**
   ```
   ✓ Wiki ingest <SLUG>: <M> progress files processed
     + trigger_universal     (attack)   updated  ← progress_20260427_1400.md
     + ablation_5way         (concept)  created  ← progress_20260427_1400.md
     ⨯ progress_20260428_1100.md  — POST failed: <reason>

     $LABHUB_URL/projects/<SLUG>/wiki
   ```

**Constants:**
- `LABHUB_URL` = `https://labhub.damilab.cc` (or `$LABHUB_URL` env override)
- `TOKEN_FILE` = `$HOME/.config/labhub/token.json`

## marketplace.json

Add a third plugin entry next to `labhub` and `labhub-flow-ingest`:
```jsonc
{
  "name": "labhub-wiki-ingest",
  "source": "./skills/labhub-wiki-ingest",
  "description": "Mirror a project's progress markdown into LabHub Wiki entities (LLM-merge upsert).",
  "version": "0.1.0",
  "category": "research",
  "strict": true,
  "skills": ["./"]
}
```

## Schema

No schema changes. `WikiType` and `WikiEntity` already exist (PR #2).
`WikiEntity` is already keyed `(projectSlug, id)` and tracks `sourceFiles`,
`lastSyncedAt`, `source`.

## Middleware

Add to `lib/api/bearer-api` matcher in `middleware.ts`:
- `pathname.startsWith('/api/wiki-entities')`
- regex includes `wiki-types|wiki-entities`:
  `/^\/api\/projects\/[^/]+\/(entries|milestones|todos|flow-events|wiki-types|wiki-entities)/`

## Error handling matrix (skill side)

| Situation | Skill response |
|---|---|
| Missing/expired token | Stop, tell user to `/labhub login` |
| 401 mid-run | Stop, `/labhub login` |
| 404 `project_not_found` | Stop |
| `wiki-types` empty | Stop, "WikiType 없음. UI에서 분류 정의" |
| LLM step 1 returns `[]` | Skip file, continue |
| 400 `invalid_request` on POST | Read hint, fix payload (drop bad type or re-slug id), retry once. Then skip candidate. |
| Merge LLM returns empty body | Skip entity, note in summary |
| 5xx / network | Skip file, continue |
| GET /:entityId 404 (race) | Treat as new entity, POST as create |

## API tests — `tests/api/wiki-entities.spec.ts` (new)

1. POST: missing bearer → 401.
2. POST: unknown projectSlug → 404 `project_not_found`.
3. POST: type not in project's WikiTypes → 400 `invalid_request`.
4. POST: invalid id (`Trigger-Bad!`) → 400 `invalid_request`.
5. POST: invalid status → 400 `invalid_request`.
6. POST happy path (new) → 201, `mode: 'created'`.
7. POST same id again → 200, `mode: 'updated'`, body overwritten.
8. GET list: returns light shape (no `bodyMarkdown`), `sourceFiles` present.
9. GET list: unknown project → 404 `project_not_found`.
10. GET single: returns full entity with `bodyMarkdown`.
11. GET single: missing entity within existing project → 404 `entity_not_found`.
12. GET wiki-types: returns types in `position asc` order.
13. GET wiki-types: unknown project → 404 `project_not_found`.

## CLI tests

No CLI for V1 wiki. Skill-level behavior is non-deterministic (LLM extraction)
so it's verified by manual smoke instead.

## Acceptance criteria

- 13 new wiki API tests pass.
- All previously passing tests (≥110) still pass.
- `tsc --noEmit` / `lint` / `build` clean.
- `skills/labhub-wiki-ingest/SKILL.md` exists, references no `cd
  $LABHUB_REPO`, uses `$LABHUB_URL` HTTP.
- Marketplace `labhub-wiki-ingest` plugin entry resolves.
- Manual smoke from a non-server machine: a researcher with `/labhub
  login` done can run `labhub-wiki-ingest <slug>` and see entities created
  / updated at `/projects/<slug>/wiki`.
- Re-running with no new progress files reports "no new progress" and
  makes no API writes.

## Out-of-scope follow-ups

- Wiki ingest from sources other than progress markdown (papers, lab
  notebooks, slack threads).
- True semantic duplicate detection across entity ids.
- Wiki entity comments via API.
- Combined flow + wiki ingest in a single LLM pass for token savings.
- Per-progress-file ingest log table (currently sourceFiles union acts as
  the log; a dedicated `WikiIngestRun` table could harden idempotency).

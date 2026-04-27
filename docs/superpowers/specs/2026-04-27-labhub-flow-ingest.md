# labhub-flow-ingest Skill — Phase 4

**Date:** 2026-04-27
**Status:** Design draft, awaiting user approval
**References:**
- PR #3 (Flow J view): merged as `eba9260`. Empty-state UI advertises a `labhub-flow-ingest` skill that wasn't shipped.
- Professor's V1 implementation in fork `wj926/research_dashboard` at commit `d47132d`. Source-of-truth for the **format conventions** we adopt; we do **not** import that code wholesale because (a) it hardcodes paths to a different machine, (b) it targets V1 schema (`@@unique` on `(projectSlug, source)`, `eventSource` on links) which is no longer current, and (c) the professor signaled their fork is independent.

## Motivation

Phase 3 left FlowEvent rows un-creatable (PR #3 ships no createFlowEventAction; the UI's empty-state copy literally tells the user "say `labhub-flow-ingest <slug>` in Claude Code"). This phase delivers that skill so the empty-state hint becomes truthful and the Flow page becomes useful.

**Use case:** a researcher writes a daily progress markdown into the project's git checkout (`<localPath>/progress/<researcher>/progress_<YYYYMMDD>_<HHMM>.md`). When they want LabHub to reflect that work, they say `labhub-flow-ingest tick-agent` (or `tick-agent의 progress 정리해줘`) in Claude Code; the skill pulls the latest git, walks the new progress files, and converts each into a `FlowEvent` row plus links to the relevant `TodoItem`s (Flow page tasks).

## Goals

1. **One skill invocation, one project**, end-to-end: `git pull` → identify new progress files → LLM extracts structured events → write to LabHub DB → summary report.
2. **Adopt the professor's conventions verbatim** for filename pattern, body markdown structure, extraction JSON schema, tone taxonomy, and task-mapping policy. Cross-deploy compatibility: a progress file written for one LabHub instance ingests cleanly into another.
3. **Skill ships from this repo's marketplace** (already registered for `labhub`). Add a second plugin entry alongside.
4. **CLI handles all DB I/O.** The skill orchestrates; the LLM extracts; the CLI persists. No new HTTP API surface for V1.

## Non-goals (explicit)

- **Wiki ingest** — separate phase. PR #2's `scripts/import-wiki.ts` is left untouched.
- **HTTP `/api/flow-ingest`** — the professor's V2 UI button is out of scope; V1 is chat-driven only.
- **Cross-project bulk ingest** — one project per invocation.
- **Auto-cron** — manual invocation only.
- **Backfill of existing progress files into events** — only progress files **newer than already-ingested ones** are processed (idempotent re-runs are a no-op unless `--force`).
- **Editing or deleting existing FlowEvents** — UI handles that; this skill is create-only.
- **Extracting tasks from progress** — task creation is via `/labhub` skill's `todo.create` or the Flow page's edit mode. This skill only **links** events to **existing** tasks.

## Architecture

```
[User in Claude Code]
   │  "labhub-flow-ingest tick-agent"
   ▼
[labhub-flow-ingest SKILL.md]                        (loaded text instruction)
   │
   ├─► spawn:  pnpm tsx scripts/flow-ingest-cli.ts get-project --slug tick-agent
   │   ◄──────  JSON: { project, tasks[], wikiTypes[], ingestedSources[] }
   │
   ├─► spawn:  cd <localPath> && git pull --ff-only
   │   ◄──────  exit 0 or fail-fast
   │
   ├─► spawn:  pnpm tsx scripts/flow-ingest-cli.ts list-new-progress --slug tick-agent
   │   ◄──────  JSON: { progressRoot, files[] }
   │
   ├─► for each new file:
   │     - LLM uses Read tool on the file
   │     - LLM constructs the apply-payload JSON in conversation
   │     - spawn:  echo '<JSON>' | pnpm tsx scripts/flow-ingest-cli.ts apply
   │     - CLI persists FlowEvent + FlowEventTaskLink rows; returns { ok, eventId }
   │
   └─► summarize results to user
```

**Why CLI not HTTP API**: V1 is one machine (admin's laptop runs both Claude Code and LabHub). CLI gives the skill direct access to project metadata + task list in one round-trip, which the LLM needs for accurate task mapping. HTTP wrapper is V2 territory (when Claude Code runs on a different machine than LabHub).

## File-format contract (adopted from professor's V1)

### Location and filename

```
<Project.localPath>/progress/<researcher-id>/progress_<YYYYMMDD>_<HHMM>.md
```

- Glob: any file matching `^progress_.*\.md$` under any subdirectory of `<localPath>/progress/`.
- The subdirectory name is the researcher's identifier (e.g., `dgu`, `ys`). Multiple researchers per project supported.
- Example: `/home/dgu/research/tick-agent/progress/dgu/progress_20260427_1400.md`.

### Required prerequisites on `Project`

- `Project.githubRepo` — `"owner/repo"` form. Used for clone-on-demand (V2) and reporting; required by V1 for consistency with the professor's design.
- `Project.localPath` — absolute filesystem path to the local git checkout. Required.

If either is missing, the skill stops and asks the admin to set them via UI or SQL.

### Body markdown structure (semi-structured, recommended)

The CLI does **no** parsing of body content — it hands the raw markdown to the LLM, which extracts via the JSON schema below. Researchers may write any markdown, but for consistent extraction we recommend:

```markdown
---
date: 2026-04-27 14:00
researcher: dgu
---

# <한 줄 제목>

## Context
<왜 이걸 했나, 1-2 문단>

## Done
- <짧은 사실 1>
- <짧은 사실 2>

## Numbers / Metrics
| metric | value |
|---|---|
| MELON ASR | 0.305 |

## Next
- <후속 계획>
```

The recommendation will live in `docs/progress-format.md` (new, lab-facing documentation).

## Extraction JSON schema (the apply contract)

CLI's `apply` sub-command reads stdin JSON shaped exactly:

```jsonc
{
  "projectSlug": "tick-agent",
  "event": {
    "date": "2026-04-27 14:00",
    "source": "progress_20260427_1400.md",
    "title": "<≤30 chars>",
    "summary": "<2-3 sentences>",
    "tone": "milestone | result | pivot | design | incident",
    "bullets": ["...", "..."],          // optional, JSON array of strings
    "numbers": [                         // optional, JSON array
      { "label": "MELON ASR", "value": "0.305" }
    ],
    "tags": ["theme-x", "activity-y"]   // optional
  },
  "taskIds": [13, 14, 16],              // links to TodoItem.id
  "overwrite": false                     // re-apply if event for this source exists
}
```

### Tone taxonomy (exactly one per event)

| Tone | When to use |
|---|---|
| `milestone` | Setup, new tooling, start of a major change ("두 논문 트랙 셋업", "GPU 인프라 구축") |
| `result` | Completed experiment with results ("trigger × MELON 105/105 ASR 0.286") |
| `pivot` | Direction change, hypothesis abandoned ("sysframe 폐기 → trigger_fake 설계") |
| `design` | New experiment / structure design phase ("5종 ablation 라운드 설계") |
| `incident` | Debugging, outage, post-hoc fix ("YAML 파싱 버그", "OOM") |

If multiple tones overlap in a single progress file, pick the **central change** the file is reporting.

(`deprecated` from the schema's tone enum is intentionally excluded — that's a status flag for retired entities, not a research event.)

### Task-mapping policy

LLM compares the progress body against the project's existing `tasks[]` (from `get-project`) and emits `taskIds` for the tasks this progress advances:

- A task is mapped if its `text` / `goal` / `subtasks` is mentioned (directly or by clear synonym) in the progress.
- Typical 1-3 mappings per progress; rarely 0; uncommonly more than 3.
- **False positives are worse than false negatives** — if uncertain, drop.

## CLI: `scripts/flow-ingest-cli.ts`

Three sub-commands. All output JSON to stdout; errors to stderr with non-zero exit.

### `get-project --slug <slug>`

```jsonc
{
  "project": {
    "slug": "tick-agent",
    "name": "Tick Agent",
    "localPath": "/home/dgu/research/tick-agent",
    "githubRepo": "apple4ree/tick-agent"
  },
  "tasks": [
    { "id": 13, "bucket": "short", "title": "...", "goal": "...", "subtasks": [...], "status": "in_progress" }
  ],
  "wikiTypes": [
    { "key": "method", "label": "Methods", "description": "..." }
  ],
  "ingestedSources": ["progress_20260420_1100.md", "progress_20260421_0930.md"]
}
```

Errors with non-zero exit if project missing, or if `githubRepo` / `localPath` not set.

### `list-new-progress --slug <slug> [--force]`

Walks `<localPath>/progress/*/progress_*.md`. Returns:

```jsonc
{
  "progressRoot": "/home/dgu/research/tick-agent/progress",
  "files": [
    { "path": "/.../dgu/progress_20260427_1400.md", "source": "progress_20260427_1400.md", "ingested": false }
  ]
}
```

`--force` makes every file appear as `ingested: false` (reprocess all).

`source` (the bare filename) is the dedup key. The skill processes files where `ingested: false`.

### `apply` (reads JSON from stdin)

Validates payload (project exists, tone is allowed, taskIds belong to the project). Writes a `FlowEvent` row plus `FlowEventTaskLink` rows for each `taskId`.

#### Multi-event-per-source semantics (V2 schema)

Our schema drops the `@@unique([projectSlug, source])` constraint that V1 had — a single progress file could in theory generate multiple events. Our V1 skill, however, treats source as 1:1 (one file → one event):

- Default (`overwrite: false`): if **any** event with that source exists → return 409-style error (skill skips). Re-running the skill on the same file is a no-op.
- `overwrite: true`: skill deletes all existing events with that source for this project, then creates a fresh event + new links.

If a future V2 needs multi-event-per-source (e.g., one writeup with multiple results), we relax this on that skill rev — the schema already allows it.

#### Link source field

`FlowEventTaskLink.source: 'manual' | 'llm'`:
- All links created by this skill set `source: 'llm'`.
- Re-applying with `overwrite: true` deletes only `source: 'llm'` links — manual UI-created links survive.

#### Response

```jsonc
{ "ok": true, "eventId": 47, "mode": "created", "taskLinks": 3 }
```

Or with overwrite: `"mode": "updated"`.

## Skill body (`skills/labhub-flow-ingest/SKILL.md`)

The skill is loaded by Claude Code when the user invokes `/labhub-flow-ingest <slug>` (slash form) or implicitly via the description's trigger keywords. Body structure:

```
---
name: labhub-flow-ingest
description: Pulls progress files from a research project's git, runs LLM extraction, populates LabHub Flow J view (FlowEvents + task links). Trigger keywords: "labhub-flow-ingest", "flow ingest", "progress 정리", "<project>의 progress 정리해줘".
---

## When to invoke
## Constants  (LABHUB_REPO, CLI path, etc.)
## Step 1: get-project metadata
## Step 2: git pull
## Step 3: list-new-progress
## Step 4: per-file extract → apply
## Step 5: summary report
## Failure modes
```

`Constants`: `LABHUB_REPO=/home/dgu/research_dashboard` hardcoded for our deployment (admin overrides via env if they relocate). `CLI=$LABHUB_REPO/scripts/flow-ingest-cli.ts`.

The skill cd's to `$LABHUB_REPO` before invoking `pnpm tsx ...` so the Prisma client finds `prisma/dev.db`.

## Marketplace integration

`research_dashboard` repo is already a single-plugin marketplace (`labhub`). Phase 4 makes it a **two-plugin** marketplace.

`.claude-plugin/marketplace.json` gains a second `plugins[]` entry:

```json
{
  "name": "labhub-flow-ingest",
  "source": "./",
  "description": "Mirror a research project's progress files into LabHub Flow J view (FlowEvents + task links).",
  "version": "0.1.0",
  "category": "research",
  "skills": ["./skills/labhub-flow-ingest"]
}
```

Lab members' install command stays as documented:
```
/plugin marketplace add https://github.com/apple4ree/research_dashboard
/plugin install labhub-flow-ingest@labhub
```

(Both plugins share the same marketplace name `labhub`.)

## Test approach

This skill's behavior is mostly LLM extraction (untestable in a unit test) wrapped around CLI sub-commands (testable). Testing scope:

1. **CLI sub-command unit-ish tests** in `tests/api/flow-ingest-cli.spec.ts` (Playwright HTTP fixture isn't apt — these aren't HTTP routes; use Node's `child_process.execSync` to invoke the CLI):
   - `get-project` returns shape, errors on missing project, errors on missing `localPath`/`githubRepo`.
   - `list-new-progress` returns the right files for a fixture progress dir, marks ingested correctly.
   - `apply` rejects invalid tone, rejects unknown taskIds, creates event+links on happy path, idempotent without `--force`, replaces with `--force`.

2. **Schema fixture in globalSetup**: ensure `Project.tick-agent` (or similar) exists with `githubRepo` and `localPath` set, plus a temp progress directory with one file.

3. **Manual end-to-end smoke** (in acceptance): admin runs the skill against `tick-agent` once, verifies events appear in `/projects/tick-agent/flow`.

## Acceptance criteria

- `pnpm exec tsc --noEmit` clean.
- `pnpm lint` clean.
- `pnpm build` clean.
- New CLI tests pass.
- Existing 67 API tests still pass.
- Manual smoke: against a real project with `localPath` + `githubRepo` set + at least one progress file → `/labhub-flow-ingest <slug>` populates Flow page within ~2 minutes.
- Empty-state UI hint becomes truthful (the skill it advertises now exists at `/plugin install labhub-flow-ingest@labhub`).

## Out-of-scope follow-ups

- **Wiki ingest equivalent** (Phase 5).
- **HTTP `/api/flow-ingest` + UI button** (V2, Phase 6).
- **Multi-event per source** (when a writeup describes multiple distinct results).
- **Cross-machine usage** (skill on lab member's laptop, LabHub on server) — needs HTTP API.
- **Auto-detect new progress via cron / git hook**.
- **Wiki section in get-project response** is informational only in V1; V2 may use it for actual wiki ingest in the same skill.

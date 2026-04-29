# "Refresh from git" Dashboard Button — Plan

**Date:** 2026-04-28
**Status:** Plan saved, implementation deferred
**Background:** labhub2 (PI dev instance) ships a one-click "Refresh from
git" button on the Flow page. Lab members have asked for parity. This
document captures the plan we discussed; pick it back up when staffing
allows.

## What labhub2's button does

Trigger from `/projects/<slug>/flow`:

1. `git pull --ff-only` in the project's server-side checkout
   (`Project.localPath`)
2. `spawn('claude --print --dangerously-skip-permissions <prompt>')` —
   Claude Code subprocess invokes the `labhub-flow-ingest` skill
3. Skill walks `progress/<id>/progress_*.md`, extracts events/tasks via
   LLM, applies via the V1 CLI (or HTTP for V2)
4. Server captures `before`/`after` row counts → response delta:
   `{ events:+N, tasks:+M, wiki:+K }`
5. Browser shows result box with delta + duration + "로그 보기" toggle
6. `router.refresh()` reloads the Flow page

## Why we paused

Replicating exactly couples LabHub to:

- a single Claude Max account (`dami` on labhub2; would be `dgu` on us)
- server-side git clones for every active project (`Project.localPath`)
- `--dangerously-skip-permissions` (security smell)
- absent concurrency control (their spec admits "lock 없이 사용자 책임")
- a hardcoded wiki mirror script per project (`import-stealthy-wiki.ts`)

V2 of `labhub-flow-ingest` (Phase 5) deliberately moved ingest to the
researcher's laptop to avoid these. Bringing them back gates new project
onboarding behind admin SSH and concentrates LLM quota on one person.

## Plan when we revisit

### Pre-flight on the server (operations)

- `claude` CLI installed for the running pm2 user
- `~/.config/labhub/token.json` valid (used by spawned Claude through
  the V2 skill)
- For every project to be ingested:
  - `Project.githubRepo` set
  - `Project.localPath` set, directory exists, `.git` present, default
    branch ff-pullable

### Schema

No changes. Reuses `FlowEvent`, `TodoItem`, `WikiEntity` and the
existing `Project.githubRepo` / `Project.localPath` columns.

### `POST /api/flow-ingest` (server endpoint)

- Auth: NextAuth session (browser only). No Bearer surface.
- Body: `{ slug: string }`
- Validation: slug regex `^[a-z0-9-]+$` (shell-injection safety)
- Project preconditions:
  - Project exists
  - `githubRepo` and `localPath` both non-null
  - `<localPath>/.git` directory exists
- **In-memory project-level lock.** Map<slug, true>. Concurrent click
  returns 409 `ingest_in_progress`.
- Snapshot `before` counts: FlowEvent / TodoItem / WikiEntity for slug
- `git -C <localPath> pull --ff-only` via `execFile`
  (avoid shell interpolation; on non-ff or conflict, abort with
  stdout/stderr in response)
- `spawn('claude', ['--print','--dangerously-skip-permissions', prompt])`
  with `cwd: localPath` (so the skill's `./progress/*/progress_*.md`
  glob resolves correctly)
- Pipe stdout/stderr; max duration 300s (mirror labhub2)
- After exit, snapshot `after`, compute delta, release lock
- Response shape:
  ```ts
  {
    ok: boolean;
    code: number;
    delta:  { events: number; tasks: number; wiki: number };
    before: { events: number; tasks: number; wiki: number };
    after:  { events: number; tasks: number; wiki: number };
    stdout: string;
    stderr: string;
    durationMs: number;
    error?: string;
  }
  ```

### `RefreshFromGitButton` (client component)

- States: idle / loading / success / empty / fail
- POSTs to `/api/flow-ingest`
- Result box (next to button):
  - empty: gray, "동기화할 거 없음"
  - success: green, `events +N · tasks +M · wiki +K · 42.3s`
  - fail: red, error message
- "로그 보기" toggle exposes stdout/stderr in `<details>`
- On success, `startTransition(() => router.refresh())`

### Wire

Add the button to `/projects/<slug>/flow` header, next to "수정 모드"
toggle. Hide when project lacks `githubRepo` or `localPath` (instead of
showing a perpetually-failing button).

### Differences from labhub2 (intentional)

| labhub2 | Us (planned) |
|---|---|
| Step 3 hardcoded `import-stealthy-wiki.ts` | Skip; wiki ingest stays separate via `labhub-wiki-ingest` skill |
| Spawn cwd = LabHub repo | Spawn cwd = `Project.localPath` (skill's glob expects this) |
| Recipe uses V1 CLI directly | Spawned Claude calls our HTTP API (V2 skill flow), simpler + reuses what's deployed |

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cloudflare Tunnel timeout on 1–2 min request | Test first; if tripped, switch to async (job id + polling) |
| Single Claude session quota shared by all clickers | Document; rate-limit at API layer if abuse appears |
| Prompt injection via committed progress content | Trust boundary = lab members with commit access. Document in security notes. |
| `git pull` non-ff state on server checkout | Abort with clear message; admin resolves |

### Out of scope for V1 of this button

- SSE / streaming progress (current model: spawn-and-wait)
- Cron / scheduled re-ingest
- Wiki LLM ingest from same button (use `labhub-wiki-ingest` skill)
- Per-user audit beyond ActivityEvent

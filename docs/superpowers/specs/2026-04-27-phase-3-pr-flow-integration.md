# Phase 3 ↔ PR-Flow Integration

**Date:** 2026-04-27
**Status:** Design draft, awaiting user approval
**References:**
- Phase 3 spec: `docs/superpowers/specs/2026-04-26-skill-automation-phase-3.md`
- Phase 3 plan: `docs/superpowers/plans/2026-04-26-skill-automation-phase-3.md`
- PR #2 (wiki): merged as `b247819`
- PR #3 (flow): merged as `eba9260`

## Motivation

Phase 3 added 13 JWT REST endpoints over the existing `ResearchEntry`,
`Milestone`, and `TodoItem` schemas. While Phase 3 was in development,
PR #3 (Flow J view) merged a parallel set of changes that extend
`TodoItem` with four new fields and introduce a server-action policy
where the new `status` column — not the legacy `done: Boolean` — is the
source of truth for completion state.

The merge between Phase 3 (locally) and PR #3 (origin) was conflict-free
at the file level, but it leaves a semantic gap: a skill client that
calls `PATCH /api/todos/:id` with `{done: true}` flips the legacy
boolean while leaving `status='in_progress'` (the schema default),
producing rows where the two completion signals disagree. The Flow
kanban will render those rows as "in progress" even though the API
caller asked for done.

This integration commit closes that gap and exposes the new fields
through the JWT API so a future skill recipe can populate them.

## Scope

**In scope:**
1. Extend `POST /api/todos` to accept the four new optional fields
   (`goal`, `subtasks`, `status`, `group`).
2. Extend `PATCH /api/todos/:id` to accept the same four fields and to
   keep `done` and `status` in sync on every write.
3. Add validators + tests for the new fields and for the sync invariant.
4. Update `skills/labhub/SKILL.md` `todo.create` and `todo.update`
   recipes with the new fields and natural-language mappings.
5. Side fix: clean up the two ESLint errors in
   `components/flow/TaskKanbanLive.tsx` that PR #3 introduced (CI is
   currently broken on `pnpm lint`).

**Out of scope:**
- Backfill — existing `TodoItem` rows have `status='in_progress'` by
  schema default; we are not retro-aligning their `done` against
  `status` (that's a one-time data migration, not API logic).
- Wiki API endpoints — PR #2 added the `WikiType` / `WikiEntity` models
  but no skill use case is identified yet. Defer to Phase 4 if needed.
- Flow event endpoints — `FlowEvent` / `FlowEventComment` /
  `FlowEventTaskLink` are likewise out of scope; the skill has no
  natural-language entry point for them yet.
- Migrations — already applied to dev DB and live in `prisma/migrations/`.

## The sync invariant

After this commit, every write to `TodoItem` through Phase 3 endpoints
must obey:

```
status === 'done'   ⇔   done === true
status !== 'done'   ⇔   done === false
```

`status` is the **source of truth**; `done` is a derived legacy mirror.
PR #3's server actions already enforce this via
`done: (status === 'done')` on every write
(`lib/actions/flow-tasks.ts`). The Phase 3 REST API adopts the same
policy.

### Resolution rule for body inputs

Order of precedence (server-side, applied identically in POST and PATCH):

1. **`status` present in body** → `status` is used verbatim.
   `done` is derived: `done = (status === 'done')`. If the caller also
   sent `done`, it is **silently ignored** (override) — `status` wins.
2. **`status` absent, `done` present** → `done` is used verbatim.
   `status` is derived: `status = done ? 'done' : 'in_progress'`.
3. **Neither present in body** → don't touch either column.

This means a contradictory payload like `{done: true, status: 'pending'}`
is accepted as `{status: 'pending', done: false}`. The response always
returns the resolved canonical state, so the caller sees the rewrite
immediately and can detect their mistake.

Why override over error: PR #3's UI never sends `done`; existing skill
recipes never send `status`. Each consumer uses one key. The rare case
of "both keys, contradictory" is almost certainly a client bug, but
silently aligning to `status` is friendlier than 400 and consistent
with PR #3's source-of-truth model.

## API surface changes

### `POST /api/todos`

New optional body fields, all nullable in DB:

| Field | Type | Default if omitted |
|---|---|---|
| `goal` | `string \| null` | null |
| `subtasks` | `string[]` | null (stored as null, not `'[]'`) |
| `status` | `'pending' \| 'in_progress' \| 'done'` | `'in_progress'` |
| `group` | `string \| null` | null |

Validation:
- `status` validated via new `isTaskStatus` guard.
- `subtasks` must be an array of strings if present.
- `done` defaults follow the sync invariant: `done = (status === 'done')`.

### `PATCH /api/todos/:id`

Same four new optional fields. Sync invariant applies on every PATCH
that touches `done` or `status`. Both keys present in same body → 400.

Activity event mapping unchanged from Phase 3:
- `done: false → true` → `'completed'`
- `done: true → false` → `'reopened'`
- `status: 'done' → other` → `'reopened'`
- `status: other → 'done'` → `'completed'`
- All other field updates → `'updated'`

## SKILL.md updates

`### todo.create` recipe gains four optional inputs documented:
- "목표" / "goal" → `goal`
- "subtasks" / "하위 작업" → `subtasks` (newline or comma-separated)
- "상태" / "status" → `status`
- "그룹" / "epic" / "group" → `group`

`### todo.update` recipe gains:
- NL mapping: "pending" / "대기" → `{status: 'pending'}` (queued, not done, not actively working)
- "다시 시작" / "이어서" / "in progress" → `{status: 'in_progress'}`
- Unchanged: "done" / "끝" / "완료" → `{done: true}` (still works; server syncs status)

The done-toggle recipe stays the simplest path — skill clients that
only want to mark a todo done don't need to learn the new status enum.

## Validator additions

`lib/api/validators.ts`:

```ts
import type { TaskStatus } from '@/lib/types/flow';

export const TASK_STATUSES: readonly TaskStatus[] =
  ['pending', 'in_progress', 'done'];

export function isTaskStatus(s: unknown): s is TaskStatus {
  return typeof s === 'string' && (TASK_STATUSES as readonly string[]).includes(s);
}
```

`TaskStatus` is exported from `lib/types/flow.ts` (added by PR #3).
Import path: `import type { TaskStatus } from '@/lib/types/flow'`.

## Test additions

`tests/api/todos.spec.ts`, appended:

1. POST with `status='done'` → row has `done=true`.
2. POST with `status='pending'` → row has `done=false`.
3. POST with `{done: true, status: 'pending'}` → status wins:
   resulting row has `status='pending', done=false`.
4. PATCH `{done: true}` → row has `status='done'`.
5. PATCH `{done: false}` after a 'done' row → row has
   `status='in_progress'`.
6. PATCH `{status: 'pending'}` → row has `done=false`.
7. PATCH `{goal, subtasks, group}` → all three persist; verify via GET.
8. POST with `subtasks` as string (not array) → 400.
9. POST with invalid `status='bogus'` → 400.

## Side fix: TaskKanbanLive lint errors

`components/flow/TaskKanbanLive.tsx:432` has two unescaped apostrophes
that fail `react/no-unescaped-entities`. Replace with `&apos;`. This
keeps `pnpm lint` green so the repo's CI gate works.

The five `no-unused-vars` warnings in the same file are non-blocking
(they're `warn`, not `error`) but trivial to fix while we're there —
remove the unused imports.

## Acceptance criteria

- `pnpm exec tsc --noEmit` clean
- `pnpm lint` clean (two errors gone, warnings cleared)
- `pnpm build` clean
- `pnpm exec playwright test tests/api/ --workers=1` passes 58 prior +
  ~8 new = ~66 cases.
- `prisma migrate status` shows nothing pending.
- A manual curl against `/api/todos` with `{status: 'done'}` produces a
  row visible in the Flow kanban as completed.

## Out-of-scope follow-ups (not addressed here)

- Two-worker test flake on milestone auto-position test (pre-existing,
  flagged in Phase 3 review).
- Status-driven activity events for direct status writes that don't
  touch `done` (current activity logger keys off `done` flips; under the
  sync invariant the actions still fire correctly, but the code path is
  worth simplifying once we have time).
- Optionally promoting the validator-helper file `lib/api/validators.ts`
  to also export the `'pending' | 'in_progress' | 'done'` tuple alone
  so non-API consumers can import.

# Skill Automation — Phase 3 (Entry / Milestone / Todo CRUD)

**Date:** 2026-04-26
**Status:** Design approved, ready for implementation plan

## Motivation

Phase 1 + 2 made `ExperimentRun` reachable from the LabHub skill. The
remaining day-to-day write surface — research journal **entries**,
project **milestones**, and **todos** — is structurally simple
(project-scoped rows with text fields) and benefits from chat dictation
much more than from a UI form. The same lab member who happily types
`/labhub start a run …` should also be able to dictate a meeting
summary or add a todo without leaving the terminal.

This phase adds full CRUD + list endpoints for those three entities,
and extends the skill's intent table accordingly. Read endpoints are
included so questions like "내 todo 뭐 남았어?" and "이 프로젝트의
지난 entries 보여줘" are answerable from chat.

## Goals

1. Three entities reachable end-to-end via JWT-authenticated REST:
   create, read (list + detail), update, delete.
2. Composite entry creation: a single POST creates an entry **and** its
   slides + artifacts in one round-trip, since meeting writeups are
   produced as a unit.
3. Skill (`SKILL.md`) extended with the matching intents, natural-language
   mappings (Korean + English), and recipes.

## Non-goals (explicit)

- File uploads. `EntryArtifact.href` stays a string URL; multipart
  upload (S3, etc.) is a separate phase.
- Pagination / filtering on list endpoints. Lab-scale data is small
  enough; a project's entries/todos/milestones rarely exceed 100 rows.
- Drag-reorder of slides or milestones. Position is settable on
  create / update; full drag UX stays in the web UI.
- Slide-by-slide patching (e.g., `PATCH /api/slides/:id`). Slide edits
  go through the parent `PATCH /api/entries/:id` with the full new
  `slides` array (wholesale replacement). Same for artifacts.
- Skill-side caching of list results. Every list intent is a fresh
  GET; LLM keeps response in conversation.

## Architecture

Identical pattern to Phase 1: route handlers under `app/api/`, JWT
gate via `requireMemberFromBearer`, activity logged via `logActivity`,
domain objects mapped through `lib/queries/index.ts` helpers.

```
[Skill]                                     [LabHub]
   │                                            │
   │  POST /api/entries                         │
   │   Authorization: Bearer <JWT>              │
   │   { projectSlug, date, type, title,        │
   │     summary, bodyMarkdown, tags?,          │
   │     slides?[], artifacts?[] }              │
   │                                            │
   │  ─────────────────────────►  requireMemberFromBearer
   │                              prisma.researchEntry.create({
   │                                data: {...}, slides: nested,
   │                                artifacts: nested
   │                              })
   │                              logActivity(entry, created)
   │                              revalidatePath
   │                                            │
   │   ◄─── { id: "e-..." }                     │
```

Same shape for milestones and todos, minus the nested sub-entities.

## API endpoints (13 new)

### Journal entries

#### `POST /api/entries`

**Auth:** Bearer JWT.

**Request:**
```json
{
  "projectSlug": "klass-unlearning",
  "date": "2026-04-26",
  "type": "meeting",
  "title": "주간 미팅 — temperature 결정",
  "summary": "T={0.5, 1.0, 2.0} sweep 결과",
  "bodyMarkdown": "## 회의록\n\n- ...",
  "tags": ["meeting", "decision"],
  "slides": [
    {
      "kind": "discovery",
      "title": "T=1.0 is best",
      "body": "retention 0.80 vs 0.65",
      "chip": null,
      "metricsJson": "{\"retention\":0.80}",
      "code": null
    }
  ],
  "artifacts": [
    {
      "type": "notebook",
      "title": "sweep notebook",
      "href": "https://github.com/.../sweep.ipynb"
    }
  ]
}
```

**Validation:**
- `projectSlug` must exist (else 404 `project_not_found`).
- `type` ∈ `meeting | report | experiment | review`.
- Each slide's `kind` ∈ `discovery | failure | implement | question | next | metric`.
- Each artifact's `type` ∈ `notebook | figure | sheet | csv | doc | slide`.
- `slides` array can be empty / omitted (entry without explicit slides).
- `artifacts` array can be empty / omitted.

**Behavior:**
- Generate id `e-<base36 timestamp>` with `randomUUID().slice(0,4)` collision suffix (mirroring run id generation).
- `authorLogin` = JWT subject.
- Slides get `position` 1, 2, … in order received.
- Artifacts get `position` 0, 1, … in order received.
- Tags stored as JSON string per existing schema convention.
- `logActivity({ type: 'entry', actorLogin, projectSlug, payload: { entryId, action: 'created' } })`.
- `revalidatePath('/projects/<slug>')`, `revalidatePath('/')`.

**Response 201:** `{ "id": "e-..." }`

#### `GET /api/projects/:slug/entries`

**Auth:** Bearer JWT.

**Behavior:**
- 404 `project_not_found` if slug missing.
- Returns light list — `bodyMarkdown` and nested arrays excluded.
- Order: `date` desc, then `id` desc.

**Response 200:**
```json
{
  "entries": [
    {
      "id": "e-...",
      "projectSlug": "klass-unlearning",
      "date": "2026-04-26T00:00:00.000Z",
      "type": "meeting",
      "title": "...",
      "summary": "...",
      "tags": ["meeting"],
      "authorLogin": "dgu"
    }
  ]
}
```

#### `GET /api/entries/:id`

**Auth:** Bearer JWT.

**Behavior:** 404 `entry_not_found` if absent. Returns full entry including `bodyMarkdown`, `slides[]`, `artifacts[]`.

**Response 200:** the full entry domain object (mirrors what the UI loader returns).

#### `PATCH /api/entries/:id`

**Auth:** Bearer JWT.

**Request:** any subset of entry-level fields (`date, type, title, summary, bodyMarkdown, tags`) plus optional `slides[]` and `artifacts[]`.

**Behavior:**
- 404 if entry id missing.
- 401 unchanged from Phase 1 patterns.
- If `slides` is in the body (even empty array), **wholesale replace**: delete all existing slides for this entry, insert provided ones. Same for `artifacts`. If the key is absent from the body, slides/artifacts left untouched.
- `authorLogin` is **not** mutable.
- `logActivity({ type: 'entry', actorLogin: <editor login>, projectSlug, payload: { entryId, action: 'updated' } })`.
- Lab-trust authorization: any authenticated Member may PATCH.

**Response 200:** the full updated entry domain object.

#### `DELETE /api/entries/:id`

**Auth:** Bearer JWT.

**Behavior:**
- 404 if entry id missing.
- Cascade: existing schema's `onDelete: Cascade` on `EntrySlide` / `EntryArtifact` handles sub-rows.
- `logActivity({ ..., action: 'deleted' })`.
- Returns 204 (no body).

### Milestones

#### `POST /api/milestones`

**Request:**
```json
{
  "projectSlug": "klass-unlearning",
  "date": "2026-05-31",
  "label": "submission",
  "status": "future",
  "note": "NeurIPS deadline",
  "position": 4
}
```

**Validation:**
- `status` ∈ `past | now | future`.
- `position` optional; if omitted, append at end (max(position) + 1).

**Behavior:**
- 404 if project missing.
- `id` auto-increment (Prisma default).
- `logActivity({ type: 'milestone', actorLogin, projectSlug, payload: { milestoneId, action: 'created' } })`.

**Response 201:** `{ "id": <int> }`

#### `GET /api/projects/:slug/milestones`

Returns all milestones for a project ordered by `position` asc. Response shape: `{ "milestones": [...] }`.

#### `PATCH /api/milestones/:id`

Partial update. Same lab-trust auth. `logActivity` with `action: 'updated'`.

#### `DELETE /api/milestones/:id`

204 on success. `logActivity` with `action: 'deleted'`.

### Todos

#### `POST /api/todos`

**Request:**
```json
{
  "projectSlug": "klass-unlearning",
  "bucket": "short",
  "text": "데이터 정제 스크립트 리팩터",
  "position": 0
}
```

**Validation:**
- `bucket` ∈ `short | mid | long`.
- `text` non-empty.
- `position` optional; if omitted, append within the bucket.

**Behavior:**
- `done` defaults to `false`.
- `logActivity` with `action: 'created'`.

**Response 201:** `{ "id": <int> }`

#### `GET /api/projects/:slug/todos`

Returns all todos for the project, ordered by `bucket, position` asc. Response shape: `{ "todos": [...] }`.

#### `PATCH /api/todos/:id`

Partial update. Toggling `done: true` logs `action: 'completed'`; flipping back to `false` logs `action: 'reopened'`. Other field updates log `action: 'updated'`.

#### `DELETE /api/todos/:id`

204. `logActivity` with `action: 'deleted'`.

## Authorization

Same lab-trust policy as Phase 1: any authenticated Member can perform
any mutation. Rationale unchanged — single small lab, every action's
actor is recorded in the activity feed (`actorLogin = JWT subject`),
so attribution survives even when X edits Y's row. The original
`authorLogin` on entries stays bound to the creator and is not
re-writable through PATCH.

## Activity events — new types

`lib/types.ts` `EventType` union extended with three new variants:

```ts
export type EntryEventAction     = 'created' | 'updated' | 'deleted';
export type MilestoneEventAction = 'created' | 'updated' | 'deleted';
export type TodoEventAction      = 'created' | 'completed' | 'reopened'
                                 | 'updated' | 'deleted';

export type EntryEvent     = { type: 'entry';     payload: { entryId: string;     action: EntryEventAction } };
export type MilestoneEvent = { type: 'milestone'; payload: { milestoneId: number; action: MilestoneEventAction } };
export type TodoEvent      = { type: 'todo';      payload: { todoId: number;      action: TodoEventAction } };

// Existing union extended:
export type ActivityEvent = PaperEvent | ExperimentEvent | ReleaseEvent
                          | DiscussionEvent | ProjectEvent
                          | EntryEvent | MilestoneEvent | TodoEvent;
```

`logActivity` (Phase 1) is generic over `EventType` — adding three
variants doesn't change its signature, just the `PayloadFor<T>`
mapping. `ActivityFeedItem` (UI component) needs corresponding
rendering branches.

## Validation helpers

`lib/api/validators.ts` (new):

```ts
export const ENTRY_TYPES     = ['meeting', 'report', 'experiment', 'review'] as const;
export const SLIDE_KINDS     = ['discovery', 'failure', 'implement', 'question', 'next', 'metric'] as const;
export const ARTIFACT_TYPES  = ['notebook', 'figure', 'sheet', 'csv', 'doc', 'slide'] as const;
export const MILESTONE_STATS = ['past', 'now', 'future'] as const;
export const TODO_BUCKETS    = ['short', 'mid', 'long'] as const;
```

Centralizes the enums so route handlers and validators don't duplicate them.

## Skill changes (`skills/labhub/SKILL.md`)

### New intents (8)

Existing 5 + 8 new = 13 total. The intent table grows:

| Pattern | Intent | API |
|---|---|---|
| "entry 추가 / 회의록 정리 / journal 작성" | `entry.create` | POST /api/entries |
| "그 entry 수정 / 슬라이드 추가" | `entry.update` | PATCH /api/entries/:id |
| "그 entry 삭제" | `entry.delete` | DELETE /api/entries/:id |
| "이 프로젝트 entries 목록 / 지난 회의록" | `entry.list` | GET /api/projects/:slug/entries |
| "milestone 추가 / 마일스톤 추가" | `milestone.create` | POST /api/milestones |
| "milestone 수정 / 삭제 / 보여줘" | `milestone.update / delete / list` | PATCH / DELETE / GET |
| "todo 추가 / 그거 done / todo 보여줘" | `todo.create / update / list` | POST / PATCH / GET |
| "todo 삭제" | `todo.delete` | DELETE /api/todos/:id |

### Natural-language mappings (added to SKILL.md)

```
Entry type:
  "회의" / "meeting"        → meeting
  "보고서" / "report"       → report
  "실험" / "experiment"     → experiment
  "리뷰" / "review"         → review

Slide kind (LLM picks based on content tone):
  "발견 / 결과"              → discovery
  "실패 / 막힘"              → failure
  "구현 / 변경사항"          → implement
  "질문 / 의문"              → question
  "다음 단계 / TODO 류"      → next
  "지표 / 수치"              → metric

Milestone status:
  "지난 / past / 완료된"     → past
  "지금 / now / 진행 중"     → now
  "예정 / future / 앞으로"   → future

Todo bucket:
  "단기 / short / 이번 주"   → short
  "중기 / mid / 이번 달"     → mid
  "장기 / long / 이번 분기"  → long
```

### Composite entry recipe (the marquee skill flow)

When the user dictates a meeting / report:

1. LLM extracts: `date` (today by default), `type` (default `meeting`), `title`, `summary` (1–2 line), `bodyMarkdown` (full notes formatted as markdown).
2. LLM segments narrative into slides with `kind` mapped from content cues.
3. Any links in the input → candidate artifacts (skill asks user to confirm before sending arbitrary URLs).
4. Single composite POST.

Example:
```
User: 오늘 sweep 회의했는데 정리해줘. T=1.0이 retention 0.80으로 best였어.
      다음 단계는 full ablation. github.com/repo/sweep.ipynb 노트북 있어.
Claude: [LLM constructs body]
        ✓ Created e-... — "주간 sweep 미팅" (klass-unlearning)
          https://labhub.damilab.cc/projects/klass-unlearning/entries/e-...
```

### Disambiguation policy (additions to existing Step 5)

- "그 entry" / "마지막 entry" → most recent `e-…` printed in this conversation by `entry.create`. If absent, ask.
- "그 todo" — only resolvable if exactly one was created in this conversation; else ask which.
- Todo done toggle ambiguous: "이거 done", but conversation has 3 todos → ask.
- Entry without explicit `type` from user, no obvious cue → default to `meeting` (most common). If summary clearly says "experiment" → `experiment`.
- Date defaults to today (current local date via `new Date().toISOString().slice(0,10)`).

## Testing

Three new Playwright API spec files:

- `tests/api/entries.spec.ts` — covers all 5 entry endpoints. Including:
  - Composite create with slides + artifacts → assert sub-rows persisted
  - PATCH wholesale slide replace → old slides gone, new ones present
  - DELETE cascades sub-rows
  - List endpoint excludes `bodyMarkdown` (light shape)
  - Permission: 401 paths same as Phase 1
- `tests/api/milestones.spec.ts` — POST + GET + PATCH + DELETE. Position auto-append on omitted position.
- `tests/api/todos.spec.ts` — POST + GET + PATCH + DELETE. Done toggle logs the right activity action.

`tests/global-setup.ts` already provides Member.dgu and Project `phase1-test`. No fixture additions needed.

Same `PLAYWRIGHT_TEST=true` environment as before — middleware bypassed,
GitHub `/user` stubbed via fixtures.

## Acceptance criteria

- 13 new endpoints reachable on the deployed `https://labhub.damilab.cc`
  (after build + pm2 restart).
- Three new spec files pass (~25 cases total) under
  `pnpm exec playwright test tests/api/`.
- Phase 1 spec files (`auth-flow.spec.ts`, `runs.spec.ts`) still pass —
  no regression in shared helpers (jwt / bearer / errors).
- `pnpm exec tsc --noEmit` clean.
- `pnpm lint` clean.
- `pnpm build` clean — new routes appear in build manifest.
- `SKILL.md` updated with 8 new intents and the matching enum mappings.
- A manual end-to-end smoke walks: `/labhub` 회의 정리 → entry 생성 →
  list로 확인 → 한 슬라이드 PATCH → 삭제. Mirrors Phase 2's smoke.

## Out-of-scope (later phases)

- File upload endpoint (multipart) for genuine artifact attachment.
- Pagination / filtering on list endpoints.
- Per-slide / per-artifact patch endpoints.
- Cross-project list ("show all my todos across projects").
- Search across entries' bodies.
- Skill memory of "current project" so user doesn't re-type slug.

# Flow + Wiki Edit/Delete UI — Phase 7

**Date:** 2026-04-27
**Status:** Design draft, awaiting user review
**References:**
- Flow ingest V2: `docs/superpowers/specs/2026-04-27-labhub-flow-ingest-v2.md`
- Wiki ingest V1: `docs/superpowers/specs/2026-04-27-labhub-wiki-ingest.md`

## Motivation

V2 flow-ingest and V1 wiki-ingest land rows automatically via LLM
extraction. The LLM is good but not perfect — typos in titles, wrong tone
classification, duplicate or mis-typed wiki entities, mis-linked tasks.
Today there is no way for a researcher to fix these from the UI:

- Flow page wires `?editEvent=<id>` URL params but the entry point only
  appears in the empty-state copy ("우상단 수정 모드"). Once events exist,
  there is no edit affordance on cards. There are no PATCH/DELETE
  endpoints either.
- Wiki entity page is purely read-only. No edit button, no editor route,
  no PATCH/DELETE endpoints.

This phase adds visible edit + delete UX for both, plus the matching API.

## Goals

1. Editor surface that is discoverable on every Flow event card and Wiki
   entity page (not buried in empty-state copy).
2. Slide-over editor for Flow events (matches the run-edit pattern).
3. Dedicated edit page with markdown live preview for Wiki entities
   (matches their longer-form content).
4. Two-click delete confirmation everywhere (matches release-crud pattern).
5. PATCH + DELETE endpoints for both models, behind Bearer/session auth,
   with full validation parity to the existing POST/create paths.
6. ~20 new tests covering the API and basic UI smoke.

## Non-goals (explicit)

- **Author-only permissions.** Any authenticated project member can edit
  or delete. Audit who-changed-what via `ActivityEvent` (already wired for
  similar mutations) — not via per-row author checks.
- **Editing `sourceFiles`** on Wiki entities. PATCH explicitly ignores
  that field; ingest manages it. (Removing a `sourceFile` would let an
  already-ingested progress file get re-processed, which is a debugging
  workflow, not an editing workflow — out of scope.)
- **Editing `position`.** Drag-to-reorder for Flow events is a separate
  feature; this PATCH does not accept it. (Insert position is set by
  ingest; manual reorder is Phase 8.)
- **Editing `WikiType`.** Types are admin-configured in project settings,
  unchanged here.
- **Bulk edit/delete.** One row at a time.
- **Undo / soft delete.** DELETE is hard delete with cascade. Researchers
  can re-ingest progress files if they need the row back.
- **Comments on flow events.** Out of scope (Phase 6 was already deferred).

## API endpoints

### `PATCH /api/flow-events/:id`

**Auth:** Bearer JWT or NextAuth session (use existing auth helper that
already serves the other PATCH endpoints).

**Request body** — partial; any subset of:
```jsonc
{
  "date": "2026-04-27 14:00",
  "source": "progress_20260427_1400.md",
  "title": "...",
  "summary": "...",
  "tone": "milestone | result | pivot | design | incident",
  "bullets": ["..."],                   // wholesale replace
  "numbers": [{"label":"...","value":"..."}],
  "tags": ["..."]
}
```

**Validation:**
- 404 `flow_event_not_found` if id missing (NEW error code).
- If `tone` present, must be in `{milestone, pivot, result, incident, design}`
  → 400 `invalid_request`.
- If `title` present, non-empty.
- If `source` present, non-empty.
- `bullets` / `numbers` / `tags`, when present, are wholesale-replaced (the
  existing POST already treats them as JSON-encoded arrays).
- Empty body (no recognized keys) → 400 `invalid_request`, "no fields to update".

**Behavior:**
- Update only provided fields.
- `revalidatePath('/projects/<slug>/flow')` and `revalidatePath('/')`.
- Log `ActivityEvent` with `type:'flow_event'` action `'updated'` (NEW
  ActivityEvent type — see "Schema/types" below).

**Response 200:** `{ ok: true, id }`.

### `DELETE /api/flow-events/:id`

**Auth:** as above.

**Behavior:**
- 404 `flow_event_not_found` if missing.
- `prisma.flowEvent.delete` — cascade removes `FlowEventTaskLink` and
  `FlowEventComment`.
- Revalidate as above.
- Log `ActivityEvent` action `'deleted'`.

**Response 204** (no content).

### `PATCH /api/projects/:slug/wiki-entities/:id`

**Auth:** as above.

**Request body** — partial; any subset of:
```jsonc
{
  "name": "...",
  "type": "attack",                    // must match a project WikiType.key
  "status": "active | deprecated | superseded",
  "summaryMarkdown": "...",
  "bodyMarkdown": "..."
}
```

`sourceFiles` is **ignored** if sent (ingest territory).

**Validation:**
- 404 `project_not_found` if slug missing.
- 404 `entity_not_found` if `(slug, id)` missing.
- If `type` present, must match a configured WikiType for the project →
  400 `invalid_request` listing valid keys.
- If `status` present, ∈ `{active, deprecated, superseded}` → 400.
- If `name` present, non-empty.
- Empty body (no recognized keys) → 400.

**Behavior:**
- Update provided fields. `lastSyncedAt = now()`. `source = 'wiki-llm'`
  unchanged (this endpoint does not flip the provenance flag — admin
  edits are still an LLM-seeded entity that a human polished, not a
  human-authored entity).
- `revalidatePath('/projects/<slug>/wiki')` and the entity detail.
- Log `ActivityEvent` `type:'wiki_entity'` action `'updated'` (NEW type).

**Response 200:** `{ ok: true, id }`.

### `DELETE /api/projects/:slug/wiki-entities/:id`

**Auth:** as above.

**Behavior:**
- 404 `entity_not_found` if missing.
- Hard delete; cascade is a no-op (WikiEntity has no children).
- Revalidate.
- Log `ActivityEvent` action `'deleted'`.

**Response 204.**

### New error code

`flow_event_not_found` (status 404). Added to `lib/api/errors.ts`.

`entity_not_found` already exists from Phase 6.

### New ActivityEvent types

Add to `lib/types`:
- `flow_event` event type with actions `'created' | 'updated' | 'deleted'`
- `wiki_entity` event type with actions `'created' | 'updated' | 'deleted'`

`logActivity` typing follows the existing per-event-type payload shape:
- `flow_event` payload: `{ flowEventId: number, action }`
- `wiki_entity` payload: `{ entityId: string, action }`

The existing POST endpoints (Phase 5/6) currently do **not** log activity.
Add logging there at the same time so the activity feed reflects all
mutations consistently. Out-of-scope to backfill historical rows.

## UI: Flow event edit

### Card affordance

In `components/flow/timeline-card.tsx`, render a hover-only action group
in the card's top-right corner:
- pencil icon → links to `?editEvent=<id>` (already supported by page)
- trash icon → opens delete confirm inline (two-click, see below)

Existing `?edit=1` mode already renders an editor on the events column; we
keep that wiring. The new affordance is just to make it discoverable.

### Slide-over editor

New component: `components/flow/EventEditor.tsx`. Matches the existing
`components/ui/slide-over.tsx` shell.

- Title input (`maxLength=80`)
- Date input (`text` input, format hint `YYYY-MM-DD HH:mm`)
- Source input (read-only, locked — changing source breaks ingest dedupe)
- Tone select (5 options)
- Summary textarea (`rows=4`)
- Bullets: list editor (add/remove, drag is YAGNI)
- Numbers: pair editor (label, value)
- Tags: comma-separated input → split on save
- Save button → `PATCH /api/flow-events/<id>` → close → router refresh
- Delete button (red, two-click): first click switches to "정말 삭제할까요?",
  second click → `DELETE` → close → router refresh
- Cancel: close without changes

Mounted under `app/projects/[slug]/flow/page.tsx` whenever `editEventId`
is set. Existing `editTask` slide-over pattern is the template.

### Empty state copy

Update the empty-state hint in `app/projects/[slug]/flow/page.tsx:114`:
the current "우상단 수정 모드" link still works, but the inline hover-icon
affordance is now the primary edit entry. Keep the link as a quieter
secondary option.

## UI: Wiki entity edit

### Detail page affordance

In `app/projects/[slug]/wiki/[entityId]/page.tsx`, add a header action
row above the title:
- `편집` button → `Link` to `/projects/<slug>/wiki/<id>/edit`
- `삭제` button (two-click confirm) → server action → redirect to
  `/projects/<slug>/wiki`

### Edit page

New route: `app/projects/[slug]/wiki/[entityId]/edit/page.tsx`.

Layout:
- Sidebar (re-uses `WikiSidebar`) on the left
- Editor pane on the right with two columns:
  - Left column: form fields
    - Name input
    - Type select (populated from `wikiType.findMany`)
    - Status select (3 options)
    - Summary textarea (`rows=3`)
    - Body textarea (`rows=24`, monospace, full-width)
  - Right column: live preview using `MarkdownBody`
    - "Summary" preview block + body preview, mirroring the detail page
      layout

Save / Cancel / Delete buttons in a sticky footer.

State management: the page is a client component (uses `useState`) that
seeds from a server-fetched entity. Save calls `PATCH`; on success
`router.push` to the detail page.

### Why a separate page, not a slide-over

`bodyMarkdown` is often hundreds of lines; the editor needs full screen
for both the textarea and the preview. A slide-over would also conflict
with the sidebar.

## Delete confirmation pattern (shared)

Reusable hook: `hooks/use-two-click-confirm.ts` — returns `{armed, confirm,
reset}`. First click sets `armed=true` for 4 s; second click within the
window calls the destructive action; otherwise it resets. Match
`release-crud.spec.ts` expectations.

`components/ui/DeleteButton.tsx` wraps the hook with default styling
(red, danger tone, label switches "삭제" → "정말 삭제할까요?").

## Schema / types

- No DB schema change.
- `lib/types/events.ts`: add `'flow_event'` and `'wiki_entity'` to the
  EventType union, plus action unions.
- `lib/actions/events.ts`: extend `PayloadFor<T>` mapping for the two new
  types.

## Tests

### API tests (new, ~14)
- `tests/api/flow-events.spec.ts` — extend with:
  - PATCH: missing bearer → 401
  - PATCH: unknown id → 404 `flow_event_not_found`
  - PATCH: invalid tone → 400
  - PATCH: empty body → 400
  - PATCH: happy path partial (title only) → 200, other fields untouched
  - PATCH: bullets wholesale replace
  - DELETE: unknown id → 404
  - DELETE: happy path → 204, row gone, task links cascaded
- `tests/api/wiki-entities.spec.ts` — extend with:
  - PATCH: missing bearer → 401
  - PATCH: unknown entity → 404 `entity_not_found`
  - PATCH: invalid type → 400
  - PATCH: invalid status → 400
  - PATCH: happy path partial (name only) → 200, body untouched
  - PATCH: sourceFiles in body → ignored, original sourceFiles preserved
  - DELETE: unknown entity → 404
  - DELETE: happy path → 204, row gone

### Smoke tests (~6)
- `tests/smoke/flow-edit.spec.ts`
  - Hover-icon edit button visible on event card → opens slide-over
  - Save updates title in-place
  - Delete (two-click) removes the card
- `tests/smoke/wiki-edit.spec.ts`
  - 편집 button → navigates to /edit page
  - Body textarea + preview mirror live
  - Save returns to detail with updated body
  - 삭제 (two-click) returns to wiki index

Smoke tests can rely on the global `phase1-test` fixture (or a fresh
project they create) — same approach as existing smoke tests for runs/
entries.

### Pre-existing smoke flake

The 51 unrelated smoke failures observed during Phase 6 (referencing
wiped seed projects `reasoning-bench-v2`, `long-context-eval`, `d-001`)
are out of scope here. We do not fix them in this phase but verify our
new specs do not depend on those projects.

## Acceptance criteria

- All ~22 new tests pass (14 API + ~6 smoke + a couple of regression
  tests covering the new ActivityEvent logging).
- All existing api+cli tests still pass.
- `tsc --noEmit` / `lint` / `build` clean.
- Manual: flow event card hover shows pencil + trash; clicking pencil
  opens the slide-over; saving updates the card; two-click delete removes
  it. Wiki entity page top-right shows 편집 + 삭제; clicking 편집 routes to
  /edit page with side-by-side editor + preview; saving routes back; two-
  click 삭제 routes to wiki index.

## Out-of-scope follow-ups

- Per-author edit permissions (currently any project member can edit).
- Drag-to-reorder Flow events (manual `position` editing).
- Wiki entity merge tool when LLM creates duplicates under different ids.
- Undo / soft delete with grace window.
- Inline comments on flow events.
- Editing `sourceFiles` from the UI (debugging workflow).

# Phase 3 ↔ PR-Flow Integration Plan

> **For agentic workers:** this plan executes against the spec at
> `docs/superpowers/specs/2026-04-27-phase-3-pr-flow-integration.md`.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Phase 3 `/api/todos*` REST surface with PR #3's
TodoItem extension (`goal`, `subtasks`, `status`, `group`) under the
sync invariant `status === 'done' ⇔ done === true`. Update SKILL.md and
fix two CI-blocking lint errors that PR #3 introduced.

**Architecture:** `status` is source of truth; `done` is derived. POST
and PATCH apply the resolution rule from the spec. Validators add
`isTaskStatus`. Tests cover the new fields and the override rule. No
schema changes (PR #3 already migrated).

**Tech Stack:** existing — Prisma 7, validators in `lib/api/validators.ts`,
`TaskStatus` from `lib/types/flow.ts`.

---

## File Structure

```
lib/api/validators.ts              # MODIFY — add TASK_STATUSES + isTaskStatus
app/api/todos/route.ts             # MODIFY — POST accepts goal/subtasks/status/group + sync rule
app/api/todos/[id]/route.ts        # MODIFY — PATCH accepts same + sync rule
tests/api/todos.spec.ts            # MODIFY — append 9 sync/field test cases
skills/labhub/SKILL.md             # MODIFY — todo recipes for new fields + status NL map
components/flow/TaskKanbanLive.tsx # MODIFY — fix 2 unescaped-apostrophe lint errors + clear unused-import warnings
```

---

## Task 1: Validators — add `TaskStatus` guard

**Files:** `lib/api/validators.ts`

- [ ] **Step 1: Add the import + tuple + guard at the bottom of the file**

After the existing five tuples + guards in `lib/api/validators.ts`, add:

```ts
import type { TaskStatus } from '@/lib/types/flow';

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done'];

export function isTaskStatus(s: unknown): s is TaskStatus {
  return typeof s === 'string' && (TASK_STATUSES as readonly string[]).includes(s);
}
```

(Add the `import type` line near the existing imports at the top of the file, not at the bottom — TS imports must be at the top.)

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit (no test for the helper itself — exercised through API tests in Task 4)**

```bash
git -C /home/dgu/research_dashboard add lib/api/validators.ts
git -C /home/dgu/research_dashboard commit -m "skill api: add TaskStatus validator (pending|in_progress|done)"
```

---

## Task 2: POST /api/todos — accept new fields + sync rule

**Files:** `app/api/todos/route.ts`

- [ ] **Step 1: Replace the file with the extended version**

Replace `/home/dgu/research_dashboard/app/api/todos/route.ts` with:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isTodoBucket, isTaskStatus } from '@/lib/api/validators';
import type { TaskStatus } from '@/lib/types/flow';

/**
 * Resolve {done, status} from body fields per the sync invariant.
 * status (if present) wins; otherwise derive from done; otherwise both null.
 */
function resolveDoneStatus(
  bodyDone: unknown,
  bodyStatus: unknown,
): { ok: true; done?: boolean; status?: TaskStatus } | { ok: false; hint: string } {
  // status takes precedence if present
  if (bodyStatus !== undefined) {
    if (!isTaskStatus(bodyStatus)) {
      return { ok: false, hint: 'status must be one of pending/in_progress/done' };
    }
    return { ok: true, status: bodyStatus, done: bodyStatus === 'done' };
  }
  // status absent: derive from done if present
  if (bodyDone !== undefined) {
    if (typeof bodyDone !== 'boolean') {
      return { ok: false, hint: 'done must be boolean' };
    }
    return { ok: true, done: bodyDone, status: bodyDone ? 'done' : 'in_progress' };
  }
  // neither present
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as
    | {
        projectSlug?: string;
        bucket?: string;
        text?: string;
        position?: number;
        goal?: string | null;
        subtasks?: string[] | null;
        status?: string;
        group?: string | null;
        done?: boolean;
      }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  const bucket = body.bucket?.trim();
  const text = body.text?.trim();

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!bucket || !isTodoBucket(bucket)) return apiError(400, 'invalid_request', 'bucket must be one of short/mid/long');
  if (!text) return apiError(400, 'invalid_request', 'text is required');

  // Validate optional sub-shape
  if (body.subtasks !== undefined && body.subtasks !== null) {
    if (!Array.isArray(body.subtasks) || !body.subtasks.every(s => typeof s === 'string')) {
      return apiError(400, 'invalid_request', 'subtasks must be an array of strings');
    }
  }

  const sync = resolveDoneStatus(body.done, body.status);
  if (!sync.ok) return apiError(400, 'invalid_request', sync.hint);

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return apiError(404, 'project_not_found', `Project '${projectSlug}' not found.`);

  let position = body.position;
  if (position === undefined || position === null) {
    const last = await prisma.todoItem.findFirst({
      where: { projectSlug, bucket },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  const created = await prisma.todoItem.create({
    data: {
      projectSlug,
      bucket,
      text,
      done: sync.done ?? false,
      status: sync.status ?? 'in_progress',
      position,
      goal: body.goal ?? null,
      subtasks: body.subtasks && body.subtasks.length > 0 ? JSON.stringify(body.subtasks) : null,
      group: body.group ?? null,
    },
  });

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug,
    payload: { todoId: created.id, action: 'created' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/flow`);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run existing tests**

Run: `pnpm exec playwright test tests/api/todos.spec.ts --reporter=line --workers=1`
Expected: all 13 prior cases still pass (none of them set `goal`/`subtasks`/`status`/`group`, so the existing flow is unchanged).

- [ ] **Step 4: Commit**

```bash
git -C /home/dgu/research_dashboard add app/api/todos/route.ts
git -C /home/dgu/research_dashboard commit -m "skill api: POST /api/todos accepts goal/subtasks/status/group + status-wins sync"
```

---

## Task 3: PATCH /api/todos/:id — accept new fields + sync rule

**Files:** `app/api/todos/[id]/route.ts`

- [ ] **Step 1: Replace the file with the extended version**

Replace `/home/dgu/research_dashboard/app/api/todos/[id]/route.ts` with:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isTodoBucket, isTaskStatus } from '@/lib/api/validators';
import type { TodoEventAction } from '@/lib/types';
import type { TaskStatus } from '@/lib/types/flow';

function parseId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve {done, status} from body fields. Same rule as POST: status wins.
 * Returns the pair to write, OR the ok-false hint, OR ok-true with both
 * undefined when neither key is present (caller skips both columns).
 */
function resolveDoneStatus(
  bodyDone: unknown,
  bodyStatus: unknown,
): { ok: true; done?: boolean; status?: TaskStatus } | { ok: false; hint: string } {
  if (bodyStatus !== undefined) {
    if (!isTaskStatus(bodyStatus)) {
      return { ok: false, hint: 'status must be one of pending/in_progress/done' };
    }
    return { ok: true, status: bodyStatus, done: bodyStatus === 'done' };
  }
  if (bodyDone !== undefined) {
    if (typeof bodyDone !== 'boolean') {
      return { ok: false, hint: 'done must be boolean' };
    }
    return { ok: true, done: bodyDone, status: bodyDone ? 'done' : 'in_progress' };
  }
  return { ok: true };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'todo_not_found', `Todo id '${idStr}' is invalid.`);

  const existing = await prisma.todoItem.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'todo_not_found', `Todo '${idStr}' not found.`);

  const body = (await req.json().catch(() => null)) as
    | {
        bucket?: string;
        text?: string;
        done?: boolean;
        position?: number;
        goal?: string | null;
        subtasks?: string[] | null;
        status?: string;
        group?: string | null;
      }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  if (body.subtasks !== undefined && body.subtasks !== null) {
    if (!Array.isArray(body.subtasks) || !body.subtasks.every(s => typeof s === 'string')) {
      return apiError(400, 'invalid_request', 'subtasks must be an array of strings');
    }
  }

  const sync = resolveDoneStatus(body.done, body.status);
  if (!sync.ok) return apiError(400, 'invalid_request', sync.hint);

  const data: {
    bucket?: string;
    text?: string;
    position?: number;
    goal?: string | null;
    subtasks?: string | null;
    group?: string | null;
    done?: boolean;
    status?: TaskStatus;
  } = {};
  if (body.bucket !== undefined) {
    if (!isTodoBucket(body.bucket)) return apiError(400, 'invalid_request', 'bucket must be one of short/mid/long');
    data.bucket = body.bucket;
  }
  if (body.text !== undefined) data.text = body.text;
  if (body.position !== undefined) data.position = body.position;
  if (body.goal !== undefined) data.goal = body.goal;
  if (body.subtasks !== undefined) {
    data.subtasks = body.subtasks && body.subtasks.length > 0 ? JSON.stringify(body.subtasks) : null;
  }
  if (body.group !== undefined) data.group = body.group;
  if (sync.done !== undefined) data.done = sync.done;
  if (sync.status !== undefined) data.status = sync.status;

  const updated = await prisma.todoItem.update({ where: { id }, data });

  // Activity action: completed/reopened on done flip, otherwise updated.
  let action: TodoEventAction = 'updated';
  if (sync.done === true && existing.done === false) action = 'completed';
  else if (sync.done === false && existing.done === true) action = 'reopened';

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { todoId: id, action },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);
  revalidatePath(`/projects/${existing.projectSlug}/flow`);

  return NextResponse.json({
    id: updated.id,
    projectSlug: updated.projectSlug,
    bucket: updated.bucket,
    text: updated.text,
    done: updated.done,
    status: updated.status,
    position: updated.position,
    goal: updated.goal,
    subtasks: updated.subtasks ? JSON.parse(updated.subtasks) : null,
    group: updated.group,
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'todo_not_found', `Todo id '${idStr}' is invalid.`);

  const existing = await prisma.todoItem.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'todo_not_found', `Todo '${idStr}' not found.`);

  await prisma.todoItem.delete({ where: { id } });

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { todoId: id, action: 'deleted' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);
  revalidatePath(`/projects/${existing.projectSlug}/flow`);

  return new NextResponse(null, { status: 204 });
}
```

Note: also adds `revalidatePath('/projects/<slug>/flow')` to both PATCH and DELETE so the Flow kanban refreshes after API writes.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run existing tests** (sanity that nothing broke)

Run: `pnpm exec playwright test tests/api/todos.spec.ts --reporter=line --workers=1`
Expected: all 13 prior cases still pass.

- [ ] **Step 4: Commit**

```bash
git -C /home/dgu/research_dashboard add app/api/todos/[id]/route.ts
git -C /home/dgu/research_dashboard commit -m "skill api: PATCH /api/todos accepts goal/subtasks/status/group + status-wins sync"
```

---

## Task 4: Tests for the new fields + sync rule

**Files:** `tests/api/todos.spec.ts`

- [ ] **Step 1: Append the 9 new test cases**

Append to `/home/dgu/research_dashboard/tests/api/todos.spec.ts`:

```ts
test('POST /api/todos: status="done" → done=true persisted', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'sync-1', status: 'done' },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  // Read back via PATCH (the GET-by-id path doesn't exist for todos; PATCH no-op returns the row).
  const verify = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  expect(verify.status()).toBe(200);
  const row = await verify.json();
  expect(row.status).toBe('done');
  expect(row.done).toBe(true);
});

test('POST /api/todos: status="pending" → done=false persisted', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'sync-2', status: 'pending' },
  });
  const { id } = await created.json();

  const verify = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  const row = await verify.json();
  expect(row.status).toBe('pending');
  expect(row.done).toBe(false);
});

test('POST /api/todos: contradictory {done:true, status:"pending"} → status wins', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      bucket: 'short',
      text: 'sync-3',
      done: true,
      status: 'pending',
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  const verify = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  const row = await verify.json();
  expect(row.status).toBe('pending');
  expect(row.done).toBe(false);
});

test('PATCH /api/todos/:id: {done:true} → status="done" auto-derived', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'sync-4' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { done: true },
  });
  expect(patched.status()).toBe(200);
  const row = await patched.json();
  expect(row.done).toBe(true);
  expect(row.status).toBe('done');
});

test('PATCH /api/todos/:id: {done:false} on a "done" row → status="in_progress"', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'sync-5', status: 'done' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { done: false },
  });
  const row = await patched.json();
  expect(row.done).toBe(false);
  expect(row.status).toBe('in_progress');
});

test('PATCH /api/todos/:id: {status:"pending"} → done=false', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'sync-6', status: 'done' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'pending' },
  });
  const row = await patched.json();
  expect(row.status).toBe('pending');
  expect(row.done).toBe(false);
});

test('PATCH /api/todos/:id: goal/subtasks/group all persist', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'fields-1' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      goal: 'reduce p99 latency',
      subtasks: ['profile baseline', 'identify hot path', 'patch'],
      group: 'perf-2026Q2',
    },
  });
  expect(patched.status()).toBe(200);
  const row = await patched.json();
  expect(row.goal).toBe('reduce p99 latency');
  expect(Array.isArray(row.subtasks)).toBe(true);
  expect(row.subtasks).toEqual(['profile baseline', 'identify hot path', 'patch']);
  expect(row.group).toBe('perf-2026Q2');
});

test('POST /api/todos: subtasks as non-array → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'bad', subtasks: 'not an array' },
  });
  expect(res.status()).toBe(400);
});

test('POST /api/todos: invalid status → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'bad', status: 'bogus' },
  });
  expect(res.status()).toBe(400);
});
```

- [ ] **Step 2: Run all todos tests**

Run: `pnpm exec playwright test tests/api/todos.spec.ts --reporter=line --workers=1`
Expected: 13 prior + 9 new = 22 passing.

- [ ] **Step 3: Run all API tests for full safety**

Run: `pnpm exec playwright test tests/api/ --reporter=line --workers=1`
Expected: 58 prior + 9 new = 67 passing.

- [ ] **Step 4: Commit**

```bash
git -C /home/dgu/research_dashboard add tests/api/todos.spec.ts
git -C /home/dgu/research_dashboard commit -m "skill api: tests for goal/subtasks/group fields + status-wins sync invariant"
```

---

## Task 5: Update SKILL.md with the new fields + status NL mapping

**Files:** `skills/labhub/SKILL.md`

- [ ] **Step 1: Update the `### \`todo.create\`` recipe**

Locate the existing `### \`todo.create\`` section. Find this paragraph:

```
Required: `projectSlug`, `bucket`, `text`.
```

Replace with:

```
Required: `projectSlug`, `bucket`, `text`.

**Optional fields** (all skip-if-not-given):
- `goal` — one-line goal of the todo
- `subtasks` — array of strings; users say "with subtasks: A, B, C" or list them on separate lines
- `status` — one of `pending` / `in_progress` / `done`. If user explicitly says "대기" / "pending" → `pending`; "끝" / "done" → `done`; otherwise omit (server defaults to `in_progress`).
- `group` — free-form string; epic / project-area name for kanban sub-headers
```

Then update the bash block. Replace:

```bash
TOKEN=$(...)
BODY=$(node -e 'console.log(JSON.stringify({projectSlug:process.argv[1],bucket:process.argv[2],text:process.argv[3]}))' -- "<slug>" "<bucket>" "<text>")
curl -fsS -X POST "$LABHUB_URL/api/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

with:

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/.config/labhub/token.json','utf8'))['token'])")
# Build the body with node -e so optional fields drop out cleanly when empty.
BODY=$(node -e '
  const a = process.argv;
  const fields = { projectSlug: a[1], bucket: a[2], text: a[3] };
  if (a[4]) fields.goal = a[4];
  if (a[5]) fields.subtasks = a[5].split(",").map(s=>s.trim()).filter(Boolean);
  if (a[6]) fields.status = a[6];
  if (a[7]) fields.group = a[7];
  console.log(JSON.stringify(fields));
' -- "<slug>" "<bucket>" "<text>" "<goal or empty>" "<subtasks comma-separated or empty>" "<status or empty>" "<group or empty>")
curl -fsS -X POST "$LABHUB_URL/api/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

- [ ] **Step 2: Update the `### \`todo.update\`` recipe NL mappings**

Locate the existing `### \`todo.update\`` section, find the NL mapping bullets:

```
NL mapping for the done state:
- "done" / "완료" / "끝" / "마쳤어" → `{"done": true}`
- "다시 열어" / "reopen" / "되살려" / "취소 done" → `{"done": false}`
```

Replace with:

```
NL mapping for the completion state. The server applies a status-wins sync rule, so either form below produces a coherent row — pick whichever matches the user's words:
- "done" / "완료" / "끝" / "마쳤어" → `{"done": true}` (server sets `status="done"`)
- "다시 열어" / "reopen" / "되살려" → `{"done": false}` (server sets `status="in_progress"`)
- "pending" / "대기" / "보류" → `{"status": "pending"}` (server sets `done=false`)
- "다시 시작" / "in progress" / "이어서" → `{"status": "in_progress"}`

For richer field updates (goal/subtasks/group):
\`\`\`bash
BODY=$(node -e '
  const a = process.argv; const fields = {};
  if (a[1]) fields.goal = a[1];
  if (a[2]) fields.subtasks = a[2].split(",").map(s=>s.trim()).filter(Boolean);
  if (a[3]) fields.group = a[3];
  console.log(JSON.stringify(fields));
' -- "<new goal or empty>" "<new subtasks comma-separated or empty>" "<new group or empty>")
curl -fsS -X PATCH "$LABHUB_URL/api/todos/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
\`\`\`
```

(Keep the existing `Common case (done-toggle):` bash block immediately after, unchanged.)

- [ ] **Step 3: Verify line count**

Run: `wc -l /home/dgu/research_dashboard/skills/labhub/SKILL.md`
Expected: still under 500.

- [ ] **Step 4: Commit**

```bash
git -C /home/dgu/research_dashboard add skills/labhub/SKILL.md
git -C /home/dgu/research_dashboard commit -m "labhub skill: SKILL.md — todo recipes for goal/subtasks/status/group + sync semantics"
```

---

## Task 6: Side fix — clean up `TaskKanbanLive.tsx` lint errors

**Files:** `components/flow/TaskKanbanLive.tsx`

- [ ] **Step 1: Fix the two unescaped-apostrophe errors (line 432)**

Open `/home/dgu/research_dashboard/components/flow/TaskKanbanLive.tsx`. Read line 432 to see the exact content.

The errors are at columns 118 and 131 — apostrophes in JSX text. Replace each `'` with `&apos;` (or use one of `&lsquo;` / `&rsquo;` if the surrounding text suggests a directional quote).

Use the Edit tool to make a precise replacement based on the actual line text.

- [ ] **Step 2: Clear the five no-unused-vars warnings**

Locate and remove (or `// eslint-disable-line` if needed for future use):

- Line 28: unused imports `LabelChip`, `LabelTone`
- Lines 38-39: unused declarations `taskStatusTone`, `taskStatusLabel`
- Line 259: unused parameter `slug`

For unused destructure parameters that may be needed in the JSX scope, prefix with underscore (`_slug`) or remove if truly orphaned. For unused imports, just delete the import line / clause.

- [ ] **Step 3: Lint must pass**

Run: `pnpm lint`
Expected: clean (zero errors, zero warnings related to this file).

- [ ] **Step 4: Build still works**

Run: `pnpm build 2>&1 | tail -3`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git -C /home/dgu/research_dashboard add components/flow/TaskKanbanLive.tsx
git -C /home/dgu/research_dashboard commit -m "flow: fix unescaped apostrophes + drop unused imports in TaskKanbanLive"
```

---

## Task 7: Final verification

**Files:** none.

- [ ] **Step 1: Full static checks**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```
All three must be clean.

- [ ] **Step 2: Full API test suite**

```bash
pnpm exec playwright test tests/api/ --reporter=line --workers=1
```
Expected: 67 passed (58 prior + 9 new).

- [ ] **Step 3: Confirm git tree clean and ready to push**

```bash
git -C /home/dgu/research_dashboard status
git -C /home/dgu/research_dashboard log --oneline origin/main..HEAD
```

Expected: clean working tree; ahead 6+ (Phase 3 + integration + side-fix commits).

- [ ] **Step 4: Push (only with user confirmation)**

```bash
git -C /home/dgu/research_dashboard push
```

(Then redeploy via `pm2 restart labhub-app` only with explicit user confirmation.)

---

## Self-Review

**1. Spec coverage:**
- POST accepts new fields → Task 2 ✓
- PATCH accepts new fields → Task 3 ✓
- Sync rule (status wins) → both Task 2 + Task 3 use the same `resolveDoneStatus` helper ✓
- 9 spec test cases → all in Task 4 ✓
- SKILL.md NL mappings + recipes → Task 5 ✓
- Lint side fix → Task 6 ✓
- Acceptance criteria — all addressed by Task 7

**2. Placeholder scan:** none.

**3. Type/name consistency:**
- `TaskStatus` from `@/lib/types/flow` — used in validators (Task 1), POST (Task 2), PATCH (Task 3) ✓
- `isTaskStatus` defined in Task 1, used in Tasks 2 + 3 ✓
- Activity event payload shape unchanged ✓
- `done`/`status` resolver function (`resolveDoneStatus`) duplicated identically in two files (Tasks 2, 3). Could be extracted to a shared module, but inlined avoids a tiny new file for one helper. Acceptable.

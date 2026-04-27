import { test, expect, type APIRequestContext } from '@playwright/test';

async function getToken(request: APIRequestContext, ghToken = 'test:testbot'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

const FIXTURE_PROJECT = 'phase1-test';

test('POST /api/todos: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/todos', {
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'x' },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/todos: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: 'no-such', bucket: 'short', text: 'x' },
  });
  expect(res.status()).toBe(404);
});

test('POST /api/todos: invalid bucket → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'bogus', text: 'x' },
  });
  expect(res.status()).toBe(400);
});

test('POST /api/todos: empty text → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: '' },
  });
  expect(res.status()).toBe(400);
});

test('POST /api/todos: minimal create → 201', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'todo-minimal' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(typeof body.id).toBe('number');
});

test('GET /api/projects/:slug/todos: returns array', async ({ request }) => {
  const token = await getToken(request);
  const tag = `list-${Date.now()}`;
  await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: `${tag}-todo` },
  });

  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/todos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.todos)).toBe(true);
  expect(body.todos.some((t: { text: string }) => t.text === `${tag}-todo`)).toBe(true);
});

test('GET /api/projects/:slug/todos: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/projects/no-such/todos', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
});

test('PATCH /api/todos/:id: text update → 200', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'before' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { text: 'after' },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).text).toBe('after');
});

test('PATCH /api/todos/:id: done toggle to true → 200', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'finish-me' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { done: true },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).done).toBe(true);
});

test('PATCH /api/todos/:id: missing id → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.patch('/api/todos/999999', {
    headers: { Authorization: `Bearer ${token}` },
    data: { text: 'x' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('todo_not_found');
});

test('PATCH /api/todos/:id: invalid bucket → 400', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'bucket-test' },
  });
  const { id } = await created.json();
  const res = await request.patch(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { bucket: 'bogus' },
  });
  expect(res.status()).toBe(400);
});

test('DELETE /api/todos/:id: → 204', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'delete-me' },
  });
  const { id } = await created.json();

  const res = await request.delete(`/api/todos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(204);
});

test('DELETE /api/todos/:id: missing id → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.delete('/api/todos/999999', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
});

test('POST /api/todos: status="done" → done=true persisted', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, bucket: 'short', text: 'sync-1', status: 'done' },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

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

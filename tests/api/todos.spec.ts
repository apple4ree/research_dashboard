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

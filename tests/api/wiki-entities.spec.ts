import { test, expect, type APIRequestContext } from '@playwright/test';

async function getToken(request: APIRequestContext, ghToken = 'test:testbot'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

const FIXTURE_PROJECT = 'phase1-test';

function makeBody(opts: {
  id?: string;
  type?: string;
  name?: string;
  status?: string;
  summaryMarkdown?: string;
  bodyMarkdown?: string;
  sourceFiles?: string[];
} = {}) {
  return {
    projectSlug: FIXTURE_PROJECT,
    id: opts.id ?? `entity_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    type: opts.type ?? 'attack',
    name: opts.name ?? 'Test Entity',
    status: opts.status,
    summaryMarkdown: opts.summaryMarkdown ?? 'one-line summary',
    bodyMarkdown: opts.bodyMarkdown ?? '## Body\n\nDetails.',
    sourceFiles: opts.sourceFiles ?? ['progress_20260427_1400.md'],
  };
}

test('POST /api/wiki-entities: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/wiki-entities', { data: makeBody() });
  expect(res.status()).toBe(401);
});

test('POST /api/wiki-entities: unknown projectSlug → 404 project_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...makeBody(), projectSlug: 'no-such' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

test('POST /api/wiki-entities: type not in WikiTypes → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ type: 'no-such-type' }),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('invalid_request');
  expect(body.hint).toMatch(/attack|concept/);
});

test('POST /api/wiki-entities: invalid id (non-slug) → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id: 'Trigger-Bad!' }),
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('POST /api/wiki-entities: invalid status → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ status: 'bogus' }),
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('POST /api/wiki-entities: happy path (new) → 201, mode=created', async ({ request }) => {
  const token = await getToken(request);
  const id = `trigger_new_${Date.now()}`;
  const res = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id }),
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.id).toBe(id);
  expect(body.mode).toBe('created');
});

test('POST /api/wiki-entities: same id again → 200, mode=updated, body overwritten', async ({ request }) => {
  const token = await getToken(request);
  const id = `trigger_upd_${Date.now()}`;

  await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id, bodyMarkdown: 'first body' }),
  });

  const res2 = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id, bodyMarkdown: 'second body' }),
  });
  expect(res2.status()).toBe(200);
  expect((await res2.json()).mode).toBe('updated');

  const get = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await get.json()).bodyMarkdown).toBe('second body');
});

test('GET /api/projects/:slug/wiki-entities: light list, no bodyMarkdown, sourceFiles present', async ({ request }) => {
  const token = await getToken(request);
  const id = `trigger_list_${Date.now()}`;
  await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id, sourceFiles: ['progress_a.md', 'progress_b.md'] }),
  });

  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.entities)).toBe(true);

  const e = body.entities.find((x: { id: string }) => x.id === id);
  expect(e).toBeTruthy();
  expect('bodyMarkdown' in e).toBe(false);
  expect(typeof e.id).toBe('string');
  expect(typeof e.type).toBe('string');
  expect(typeof e.name).toBe('string');
  expect(typeof e.status).toBe('string');
  expect(typeof e.summaryMarkdown).toBe('string');
  expect(Array.isArray(e.sourceFiles)).toBe(true);
  expect(e.sourceFiles).toContain('progress_a.md');
  expect(typeof e.lastSyncedAt).toBe('string');
});

test('GET /api/projects/:slug/wiki-entities: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/projects/no-such/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

test('GET /api/projects/:slug/wiki-entities/:id: returns full body', async ({ request }) => {
  const token = await getToken(request);
  const id = `trigger_full_${Date.now()}`;
  await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id, bodyMarkdown: '# Heading\n\nFull text body here.' }),
  });

  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(id);
  expect(body.bodyMarkdown).toBe('# Heading\n\nFull text body here.');
});

test('GET /api/projects/:slug/wiki-entities/:id: missing entity → 404 entity_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/no_such_entity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('entity_not_found');
});

test('GET /api/projects/:slug/wiki-types: returns types in position order', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-types`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.types)).toBe(true);
  const keys = body.types.map((t: { key: string }) => t.key);
  expect(keys).toEqual(['attack', 'concept']);
  expect(typeof body.types[0].label).toBe('string');
});

test('GET /api/projects/:slug/wiki-types: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/projects/no-such/wiki-types', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

async function createEntity(request: APIRequestContext, token: string, id?: string): Promise<string> {
  const eid = id ?? `entity_patch_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const res = await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ id: eid }),
  });
  const body = await res.json();
  if (!body.id) throw new Error(`entity creation failed: ${JSON.stringify(body)}`);
  return body.id;
}

test('PATCH /api/wiki-entities/:slug/:id: missing bearer → 401', async ({ request }) => {
  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/some_id`, { data: { name: 'x' } });
  expect(res.status()).toBe(401);
});

test('PATCH /api/wiki-entities/:slug/:id: unknown entity → 404 entity_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/no_such_entity`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'x' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('entity_not_found');
});

test('PATCH /api/wiki-entities/:slug/:id: invalid type → 400', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEntity(request, token);
  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { type: 'no-such-type' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('PATCH /api/wiki-entities/:slug/:id: invalid status → 400', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEntity(request, token);
  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'bogus' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('PATCH /api/wiki-entities/:slug/:id: empty body → 400', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEntity(request, token);
  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('PATCH /api/wiki-entities/:slug/:id: partial name update → 200, body untouched', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEntity(request, token);

  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Edited Name' },
  });
  expect(res.status()).toBe(200);

  const get = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await get.json();
  expect(body.name).toBe('Edited Name');
  expect(body.bodyMarkdown).toBe('## Body\n\nDetails.');
});

test('PATCH /api/wiki-entities/:slug/:id: sourceFiles ignored, original preserved', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEntity(request, token);

  const res = await request.patch(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Edited', sourceFiles: ['hijacked.md'] },
  });
  expect(res.status()).toBe(200);

  const get = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await get.json();
  expect(body.sourceFiles).toEqual(['progress_20260427_1400.md']);
});

test('DELETE /api/wiki-entities/:slug/:id: unknown entity → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.delete(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/no_such_entity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('entity_not_found');
});

test('DELETE /api/wiki-entities/:slug/:id: happy path → 204, row gone', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEntity(request, token);

  const del = await request.delete(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(del.status()).toBe(204);

  const get = await request.get(`/api/projects/${FIXTURE_PROJECT}/wiki-entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(get.status()).toBe(404);
});

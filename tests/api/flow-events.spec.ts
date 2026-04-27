import { test, expect, type APIRequestContext } from '@playwright/test';

async function getToken(request: APIRequestContext, ghToken = 'test:testbot'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

const FIXTURE_PROJECT = 'phase1-test';

function makeBody(opts: {
  source?: string;
  tone?: string;
  taskIds?: number[];
  overwrite?: boolean;
} = {}) {
  return {
    projectSlug: FIXTURE_PROJECT,
    event: {
      date: '2026-04-27 14:00',
      source: opts.source ?? `progress_v2_${Date.now()}.md`,
      title: 'v2 test',
      summary: 'fixture',
      tone: opts.tone ?? 'milestone',
      bullets: ['fact'],
      numbers: [{ label: 'm', value: '0.5' }],
      tags: ['t'],
    },
    taskIds: opts.taskIds ?? [],
    overwrite: opts.overwrite ?? false,
  };
}

test('POST /api/flow-events: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/flow-events', { data: makeBody() });
  expect(res.status()).toBe(401);
});

test('POST /api/flow-events: unknown projectSlug → 404 project_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...makeBody(), projectSlug: 'no-such' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

test('POST /api/flow-events: invalid tone → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ tone: 'bogus' }),
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('POST /api/flow-events: unknown taskIds → 400 listing missing ids', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ taskIds: [9999991, 9999992] }),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('invalid_request');
  expect(body.hint).toMatch(/9999991|9999992/);
});

test('POST /api/flow-events: happy path → 201 + ok/eventId/mode/taskLinks', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody(),
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(typeof body.eventId).toBe('number');
  expect(body.mode).toBe('created');
  expect(body.taskLinks).toBe(0);
});

test('POST /api/flow-events: duplicate source without overwrite → 409 event_already_exists', async ({ request }) => {
  const token = await getToken(request);
  const source = `progress_v2_dup_${Date.now()}.md`;

  await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ source }),
  });

  const res2 = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ source }),
  });
  expect(res2.status()).toBe(409);
  expect((await res2.json()).error).toBe('event_already_exists');
});

test('POST /api/flow-events: overwrite=true replaces same-source events', async ({ request }) => {
  const token = await getToken(request);
  const source = `progress_v2_over_${Date.now()}.md`;

  await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ source }),
  });

  const res2 = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ source, overwrite: true }),
  });
  expect(res2.status()).toBe(200);
  const body = await res2.json();
  expect(body.mode).toBe('updated');

  // Verify only one row remains for this source via the GET list endpoint.
  const list = await request.get(`/api/projects/${FIXTURE_PROJECT}/flow-events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = (await list.json()).events as { source: string }[];
  expect(events.filter(e => e.source === source).length).toBe(1);
});

test('GET /api/projects/:slug/flow-events: returns light list', async ({ request }) => {
  const token = await getToken(request);
  const source = `progress_v2_list_${Date.now()}.md`;

  await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ source }),
  });

  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/flow-events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.events)).toBe(true);

  const e = body.events.find((x: { source: string }) => x.source === source);
  expect(e).toBeTruthy();
  // Light shape — heavy fields excluded.
  expect('bullets' in e).toBe(false);
  expect('numbers' in e).toBe(false);
  expect('tags' in e).toBe(false);
  expect('summary' in e).toBe(false);
  // Light fields present.
  expect(typeof e.id).toBe('number');
  expect(typeof e.title).toBe('string');
  expect(typeof e.tone).toBe('string');
  expect(typeof e.position).toBe('number');
  expect(typeof e.date).toBe('string');
});

test('GET /api/projects/:slug/flow-events: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/projects/no-such/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

async function createEvent(request: APIRequestContext, token: string, source?: string): Promise<number> {
  const res = await request.post('/api/flow-events', {
    headers: { Authorization: `Bearer ${token}` },
    data: makeBody({ source: source ?? `progress_patch_${Date.now()}_${Math.floor(Math.random() * 1e6)}.md` }),
  });
  const body = await res.json();
  if (!body.eventId) throw new Error(`event creation failed: ${JSON.stringify(body)}`);
  return body.eventId;
}

test('PATCH /api/flow-events/:id: missing bearer → 401', async ({ request }) => {
  const res = await request.patch('/api/flow-events/1', { data: { title: 'x' } });
  expect(res.status()).toBe(401);
});

test('PATCH /api/flow-events/:id: unknown id → 404 flow_event_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.patch('/api/flow-events/9999999', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: 'x' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('flow_event_not_found');
});

test('PATCH /api/flow-events/:id: invalid tone → 400', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEvent(request, token);
  const res = await request.patch(`/api/flow-events/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { tone: 'bogus' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('PATCH /api/flow-events/:id: empty body → 400', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEvent(request, token);
  const res = await request.patch(`/api/flow-events/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('PATCH /api/flow-events/:id: partial title update → 200, others untouched', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEvent(request, token);
  const res = await request.patch(`/api/flow-events/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: 'edited title' },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).id).toBe(id);

  const list = await request.get(`/api/projects/${FIXTURE_PROJECT}/flow-events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = (await list.json()).events as { id: number; title: string; tone: string }[];
  const e = events.find(x => x.id === id);
  expect(e?.title).toBe('edited title');
  expect(e?.tone).toBe('milestone');
});

test('PATCH /api/flow-events/:id: bullets wholesale replace', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEvent(request, token);
  const res = await request.patch(`/api/flow-events/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { bullets: ['new-1', 'new-2', 'new-3'] },
  });
  expect(res.status()).toBe(200);
});

test('DELETE /api/flow-events/:id: unknown id → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.delete('/api/flow-events/9999999', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('flow_event_not_found');
});

test('DELETE /api/flow-events/:id: happy path → 204, row gone', async ({ request }) => {
  const token = await getToken(request);
  const id = await createEvent(request, token);

  const del = await request.delete(`/api/flow-events/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(del.status()).toBe(204);

  const list = await request.get(`/api/projects/${FIXTURE_PROJECT}/flow-events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = (await list.json()).events as { id: number }[];
  expect(events.find(e => e.id === id)).toBeUndefined();
});

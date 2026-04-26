import { test, expect, type APIRequestContext } from '@playwright/test';

async function getToken(request: APIRequestContext, ghToken = 'test:testbot'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

const FIXTURE_PROJECT = 'phase1-test';

test('POST /api/entries: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/entries', {
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-04-26', type: 'meeting', title: 'x', summary: 'y', bodyMarkdown: 'z' },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/entries: unknown projectSlug → 404 project_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: 'nope', date: '2026-04-26', type: 'meeting', title: 'x', summary: 'y', bodyMarkdown: 'z' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

test('POST /api/entries: invalid type → 400 invalid_request', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-04-26', type: 'bogus', title: 'x', summary: 'y', bodyMarkdown: 'z' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});

test('POST /api/entries: minimal entry (no slides/artifacts) → 201', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'minimal',
      summary: 'no slides, no artifacts',
      bodyMarkdown: '## body',
      tags: ['test'],
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id).toMatch(/^e-/);
});

test('POST /api/entries: composite create with slides + artifacts → 201, sub-rows persisted', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'composite test',
      summary: 'slides + artifacts',
      bodyMarkdown: '## body',
      tags: ['composite'],
      slides: [
        { kind: 'discovery', title: 'finding 1', body: 'detail', metricsJson: '{"x":1}' },
        { kind: 'next', title: 'next step', body: 'detail' },
      ],
      artifacts: [
        { type: 'notebook', title: 'nb', href: 'https://example.com/nb.ipynb' },
      ],
    },
  });
  expect(res.status()).toBe(201);
  const { id } = await res.json();
  expect(id).toMatch(/^e-/);

  // GET the detail to verify sub-rows persisted (relies on Task 5).
  const detail = await request.get(`/api/entries/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (detail.status() === 200) {
    const e = await detail.json();
    expect(e.slides).toHaveLength(2);
    expect(e.slides[0].kind).toBe('discovery');
    expect(e.artifacts).toHaveLength(1);
    expect(e.artifacts[0].href).toBe('https://example.com/nb.ipynb');
  }
  // If GET endpoint not yet implemented (running this task in isolation), skip.
});

test('POST /api/entries: invalid slide kind → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'bad slide',
      summary: 'x',
      bodyMarkdown: 'x',
      slides: [{ kind: 'nonsense', title: 't', body: 'b' }],
    },
  });
  expect(res.status()).toBe(400);
});

test('POST /api/entries: invalid artifact type → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'bad artifact',
      summary: 'x',
      bodyMarkdown: 'x',
      artifacts: [{ type: 'nonsense', title: 't', href: 'https://example.com' }],
    },
  });
  expect(res.status()).toBe(400);
});

test('GET /api/projects/:slug/entries: returns light list (no bodyMarkdown/slides/artifacts)', async ({ request }) => {
  const token = await getToken(request);
  // Ensure at least one entry exists.
  await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'list-me',
      summary: 'should appear in list',
      bodyMarkdown: 'should be excluded from list',
    },
  });

  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/entries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.entries)).toBe(true);
  expect(body.entries.length).toBeGreaterThanOrEqual(1);
  for (const e of body.entries) {
    expect(typeof e.id).toBe('string');
    expect(typeof e.title).toBe('string');
    // Light shape — no bodyMarkdown, slides, or artifacts.
    expect('bodyMarkdown' in e).toBe(false);
    expect('slides' in e).toBe(false);
    expect('artifacts' in e).toBe(false);
  }
});

test('GET /api/projects/:slug/entries: unknown slug → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/projects/no-such-project/entries', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('project_not_found');
});

test('GET /api/entries/:id: returns full detail with slides + artifacts', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'detail-me',
      summary: 'with sub-rows',
      bodyMarkdown: '## full body',
      slides: [{ kind: 'metric', title: 's1', body: 'b1' }],
      artifacts: [{ type: 'figure', title: 'a1', href: 'https://example.com/fig.png' }],
    },
  });
  const { id } = await created.json();

  const res = await request.get(`/api/entries/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  const e = await res.json();
  expect(e.id).toBe(id);
  expect(e.bodyMarkdown).toBe('## full body');
  expect(e.slides).toHaveLength(1);
  expect(e.slides[0].kind).toBe('metric');
  expect(e.artifacts).toHaveLength(1);
});

test('GET /api/entries/:id: missing id → 404 entry_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/entries/e-does-not-exist', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('entry_not_found');
});

test('PATCH /api/entries/:id: partial fields update, slides untouched', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'patch-target',
      summary: 'before',
      bodyMarkdown: 'before',
      slides: [{ kind: 'discovery', title: 'keep', body: 'me' }],
    },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: 'patched-title', summary: 'after' },
  });
  expect(patched.status()).toBe(200);
  const e = await patched.json();
  expect(e.title).toBe('patched-title');
  expect(e.summary).toBe('after');
  expect(e.slides).toHaveLength(1);
  expect(e.slides[0].title).toBe('keep');
});

test('PATCH /api/entries/:id: slides key present → wholesale replacement', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'replace-slides',
      summary: 'x',
      bodyMarkdown: 'x',
      slides: [
        { kind: 'discovery', title: 'old1', body: 'b' },
        { kind: 'next', title: 'old2', body: 'b' },
      ],
    },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { slides: [{ kind: 'metric', title: 'new', body: 'b' }] },
  });
  expect(patched.status()).toBe(200);
  const e = await patched.json();
  expect(e.slides).toHaveLength(1);
  expect(e.slides[0].title).toBe('new');
  expect(e.slides[0].kind).toBe('metric');
});

test('PATCH /api/entries/:id: empty slides array → all slides deleted', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'empty-slides',
      summary: 'x',
      bodyMarkdown: 'x',
      slides: [{ kind: 'discovery', title: 'gone', body: 'b' }],
    },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { slides: [] },
  });
  expect(patched.status()).toBe(200);
  const e = await patched.json();
  expect(e.slides).toHaveLength(0);
});

test('PATCH /api/entries/:id: missing id → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.patch('/api/entries/e-nope', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: 'x' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('entry_not_found');
});

test('PATCH /api/entries/:id: invalid type → 400', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-04-26', type: 'meeting', title: 't', summary: 's', bodyMarkdown: 'b' },
  });
  const { id } = await created.json();
  const res = await request.patch(`/api/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { type: 'bogus' },
  });
  expect(res.status()).toBe(400);
});

test('DELETE /api/entries/:id: removes entry and cascades slides/artifacts', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/entries', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: FIXTURE_PROJECT,
      date: '2026-04-26',
      type: 'meeting',
      title: 'delete-me',
      summary: 'x',
      bodyMarkdown: 'x',
      slides: [{ kind: 'discovery', title: 's', body: 'b' }],
      artifacts: [{ type: 'notebook', title: 'a', href: 'https://example.com' }],
    },
  });
  const { id } = await created.json();

  const del = await request.delete(`/api/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(del.status()).toBe(204);

  const get = await request.get(`/api/entries/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(get.status()).toBe(404);
});

test('DELETE /api/entries/:id: missing id → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.delete('/api/entries/e-nope', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
});

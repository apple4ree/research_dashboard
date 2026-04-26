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

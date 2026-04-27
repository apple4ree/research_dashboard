import { test, expect, type APIRequestContext } from '@playwright/test';

async function getToken(request: APIRequestContext, ghToken = 'test:testbot'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

const FIXTURE_PROJECT = 'phase1-test';

test('POST /api/milestones: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/milestones', {
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-05-01', label: 'x', status: 'future' },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/milestones: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: 'no-such', date: '2026-05-01', label: 'x', status: 'future' },
  });
  expect(res.status()).toBe(404);
});

test('POST /api/milestones: invalid status → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-05-01', label: 'x', status: 'bogus' },
  });
  expect(res.status()).toBe(400);
});

test('POST /api/milestones: minimal create → 201, position auto-appended', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-05-01', label: 'auto-position', status: 'future' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(typeof body.id).toBe('number');
});

test('POST /api/milestones: explicit position respected', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-05-01', label: 'pos-test', status: 'future', position: 99, note: 'hello' },
  });
  expect(res.status()).toBe(201);
});

test('GET /api/projects/:slug/milestones: returns array sorted by position', async ({ request }) => {
  const token = await getToken(request);
  const tag = `list-${Date.now()}`;
  await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-05-15', label: `${tag}-A`, status: 'future', position: 100 },
  });
  await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-05-20', label: `${tag}-B`, status: 'future', position: 101 },
  });

  const res = await request.get(`/api/projects/${FIXTURE_PROJECT}/milestones`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.milestones)).toBe(true);
  // Find our two by tag-prefixed label and check ordering.
  const a = body.milestones.findIndex((m: { label: string }) => m.label === `${tag}-A`);
  const b = body.milestones.findIndex((m: { label: string }) => m.label === `${tag}-B`);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(b).toBeGreaterThan(a); // B has higher position, comes later
});

test('GET /api/projects/:slug/milestones: unknown project → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.get('/api/projects/no-such/milestones', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
});

test('GET /api/projects/:slug/milestones: auto-position assigns increasing values', async ({ request }) => {
  const token = await getToken(request);
  const tag = `auto-${Date.now()}`;
  // Fetch current count before, so we know the baseline.
  const before = await request.get(`/api/projects/${FIXTURE_PROJECT}/milestones`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const beforeBody = await before.json();
  const baselineMaxPos = beforeBody.milestones.reduce(
    (max: number, m: { position: number }) => Math.max(max, m.position),
    -1,
  );

  // Create two milestones with no explicit position.
  const created1 = await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-06-01', label: `${tag}-A`, status: 'future' },
  });
  const created2 = await request.post('/api/milestones', {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectSlug: FIXTURE_PROJECT, date: '2026-06-02', label: `${tag}-B`, status: 'future' },
  });
  expect(created1.status()).toBe(201);
  expect(created2.status()).toBe(201);

  const after = await request.get(`/api/projects/${FIXTURE_PROJECT}/milestones`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterBody = await after.json();
  const a = afterBody.milestones.find((m: { label: string }) => m.label === `${tag}-A`);
  const b = afterBody.milestones.find((m: { label: string }) => m.label === `${tag}-B`);
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  expect(a.position).toBe(baselineMaxPos + 1);
  expect(b.position).toBe(baselineMaxPos + 2);
});

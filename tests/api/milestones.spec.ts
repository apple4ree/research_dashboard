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

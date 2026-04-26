import { test, expect, type APIRequestContext } from '@playwright/test';

async function getToken(request: APIRequestContext, ghToken = 'test:testbot'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

const FIXTURE_PROJECT = 'phase1-test'; // ensured by tests/global-setup.ts

test('POST /api/runs: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/runs', {
    data: { name: 'x', projectSlug: FIXTURE_PROJECT, status: 'in_progress' },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/runs: unknown projectSlug → 404 with helpful hint', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'sweep-1', projectSlug: 'does-not-exist', status: 'in_progress' },
  });
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toBe('project_not_found');
  expect(body.hint).toMatch(/does-not-exist/);
});

test('POST /api/runs: success creates run', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'phase1-smoke',
      projectSlug: FIXTURE_PROJECT,
      status: 'in_progress',
      summary: 'from API test',
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id).toMatch(/^exp-/);
});

test('POST /api/runs: invalid status → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'x', projectSlug: FIXTURE_PROJECT, status: 'bogus' },
  });
  expect(res.status()).toBe(400);
});

test('PATCH /api/runs/:id: updates fields and logs activity on status change', async ({ request }) => {
  const token = await getToken(request);
  const created = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'patch-target', projectSlug: FIXTURE_PROJECT, status: 'in_progress' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/runs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'success', durationSec: 120, summary: 'final' },
  });
  expect(patched.status()).toBe(200);
  const body = await patched.json();
  expect(body.id).toBe(id);
  expect(body.status).toBe('success');
  expect(body.durationSec).toBe(120);
  expect(body.summary).toBe('final');
});

test("PATCH /api/runs/:id: anyone can update anyone else's run", async ({ request }) => {
  // testbot creates the run.
  const tokenTestbot = await getToken(request, 'test:testbot');
  const created = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${tokenTestbot}` },
    data: { name: 'cross-update', projectSlug: FIXTURE_PROJECT, status: 'in_progress' },
  });
  const { id } = await created.json();

  // newuser cancels it — explicitly different identity, must still succeed.
  const tokenOther = await getToken(request, 'test:newuser');
  const patched = await request.patch(`/api/runs/${id}`, {
    headers: { Authorization: `Bearer ${tokenOther}` },
    data: { status: 'cancelled' },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).status).toBe('cancelled');
});

test('PATCH /api/runs/:id: unknown id → 404 run_not_found', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.patch('/api/runs/exp-does-not-exist', {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'cancelled' },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBe('run_not_found');
});
